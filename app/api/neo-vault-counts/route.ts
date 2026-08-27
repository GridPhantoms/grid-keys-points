import { NextResponse } from 'next/server';
import { getNftsForOwner } from '../_lib/alchemy-server';

const VAULT_WALLET = '0x6a1bc919e847c12725904965e05971b818b47ad0';
const NFT_COLLECTIONS = {
  s1: { address: '0xb9951b43802dcf3ef5b14567cb17adf367ed1c0f', brand: 'NEO TOKYO S1' },
  s2: { address: '0x4481507cc228fa19d203bd42110d679571f7912e', brand: 'NEO TOKYO S2' },
  items: { address: '0xe7489ea1847395d7eead33e9c85fe327d513d249', brand: 'S1 ITEM CACHE' },
  genesis: { address: '0xf26e168d053f6779f7172a1d0b0a6cd8d7446493', brand: 'GRID PHANTOMS' },
} as const;

type NftCountName = keyof typeof NFT_COLLECTIONS;
const COLLECTION_ORDER = { s1: 0, s2: 1, items: 2, genesis: 3 } as const;

export const dynamic = 'force-dynamic';

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
  return `Genesis Key Card #${tokenId}`;
}

export async function GET() {
  try {
    const entries = await Promise.all(
      (Object.entries(NFT_COLLECTIONS) as Array<[NftCountName, (typeof NFT_COLLECTIONS)[NftCountName]]>).map(
        async ([name, collection]) => {
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
      ),
    );

    const counts = Object.fromEntries(entries.map((entry) => [entry.name, entry.count])) as Record<NftCountName, number>;
    const assets = entries
      .sort((a, b) => COLLECTION_ORDER[a.name] - COLLECTION_ORDER[b.name])
      .flatMap((entry) => entry.assets.sort((a, b) => Number(a.tokenId) - Number(b.tokenId)));
    return NextResponse.json(
      {
        ...counts,
        assets,
        source: 'alchemy_nft_owner_lookup',
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
