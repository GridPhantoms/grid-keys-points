import { Contract, FetchRequest, Interface, JsonRpcProvider, getAddress, isAddress } from 'ethers';
import { NextRequest, NextResponse } from 'next/server';
import { getNftsForOwner } from '@/app/api/_lib/alchemy-server';
import { ethereumRpcUrl } from '@/lib/bytes-api.mjs';
import {
  BYTES_STAKING_ABI,
  BYTES_STAKING_CONTRACT,
  BYTES_TOKEN_ABI,
  BYTES_TOKEN_CONTRACT,
  ETHEREUM_CHAIN_ID,
  MULTICALL3_CONTRACT,
  S1_CITIZEN_CONTRACT,
  S2_OUTER_CITIZEN_CONTRACT,
} from '@/lib/bytes-contracts';
import { buildBytes2BytesSummary, bytesAmount, normalizeCitizenPosition, type RawCitizenPosition } from '@/lib/bytes-to-bytes';
import { CITIZEN_COLLECTIONS } from '@/lib/citizen-terminal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 12_000;
const RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store' };
const MAX_DIRECT_ASSETS = 500;
const ownerOfInterface = new Interface(['function ownerOf(uint256 tokenId) view returns (address)']);
const MULTICALL3_ABI = ['function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)'] as const;

type StakerPositions = {
  stakedS1Citizens: RawCitizenPosition[];
  stakedS2Citizens: RawCitizenPosition[];
};

type DirectAssetCandidate = {
  collectionKey: string;
  contract: string;
  tokenId: string;
};

function withTimeout<T>(promise: Promise<T>, label: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), REQUEST_TIMEOUT_MS)),
  ]);
}

async function resolveWallet(provider: JsonRpcProvider, input: string) {
  if (isAddress(input)) return getAddress(input);
  if (!/^[a-z0-9][a-z0-9.-]{0,126}\.eth$/i.test(input)) throw new Error('Enter a valid Ethereum address or ENS name.');
  const resolved = await withTimeout(provider.resolveName(input), 'ENS resolution');
  if (!resolved || !isAddress(resolved)) throw new Error('That ENS name did not resolve to an Ethereum address.');
  return getAddress(resolved);
}

function normalizeTokenId(value: unknown) {
  if (typeof value !== 'string' || !/^(?:0x[0-9a-fA-F]+|\d+)$/.test(value)) return null;
  try {
    const tokenId = BigInt(value);
    return tokenId >= BigInt(0) && tokenId < BigInt(2) ** BigInt(256) ? tokenId.toString() : null;
  } catch {
    return null;
  }
}

