import { NextResponse } from 'next/server';
import { getNftsForOwner } from '../_lib/alchemy-server';

const NEO_VAULT_WALLET = '0x6a1bc919e847c12725904965e05971b818b47ad0';
const NEO_CONTRACTS = {
  s1: { address: '0xb9951b43802dcf3ef5b14567cb17adf367ed1c0f', label: 'S1 Citizen' },
  s2: { address: '0x4481507cc228fa19d203bd42110d679571f7912e', label: 'S2 Outer Citizen' },
  items: { address: '0xe7489ea1847395d7eead33e9c85fe327d513d249', label: 'S1 Item Cache' },
} as const;

type NeoCountName = keyof typeof NEO_CONTRACTS;
const COLLECTION_ORDER = { s1: 0, s2: 1, items: 2 } as const;

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

export async function GET() {
  try {
    const entries = await Promise.all(
      (Object.entries(NEO_CONTRACTS) as Array<[NeoCountName, (typeof NEO_CONTRACTS)[NeoCountName]]>).map(
        async ([name, collection]) => {
          const ownedNfts = await getNftsForOwner(NEO_VAULT_WALLET, collection.address, 100, true);
          return {
            name,
            count: safeCount(ownedNfts.length),
            assets: ownedNfts.map((nft) => {
              const tokenId = cleanText(nft.tokenId);
              return {
                tokenId,
                collection: collection.label,
                name: cleanText(nft.name) || `${collection.label} #${tokenId}`,
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

    const counts = Object.fromEntries(entries.map((entry) => [entry.name, entry.count])) as Record<NeoCountName, number>;
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
    console.error('Neo Tokyo vault holdings lookup failed');
    return NextResponse.json(
      { error: 'Unable to load vault holdings right now.' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
