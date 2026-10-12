import { NextResponse } from 'next/server';
import statementData from '@/data/credits-statements.json';
import {
  matchingCreditListings,
  normalizeOfficialCreditSnapshot,
  parseValueQuery,
  rankStatementListings,
  type StatementListing,
  type StatementMetadata,
} from '@/lib/credits-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OFFICIAL_MARKET_URL = 'https://jack.art/credits/rating/api/market-snapshot';
const COINBASE_TICKER_URL = 'https://api.exchange.coinbase.com/products/ETH-USD/ticker';
const STATEMENTS_CONTRACT = '0x75edd94b7e49b3bd5c8047b91f165a5e265a069b';
const STATEMENTS_SLUG = 'statements';
const USER_AGENT = 'GridPhantomsCredits/1.0';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

type OpenSeaOrder = {
  order_hash?: string;
  price?: { current?: { currency?: string; value?: string; decimals?: number } };
  protocol_data?: { parameters?: { offer?: Array<{ token?: string; identifierOrCriteria?: string }> } };
};

async function fetchJson(url: string, headers: HeadersInit = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json', 'user-agent': USER_AGENT, ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Source request failed (${response.status})`);
  return response.json() as Promise<unknown>;
}

async function fetchEthUsd() {
  const payload = await fetchJson(COINBASE_TICKER_URL) as { price?: string };
  const price = Number(payload.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Coinbase ETH-USD ticker is unavailable');
  return price;
}

function orderPriceEth(order: OpenSeaOrder) {
  const current = order.price?.current;
  if (!current || !['ETH', 'WETH'].includes(String(current.currency).toUpperCase())) return null;
  const value = Number(current.value);
  const decimals = Number(current.decimals ?? 18);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(decimals) || decimals < 0 || decimals > 30) return null;
  return value / 10 ** decimals;
}

async function fetchAllStatementListings(apiKey: string): Promise<{ items: StatementListing[]; pages: number }> {
  let cursor: string | null = null;
  let pages = 0;
  const lowestByToken = new Map<number, StatementListing>();
  const seenCursors = new Set<string>();

  do {
    const params = new URLSearchParams({ limit: '100' });
    if (cursor) params.set('next', cursor);
    const payload = await fetchJson(
      `https://api.opensea.io/api/v2/listings/collection/${STATEMENTS_SLUG}/all?${params}`,
      { 'x-api-key': apiKey },
    ) as { listings?: OpenSeaOrder[]; next?: string | null };
    if (!Array.isArray(payload.listings)) throw new Error('OpenSea Statement listing scope is unavailable');
    pages += 1;
    for (const order of payload.listings) {
      const offered = order.protocol_data?.parameters?.offer?.[0];
      if (String(offered?.token).toLowerCase() !== STATEMENTS_CONTRACT) continue;
      const tokenId = Number(offered?.identifierOrCriteria);
      const priceEth = orderPriceEth(order);
      if (!Number.isInteger(tokenId) || tokenId < 0 || !priceEth) continue;
      const listing = {
        tokenId,
        priceEth,
        url: `https://opensea.io/assets/ethereum/${STATEMENTS_CONTRACT}/${tokenId}`,
      };
      const prior = lowestByToken.get(tokenId);
      if (!prior || listing.priceEth < prior.priceEth) lowestByToken.set(tokenId, listing);
    }
    const next = typeof payload.next === 'string' && payload.next.length > 0 ? payload.next : null;
    if (next && (seenCursors.has(next) || pages >= 100)) throw new Error('OpenSea Statement pagination did not complete');
    if (next) seenCursors.add(next);
    cursor = next;
  } while (cursor);

  return { items: [...lowestByToken.values()], pages };
}

export async function GET(request: Request) {
  const query = parseValueQuery(new URL(request.url).searchParams);
  try {
    const [officialPayload, ethUsd] = await Promise.all([
      fetchJson(OFFICIAL_MARKET_URL),
      fetchEthUsd(),
    ]);
    const normalized = normalizeOfficialCreditSnapshot(officialPayload, ethUsd);
    const matchingCredits = matchingCreditListings(normalized.items, query);
    const filteredCredits = matchingCredits.slice(0, query.limit);
    const fetchedAt = new Date().toISOString();

    let statements: {
      available: boolean;
      reason: string | null;
      snapshotAsOf: string;
      listingPages: number;
      items: ReturnType<typeof rankStatementListings>;
    } = {
      available: false,
      reason: 'Live Statement listings require an OpenSea API key.',
      snapshotAsOf: statementData.snapshotAsOf,
      listingPages: 0,
      items: [],
    };
    const apiKey = process.env.OPENSEA_API_KEY;
    if (apiKey) {
      try {
        const liveListings = await fetchAllStatementListings(apiKey);
        statements = {
          available: true,
          reason: null,
          snapshotAsOf: statementData.snapshotAsOf,
          listingPages: liveListings.pages,
          items: rankStatementListings(statementData.items as StatementMetadata[], liveListings.items, ethUsd),
        };
      } catch {
        statements.reason = 'Current OpenSea Statement listings are unavailable. No stale listings are shown.';
      }
    }

    return NextResponse.json({
      fetchedAt,
      ethUsd,
      query,
      credits: {
        available: true,
        source: 'Official CREDITS market snapshot',
        sourceUpdatedAt: normalized.updatedAt,
        nextRefresh: normalized.nextRefresh,
        checkedAtOldest: normalized.items.reduce<string | null>((oldest, item) => !oldest || item.checkedAt < oldest ? item.checkedAt : oldest, null),
        totalLiveListings: normalized.items.length,
        matchingListings: matchingCredits.length,
        items: filteredCredits,
      },
      statements,
      caution: 'OpenSea listings and prices may change before purchase.',
    }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({
      error: 'Live CREDITS value data is unavailable because the official snapshot or ETH-USD price could not be verified.',
      credits: { available: false, items: [] },
      statements: { available: false, items: [] },
    }, { status: 503, headers: NO_STORE_HEADERS });
  }
}
