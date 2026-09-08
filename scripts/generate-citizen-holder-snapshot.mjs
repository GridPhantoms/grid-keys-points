import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, FetchRequest, Interface, JsonRpcProvider, getAddress, id } from 'ethers';
import { buildCitizenHolderStats } from '../lib/citizen-holders.mjs';
import {
  BYTES_STAKING_CONTRACT,
  ETHEREUM_CHAIN_ID,
  MULTICALL3_CONTRACT,
  S1_CITIZEN_CONTRACT,
  S2_OUTER_CITIZEN_CONTRACT,
} from '../lib/bytes-addresses.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'data/citizen-holder-snapshot.json');
const PARTICIPANTS = resolve(ROOT, 'data/bytes-staking-participants.json');
const ALCHEMY_PAGE_SIZE = '0x3e8';
const DELTA_LOG_SPAN = 50_000;
const MULTICALL_CHUNK_SIZE = 250;
const TOP_LIMIT = 25;
const STAKING_ABI = [
  'function getStakerPositions(address staker) view returns (tuple(tuple(uint256 citizenId, uint256 stakedBytes, uint256 timelockEndTime, uint256 points, uint256 stakedVaultId, bool hasVault)[] stakedS1Citizens, tuple(uint256 citizenId, uint256 stakedBytes, uint256 timelockEndTime, uint256 points)[] stakedS2Citizens, tuple(uint256 amount, uint256 timelockEndTime, uint256 points, uint256 multiplier) stakedLPPosition))',
];
const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];
const MULTICALL_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
];
const ownerOfInterface = new Interface(['function ownerOf(uint256 tokenId) view returns (address)']);
const stakingInterface = new Interface(STAKING_ABI);
const participantTopics = [[
  id('Stake(address,address,uint256,uint256)'),
  id('Claim(address,uint256,uint256)'),
]];
const collections = {
  s1: S1_CITIZEN_CONTRACT,
  s2: S2_OUTER_CITIZEN_CONTRACT,
};

for (const envFile of ['.env.local', '.env']) {
  try { process.loadEnvFile(resolve(ROOT, envFile)); } catch {}
}

