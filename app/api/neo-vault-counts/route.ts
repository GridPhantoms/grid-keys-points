import { NextResponse } from 'next/server';
import { getNftsForOwner } from '../_lib/alchemy-server';

const VAULT_WALLET = '0x6a1bc919e847c12725904965e05971b818b47ad0';
const NFT_COLLECTIONS = {
  s1: { address: '0xb9951b43802dcf3ef5b14567cb17adf367ed1c0f', brand: 'NEO TOKYO S1' },
  s2: { address: '0x4481507cc228fa19d203bd42110d679571f7912e', brand: 'NEO TOKYO S2' },
  items: { address: '0xe7489ea1847395d7eead33e9c85fe327d513d249', brand: 'S1 ITEM CACHE' },
  genesis: { address: '0xf26e168d053f6779f7172a1d0b0a6cd8d7446493', brand: 'GRID PHANTOMS' },
} as const;
const COATTAIL_BROKERS = { address: '0x1122db21998707f8c2ed8182734356c947fa5e98', brand: 'COATTAIL BROKERS', tokenIds: ['1381'] } as const;
const ROBINHOOD_RPC = 'https://rpc.mainnet.chain.robinhood.com/';
const OWNER_OF_SELECTOR = '6352211e';
const TOKEN_URI_SELECTOR = 'c87b56dd';
const RPC_TIMEOUT_MS = 10_000;

type EthereumNftCountName = keyof typeof NFT_COLLECTIONS;
type NftCountName = EthereumNftCountName | 'coattail';
type NftAsset = {
  tokenId: string;
  collection: string;
  name: string;
  image: string;
  openseaUrl: string;
};
type NftEntry = { name: NftCountName; count: number; assets: NftAsset[] };
const COLLECTION_ORDER = { s1: 0, s2: 1, items: 2, genesis: 3, coattail: 4 } as const;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeCount(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function imageUrl(image: { cachedUrl?: unknown; thumbnailUrl?: unknown; pngUrl?: unknown; originalUrl?: unknown } | null | undefined) {
  return cleanText(image?.cachedUrl) || cleanText(image?.thumbnailUrl) || cleanText(image?.pngUrl) || cleanText(image?.originalUrl);
}

function assetName(name: NftCountName, tokenId: string, metadataName: unknown) {
  if (name === 's1') return `Citizen #${tokenId}`;
  if (name === 's2') return `Outer Citizen #${tokenId}`;
  if (name === 'items') return cleanText(metadataName) || `Item Cache #${tokenId}`;
  if (name === 'coattail') return cleanText(metadataName) || `Coattail Broker #${tokenId}`;
  return `Genesis Key Card #${tokenId}`;
}

function tokenCallData(selector: string, tokenId: string) {
  const encodedTokenId = BigInt(tokenId).toString(16).padStart(64, '0');
  return `0x${selector}${encodedTokenId}`;
}

async function robinhoodEthCall(data: string) {
  const response = await fetch(ROBINHOOD_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: COATTAIL_BROKERS.address, data }, 'latest'],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error('Robinhood RPC request failed');
  const payload = await response.json() as { result?: unknown; error?: unknown };
  if (payload.error || typeof payload.result !== 'string' || !/^0x[0-9a-fA-F]*$/.test(payload.result)) {
    throw new Error('Robinhood RPC returned invalid data');
  }
  return payload.result;
}

function decodeAbiString(encoded: string) {
  const bytes = Buffer.from(encoded.slice(2), 'hex');
  if (bytes.length < 64) throw new Error('Invalid ABI string');
  const offset = Number(BigInt(`0x${bytes.subarray(0, 32).toString('hex')}`));
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + 32 > bytes.length) throw new Error('Invalid ABI offset');
  const length = Number(BigInt(`0x${bytes.subarray(offset, offset + 32).toString('hex')}`));
  if (!Number.isSafeInteger(length) || length < 0 || offset + 32 + length > bytes.length) throw new Error('Invalid ABI length');
  return bytes.subarray(offset + 32, offset + 32 + length).toString('utf8');
}

function parseOnchainMetadata(tokenUri: string) {
  const prefix = 'data:application/json;base64,';
  if (!tokenUri.startsWith(prefix)) throw new Error('Unsupported Coattail metadata URI');
  const metadata = JSON.parse(Buffer.from(tokenUri.slice(prefix.length), 'base64').toString('utf8')) as Record<string, unknown>;
  const image = cleanText(metadata.image);
  return {
    name: cleanText(metadata.name),
    image: image.startsWith('data:image/') || image.startsWith('https://') ? image : '',
  };
}

async function getTrackedCoattailEntry(): Promise<NftEntry> {
  const assets = (await Promise.all(COATTAIL_BROKERS.tokenIds.map(async (tokenId): Promise<NftAsset | null> => {
    const ownerResult = await robinhoodEthCall(tokenCallData(OWNER_OF_SELECTOR, tokenId));
    const owner = `0x${ownerResult.slice(-40)}`.toLowerCase();
    if (owner !== VAULT_WALLET) return null;

    const tokenUriResult = await robinhoodEthCall(tokenCallData(TOKEN_URI_SELECTOR, tokenId));
    const metadata = parseOnchainMetadata(decodeAbiString(tokenUriResult));
    return {
      tokenId,
      collection: COATTAIL_BROKERS.brand,
      name: assetName('coattail', tokenId, metadata.name),
      image: metadata.image,
      openseaUrl: `https://opensea.io/item/robinhood/${COATTAIL_BROKERS.address}/${encodeURIComponent(tokenId)}`,
    };
  }))).filter((asset): asset is NftAsset => asset !== null);

  return { name: 'coattail', count: safeCount(assets.length), assets };
}

export async function GET() {
  try {
    const ethereumEntries = (Object.entries(NFT_COLLECTIONS) as Array<[EthereumNftCountName, (typeof NFT_COLLECTIONS)[EthereumNftCountName]]>).map(
      async ([name, collection]): Promise<NftEntry> => {
        const ownedNfts = await getNftsForOwner(VAULT_WALLET, collection.address, 100, true);
        return {
          name,
          count: safeCount(ownedNfts.length),
          assets: ownedNfts.map((nft) => {
            const tokenId = cleanText(nft.tokenId);
            return {
              tokenId,
              collection: collection.brand,
              name: assetName(name, tokenId, nft.name),
              image: name === 's1' || name === 's2'
                ? `/api/citizen-terminal/image?season=${name}&tokenId=${encodeURIComponent(tokenId)}`
                : imageUrl(nft.image),
              openseaUrl: `https://opensea.io/assets/ethereum/${collection.address}/${encodeURIComponent(tokenId)}`,
            };
          }).filter((asset) => asset.tokenId),
        };
      },
    );
    const entries = await Promise.all([...ethereumEntries, getTrackedCoattailEntry()]);

    const counts = Object.fromEntries(entries.map((entry) => [entry.name, entry.count])) as Record<NftCountName, number>;
    const assets = entries
      .sort((a, b) => COLLECTION_ORDER[a.name] - COLLECTION_ORDER[b.name])
      .flatMap((entry) => entry.assets.sort((a, b) => Number(a.tokenId) - Number(b.tokenId)));
    return NextResponse.json(
      {
        ...counts,
        assets,
        source: 'alchemy_eth_and_robinhood_rpc_owner_lookup',
        readAt: new Date().toISOString(),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    console.error('Vault NFT holdings lookup failed');
    return NextResponse.json(
      { error: 'Unable to load vault holdings right now.' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
