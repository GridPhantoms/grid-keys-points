import { NextResponse } from 'next/server';
import { CITIZEN_COLLECTIONS } from '@/lib/citizen-terminal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPEN_SEA_UA = 'Mozilla/5.0 (compatible; GridPhantomsCitizenTerminal/1.0)';
const OPEN_SEA_ITEMS_HASH = '33a4c321d0c7bc7775c92efcf80e2ae3738322e8427401448eaecd4d09b90454';

function splitSetCookies(value: string) {
  return value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((cookie) => cookie.trim());
}

async function ntHeaders() {
  const response = await fetch('https://neotokyo.codes/api/auth/get-csrf-token', {
    headers: { accept: 'application/json', 'user-agent': 'GridPhantomsCitizenTerminal/1.0' },
    cache: 'no-store',
  });
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = getSetCookie ? getSetCookie.call(response.headers) : splitSetCookies(response.headers.get('set-cookie') ?? '');
  const cookies = setCookies
    .map((cookie) => cookie.split(';', 1)[0])
    .filter((cookie) => cookie && cookie.slice(cookie.indexOf('=') + 1).length > 0);
  const csrf = cookies.find((cookie) => cookie.includes('_sAntiCsrfToken='))?.split('=', 2)[1];
  const publicToken = cookies.find((cookie) => cookie.includes('_sPublicDataToken='))?.split('=', 2)[1];
  if (!csrf || !publicToken) throw new Error('Neo Tokyo rank session unavailable');
  return {
    'content-type': 'application/json', accept: 'application/json', origin: 'https://neotokyo.codes',
    referer: 'https://neotokyo.codes/assembler', 'user-agent': 'GridPhantomsCitizenTerminal/1.0',
    'anti-csrf': csrf, 'public-data-token': publicToken, cookie: cookies.join('; '),
  };
}

async function s1Rankings() {
  const headers = await ntHeaders();
  const response = await fetch('https://neotokyo.codes/api/rpc/getRankings', {
    method: 'POST', headers, body: JSON.stringify({ params: {} }), cache: 'no-store',
  });
  const payload = await response.json() as { result?: { rankings?: Array<{ tokenId: string; rarityMonRank: number; rarityMonScore: number }> } };
  if (!response.ok || !payload.result?.rankings) throw new Error('Neo Tokyo rankings unavailable');
  return payload.result.rankings;
}

async function openSeaListings(collectionSlug: string, limit: number) {
  const variables = {
    address: '0x0000000000000000000000000000000000000000',
    collectionSlug,
    limit,
    sort: { by: 'PRICE', direction: 'ASC' },
  };
  const extensions = { persistedQuery: { sha256Hash: OPEN_SEA_ITEMS_HASH, version: 1 } };
  const params = new URLSearchParams({
    app_id: 'os2-web',
    operationName: 'CollectionItemsListQuery',
    variables: JSON.stringify(variables),
    extensions: JSON.stringify(extensions),
  });
  const response = await fetch(`https://gql.opensea.io/graphql?${params}`, {
    headers: {
      accept: 'application/json',
      'user-agent': OPEN_SEA_UA,
      referer: `https://opensea.io/collection/${collectionSlug}`,
      origin: 'https://opensea.io',
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`OpenSea listing feed unavailable (${response.status})`);
  const payload = await response.json() as {
    data?: { collectionItems?: { items?: Array<{
      tokenId?: string;
      name?: string;
      imageUrl?: string;
      bestListing?: { pricePerItem?: { usd?: number; token?: { unit?: number; symbol?: string } }; marketplace?: { identifier?: string } } | null;
      attributes?: Array<{ traitType?: string; value?: string }>;
    }> } };
  };
  return payload.data?.collectionItems?.items ?? [];
}

export async function GET() {
  try {
    const [listingRows, listings, rankings] = await Promise.all([
      Promise.all(CITIZEN_COLLECTIONS.map(async (collection) => ({ collection, listings: await openSeaListings(collection.slug, 20) }))),
      openSeaListings('neotokyo-citizens', 50),
      s1Rankings(),
    ]);

    const ranks = new Map(rankings.map((row) => [row.tokenId, row]));
    const activeListings = listings.filter((item) => item.tokenId && item.bestListing?.pricePerItem?.token?.unit != null);
    const eliteListings = activeListings
      .map((item) => {
        const rank = ranks.get(item.tokenId!);
        const rewardRate = item.attributes?.find((attribute) => attribute.traitType === 'Reward Rate')?.value ?? null;
        return rank && rank.rarityMonRank <= 500 ? {
          tokenId: item.tokenId,
          name: item.name ?? `Citizen #${item.tokenId}`,
          imageUrl: item.imageUrl ?? null,
          rank: rank.rarityMonRank,
          rarityScore: rank.rarityMonScore,
          priceEth: item.bestListing?.pricePerItem?.token?.unit ?? null,
          priceUsd: item.bestListing?.pricePerItem?.usd ?? null,
          marketplace: item.bestListing?.marketplace?.identifier ?? 'opensea',
          rewardRate,
          url: `https://opensea.io/item/ethereum/0xb9951b43802dcf3ef5b14567cb17adf367ed1c0f/${item.tokenId}`,
        } : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => (a.priceEth ?? Infinity) - (b.priceEth ?? Infinity));

    const firstPriced = activeListings.find((item) => item.bestListing?.pricePerItem?.usd && item.bestListing?.pricePerItem?.token?.unit);
    const ethUsd = firstPriced
      ? Number(firstPriced.bestListing!.pricePerItem!.usd) / Number(firstPriced.bestListing!.pricePerItem!.token!.unit)
      : null;

    return NextResponse.json({
      asOf: new Date().toISOString(),
      ethUsd,
      collections: [
        ...listingRows.map(({ collection, listings: collectionListings }) => {
          const listed = collectionListings.find((item) => item.bestListing?.pricePerItem?.token?.unit != null);
          return {
            ...collection,
            floorEth: listed?.bestListing?.pricePerItem?.token?.unit ?? null,
            floorSymbol: listed?.bestListing?.pricePerItem?.token?.symbol ?? 'ETH',
            owners: null,
            sales24h: null,
            url: `https://opensea.io/collection/${collection.slug}`,
          };
        }),
        {
          key: 's1-elite', season: 'S1', label: 'Elite Citizens', slug: 'neotokyo-citizens',
          contract: '0xB9951B43802dCF3ef5b14567cb17adF367ed1c0F',
          floorEth: eliteListings[0]?.priceEth ?? null, floorSymbol: 'ETH', owners: null, sales24h: null,
          url: 'https://opensea.io/collection/neotokyo-citizens',
        },
      ],
      s1ListingCount: activeListings.length < 50 ? activeListings.length : '50+',
      eliteListings,
      notes: [
        'Elite means a current S1 rarity rank of 500 or better.',
        'Floors are the lowest executable OpenSea listings returned by the current price-sorted listing feed.',
        'Floor and listing data are live OpenSea references and can change before a transaction confirms.',
      ],
      sources: ['OpenSea current listing feed', 'NeoTokyo.codes Citizen rankings'],
    }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Citizen market data failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