function alchemyUrl() {
  if (!process.env.ALCHEMY_API_KEY) throw new Error('Private Alchemy configuration is required.');
  return `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
}

function rpcUrl() {
  return process.env.ETHEREUM_RPC_URL || alchemyUrl();
}

async function alchemyRpc(method, params) {
  const response = await fetch(alchemyUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Alchemy ${method} returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.error) throw new Error(`Alchemy ${method} failed.`);
  return payload.result;
}

function transferTokenId(transfer) {
  const raw = transfer.erc721TokenId ?? transfer.tokenId ?? transfer.rawContract?.value;
  if (typeof raw !== 'string' || !/^(?:0x[0-9a-f]+|\d+)$/i.test(raw)) throw new Error('Indexed ERC-721 transfer omitted its token ID.');
  return BigInt(raw).toString();
}

async function collectTransferOwners(contract, toBlock) {
  const owners = new Map();
  let pageKey;
  let eventCount = 0;
  let pageCount = 0;
  do {
    const request = {
      fromBlock: '0x0',
      toBlock: `0x${toBlock.toString(16)}`,
      contractAddresses: [contract],
      category: ['erc721'],
      withMetadata: false,
      excludeZeroValue: false,
      maxCount: ALCHEMY_PAGE_SIZE,
      order: 'asc',
    };
    if (pageKey) request.pageKey = pageKey;
    const result = await alchemyRpc('alchemy_getAssetTransfers', [request]);
    if (!Array.isArray(result?.transfers)) throw new Error('Alchemy returned a malformed ERC-721 transfer page.');
    for (const transfer of result.transfers) {
      const tokenId = transferTokenId(transfer);
      if (!transfer.to || transfer.to.toLowerCase() === '0x0000000000000000000000000000000000000000') owners.delete(tokenId);
      else owners.set(tokenId, getAddress(transfer.to));
      eventCount += 1;
    }
    pageKey = result.pageKey;
    pageCount += 1;
  } while (pageKey);
  return { owners, eventCount, pageCount };
}

async function collectParticipants(provider, sourceBlock) {
  const snapshot = JSON.parse(await readFile(PARTICIPANTS, 'utf8'));
  if (!Array.isArray(snapshot.addresses) || !Number.isSafeInteger(snapshot.sourceBlock)) throw new Error('Participant snapshot is malformed.');
  const participants = new Map(snapshot.addresses.map((address) => [address.toLowerCase(), getAddress(address)]));
  let deltaEventCount = 0;
  for (let start = snapshot.sourceBlock + 1; start <= sourceBlock; start += DELTA_LOG_SPAN) {
    const logs = await provider.getLogs({
      address: BYTES_STAKING_CONTRACT,
      topics: participantTopics,
      fromBlock: start,
      toBlock: Math.min(sourceBlock, start + DELTA_LOG_SPAN - 1),
    });
    deltaEventCount += logs.length;
    for (const log of logs) {
      const topic = log.topics[1];
      if (typeof topic !== 'string' || topic.length !== 66) throw new Error('Malformed staking participant topic.');
      const address = getAddress(`0x${topic.slice(26)}`);
      participants.set(address.toLowerCase(), address);
    }
  }
  return { participants: [...participants.values()], baselineBlock: snapshot.sourceBlock, deltaEventCount };
}

async function readStakedOwners(multicall, participants, blockNumber) {
  const result = { s1: new Map(), s2: new Map() };
  const calls = participants.map((address) => ({
    target: BYTES_STAKING_CONTRACT,
    allowFailure: false,
    callData: stakingInterface.encodeFunctionData('getStakerPositions', [address]),
  }));
  for (let start = 0; start < calls.length; start += MULTICALL_CHUNK_SIZE) {
    const chunk = calls.slice(start, start + MULTICALL_CHUNK_SIZE);
    const responses = await multicall.aggregate3.staticCall(chunk, { blockTag: blockNumber });
    responses.forEach((response, index) => {
      if (!response.success) throw new Error('A staker-position read failed.');
      const [positions] = stakingInterface.decodeFunctionResult('getStakerPositions', response.returnData);
      const owner = participants[start + index];
      for (const position of positions.stakedS1Citizens) {
        const tokenId = position.citizenId.toString();
        if (result.s1.has(tokenId)) throw new Error(`Duplicate S1 staking position ${tokenId}.`);
        result.s1.set(tokenId, owner);
      }
      for (const position of positions.stakedS2Citizens) {
        const tokenId = position.citizenId.toString();
        if (result.s2.has(tokenId)) throw new Error(`Duplicate S2 staking position ${tokenId}.`);
        result.s2.set(tokenId, owner);
      }
    });
  }
  return result;
}

async function verifyOwners(multicall, contract, owners, blockNumber) {
  const entries = [...owners.entries()];
  for (let start = 0; start < entries.length; start += MULTICALL_CHUNK_SIZE) {
    const chunk = entries.slice(start, start + MULTICALL_CHUNK_SIZE);
    const responses = await multicall.aggregate3.staticCall(chunk.map(([tokenId]) => ({
      target: contract,
      allowFailure: false,
      callData: ownerOfInterface.encodeFunctionData('ownerOf', [tokenId]),
    })), { blockTag: blockNumber });
    responses.forEach((response, index) => {
      if (!response.success) throw new Error('A Citizen ownerOf verification failed.');
      const [actual] = ownerOfInterface.decodeFunctionResult('ownerOf', response.returnData);
      if (getAddress(actual) !== chunk[index][1]) throw new Error(`Indexed owner mismatch for Citizen ${chunk[index][0]}.`);
    });
  }
  return entries.length;
}

function ownershipDigest(stats) {
  const rows = stats.top.map((row) => `${row.rank}:${row.address.toLowerCase()}:${row.count}:${row.held}:${row.staked}`);
  return createHash('sha256').update(rows.join('\n')).digest('hex');
}

async function main() {
  const transport = new FetchRequest(rpcUrl());
  transport.timeout = 30_000;
  const provider = new JsonRpcProvider(transport, ETHEREUM_CHAIN_ID, { staticNetwork: true });
  try {
    const [network, block] = await Promise.all([provider.getNetwork(), provider.getBlock('finalized')]);
    if (network.chainId !== BigInt(ETHEREUM_CHAIN_ID) || !block?.hash) throw new Error('Finalized Ethereum source is unavailable.');
    const multicall = new Contract(MULTICALL3_CONTRACT, MULTICALL_ABI, provider);
    const [s1Transfers, s2Transfers, participantData] = await Promise.all([
      collectTransferOwners(S1_CITIZEN_CONTRACT, block.number),
      collectTransferOwners(S2_OUTER_CITIZEN_CONTRACT, block.number),
      collectParticipants(provider, block.number),
    ]);
    const stakedOwners = await readStakedOwners(multicall, participantData.participants, block.number);
    const seasonData = {};
    const verification = {};
    for (const season of ['s1', 's2']) {
      const contract = collections[season];
      const transferData = season === 's1' ? s1Transfers : s2Transfers;
      const nft = new Contract(contract, ERC721_ABI, provider);
      const [supplyRaw, custodyRaw, ownerOfVerified] = await Promise.all([
        nft.totalSupply({ blockTag: block.number }),
        nft.balanceOf(BYTES_STAKING_CONTRACT, { blockTag: block.number }),
        verifyOwners(multicall, contract, transferData.owners, block.number),
      ]);
      const supply = Number(supplyRaw);
      const custody = Number(custodyRaw);
      if (!Number.isSafeInteger(supply) || !Number.isSafeInteger(custody)) throw new Error('Citizen supply exceeds the safe integer range.');
      const stats = buildCitizenHolderStats({
        directOwners: transferData.owners,
        stakedOwners: stakedOwners[season],
        stakingContract: BYTES_STAKING_CONTRACT,
        supply,
        topLimit: TOP_LIMIT,
      });
      if (custody !== stats.stakedTokens) throw new Error(`${season.toUpperCase()} staking balance does not match active positions.`);
      seasonData[season] = { ...stats, topDigestSha256: ownershipDigest(stats) };
      verification[season] = {
        transferEvents: transferData.eventCount,
        transferPages: transferData.pageCount,
        reconstructedTokens: transferData.owners.size,
        ownerOfVerified,
        stakingCustody: custody,
        activePositions: stakedOwners[season].size,
      };
    }
    const confirmed = await provider.getBlock(block.number);
    if (!confirmed?.hash || confirmed.hash !== block.hash) throw new Error('Ethereum source block changed during collection.');
    const output = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: { chainId: ETHEREUM_CHAIN_ID, blockNumber: block.number, blockHash: block.hash, asOf: new Date(block.timestamp * 1_000).toISOString() },
      methodology: 'Current V2 Citizen ownership reconstructed from chronological ERC-721 transfers, verified token-by-token with ownerOf at one finalized block, then NeoTokyoStaker custody replaced with the originating wallet from active getStakerPositions records. Addresses are deduplicated per season; one person using multiple addresses remains multiple owners.',
      contracts: { s1: S1_CITIZEN_CONTRACT, s2: S2_OUTER_CITIZEN_CONTRACT, staker: BYTES_STAKING_CONTRACT },
      participantIndex: { baselineBlock: participantData.baselineBlock, addressesChecked: participantData.participants.length, deltaEvents: participantData.deltaEventCount },
      verification,
      seasons: seasonData,
    };
    await mkdir(dirname(OUTPUT), { recursive: true });
    const temporary = `${OUTPUT}.tmp`;
    await writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`);
    await rename(temporary, OUTPUT);
    console.log(`Wrote Citizen holder snapshot at block ${block.number.toLocaleString('en-US')}: S1 ${seasonData.s1.uniqueOwners.toLocaleString('en-US')} owners, S2 ${seasonData.s2.uniqueOwners.toLocaleString('en-US')} owners.`);
  } finally {
    provider.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Citizen holder snapshot generation failed.');
  process.exitCode = 1;
});