async function readDirectCitizenAssets(wallet: string, provider: JsonRpcProvider, blockNumber: number) {
  const indexed = await getNftsForOwner(wallet, CITIZEN_COLLECTIONS.map((collection) => collection.contract), 100, false, MAX_DIRECT_ASSETS);
  const collectionByAddress = new Map(CITIZEN_COLLECTIONS.map((collection) => [collection.contract.toLowerCase(), collection]));
  const seen = new Set<string>();
  const candidates = indexed.flatMap((nft): DirectAssetCandidate[] => {
    const indexedContract = typeof nft.contractAddress === 'string' ? nft.contractAddress : nft.contract?.address;
    const contractAddress = typeof indexedContract === 'string' ? indexedContract.toLowerCase() : '';
    const collection = collectionByAddress.get(contractAddress);
    const tokenId = normalizeTokenId(nft.tokenId);
    const uniqueKey = `${contractAddress}:${tokenId}`;
    if (!collection || tokenId === null || seen.has(uniqueKey)) return [];
    seen.add(uniqueKey);
    return [{ collectionKey: collection.key, contract: collection.contract, tokenId }];
  });

  let verified: DirectAssetCandidate[] = [];
  if (candidates.length > 0) {
    const multicall = new Contract(MULTICALL3_CONTRACT, MULTICALL3_ABI, provider);
    const calls = candidates.map((asset) => ({
      target: asset.contract,
      allowFailure: true,
      callData: ownerOfInterface.encodeFunctionData('ownerOf', [asset.tokenId]),
    }));
    const results = await multicall.aggregate3.staticCall(calls, { blockTag: blockNumber }) as Array<[boolean, string]>;
    verified = candidates.filter((asset, index) => {
      const result = results[index];
      if (!result?.[0]) return false;
      try {
        const [owner] = ownerOfInterface.decodeFunctionResult('ownerOf', result[1]);
        return getAddress(String(owner)) === wallet;
      } catch {
        return false;
      }
    });
  }

  const collections = CITIZEN_COLLECTIONS.flatMap((collection) => {
    const items = verified
      .filter((asset) => asset.collectionKey === collection.key)
      .map((asset) => ({ tokenId: asset.tokenId }));
    if (items.length === 0) return [];
    return [{
      key: collection.key,
      season: collection.season,
      label: collection.label,
      kind: collection.key.endsWith('-citizens') ? 'citizen' as const : 'component' as const,
      items,
    }];
  });
  const assembledCount = collections
    .filter((collection) => collection.kind === 'citizen')
    .reduce((sum, collection) => sum + collection.items.length, 0);
  const componentCount = collections
    .filter((collection) => collection.kind === 'component')
    .reduce((sum, collection) => sum + collection.items.length, 0);
  return { totalCount: assembledCount + componentCount, assembledCount, componentCount, collections };
}

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('address')?.trim() ?? '';
  if (!input || input.length > 128) {
    return NextResponse.json({ error: 'Enter a valid Ethereum address or ENS name.' }, { status: 400, headers: RESPONSE_HEADERS });
  }

  const url = ethereumRpcUrl(process.env);
  if (!url) return NextResponse.json({ error: 'Ethereum data source unavailable.' }, { status: 503, headers: RESPONSE_HEADERS });

  const transport = new FetchRequest(url);
  transport.timeout = REQUEST_TIMEOUT_MS;
  const provider = new JsonRpcProvider(transport, ETHEREUM_CHAIN_ID, { staticNetwork: true });
  try {
    const [network, block] = await withTimeout(Promise.all([provider.getNetwork(), provider.getBlock('latest')]), 'Ethereum source');
    if (network.chainId !== BigInt(ETHEREUM_CHAIN_ID) || !block?.hash) throw new Error('Ethereum source verification failed.');
    const wallet = await resolveWallet(provider, input);
    const staking = new Contract(BYTES_STAKING_CONTRACT, BYTES_STAKING_ABI, provider);
    const token = new Contract(BYTES_TOKEN_CONTRACT, BYTES_TOKEN_ABI, provider);

    const [stakingBytes, stakingS1, stakingS2, walletBalanceRaw, s1Pending, s2Pending, positions, directAssets] = await withTimeout(Promise.all([
      staking.BYTES({ blockTag: block.number }) as Promise<string>,
      staking.S1_CITIZEN({ blockTag: block.number }) as Promise<string>,
      staking.S2_CITIZEN({ blockTag: block.number }) as Promise<string>,
      token.balanceOf(wallet, { blockTag: block.number }) as Promise<bigint>,
      staking.getPendingPoolReward(0, wallet, { blockTag: block.number }) as Promise<[bigint, bigint]>,
      staking.getPendingPoolReward(1, wallet, { blockTag: block.number }) as Promise<[bigint, bigint]>,
      staking.getStakerPositions(wallet, { blockTag: block.number }) as Promise<StakerPositions>,
      readDirectCitizenAssets(wallet, provider, block.number),
    ]), 'Bytes2Bytes contract reads');

    if (getAddress(stakingBytes) !== BYTES_TOKEN_CONTRACT || getAddress(stakingS1) !== S1_CITIZEN_CONTRACT || getAddress(stakingS2) !== S2_OUTER_CITIZEN_CONTRACT) {
      throw new Error('Canonical staking contract links did not match.');
    }
    const confirmed = await withTimeout(provider.getBlock(block.number), 'Ethereum source confirmation');
    if (!confirmed?.hash || confirmed.hash !== block.hash) throw new Error('Ethereum source block changed during lookup.');

    const s1Citizens = positions.stakedS1Citizens.map((position) => normalizeCitizenPosition('s1', position));
    const s2Citizens = positions.stakedS2Citizens.map((position) => normalizeCitizenPosition('s2', position));
    const pendingByPool = { s1: bytesAmount(s1Pending[0]), s2: bytesAmount(s2Pending[0]) };
    const pendingDaoTaxByPool = { s1: bytesAmount(s1Pending[1]), s2: bytesAmount(s2Pending[1]) };
    const walletBalance = bytesAmount(walletBalanceRaw);

    return NextResponse.json({
      input,
      resolvedAddress: wallet,
      chain: 'Ethereum',
      sourceBlock: block.number,
      sourceBlockHash: block.hash,
      asOf: new Date(block.timestamp * 1_000).toISOString(),
      summary: buildBytes2BytesSummary({ walletBalance, pendingByPool, s1Citizens, s2Citizens }),
      pendingByPool,
      pendingDaoTaxByPool,
      s1Citizens,
      s2Citizens,
      directAssets,
      notes: [
        'Wallet balance is liquid Ethereum $BYTES. Bridged Avalanche $BYTES is not included.',
        'Citizen stake totals include $BYTES locked with S1 and S2 positions.',
        'Pending rewards are the contract-reported net reward values for S1 and S2 Citizens; DAO tax is reported separately.',
        'Undeposited assets are discovered through Alchemy and every displayed token owner is rechecked onchain at the pinned Ethereum block.',
      ],
    }, { headers: RESPONSE_HEADERS });
  } catch (error) {
    const safeMessage = error instanceof Error && (
      error.message.startsWith('Enter a valid') ||
      error.message.startsWith('That ENS')
    ) ? error.message : 'Wallet data is temporarily unavailable. Try again shortly.';
    return NextResponse.json({ error: safeMessage }, { status: safeMessage.startsWith('Wallet data') ? 502 : 400, headers: RESPONSE_HEADERS });
  } finally {
    provider.destroy();
  }
}
