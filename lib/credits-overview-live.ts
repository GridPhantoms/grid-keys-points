import 'server-only';
import { unstable_cache } from 'next/cache';
import statementData from '@/data/credits-statements.json';
import { normalizeOfficialCreditSnapshot, type StatementMetadata } from '@/lib/credits-intelligence';

const OFFICIAL_MARKET_URL = 'https://jack.art/credits/rating/api/market-snapshot';
const COINBASE_TICKER_URL = 'https://api.exchange.coinbase.com/products/ETH-USD/ticker';
const STATEMENTS_CONTRACT = '0x75edd94b7e49b3bd5c8047b91f165a5e265a069b';
const USER_AGENT = 'GridPhantomsCredits/1.0';
const REFRESH_SECONDS = 10 * 60;

type OpenSeaOrder = {
  price?: { current?: { currency?: string; value?: string; decimals?: number } };
  protocol_data?: { parameters?: { offer?: Array<{ token?: string; identifierOrCriteria?: string }> } };
};

export type LiveCreditsOverview = {
  snapshotAsOf: string;
  nextRefresh: string | null;
  looseListings: number;
  looseFloorEth: number;
  within25PctOfFloor: number;
  ethUsd: number;
  statementFloorEth: number;
  statementFloorCr: number;
  statementFloorTokenId: number;
  looseBasketCredits: number;
  looseBasketEth: number;
  looseBasketCr: number;
};

async function fetchJson(url: string, headers: HeadersInit = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json', 'user-agent': USER_AGENT, ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Overview source request failed (${response.status})`);
  return response.json() as Promise<unknown>;
}

function orderPriceEth(order: OpenSeaOrder) {
  const current = order.price?.current;
  if (!current || !['ETH', 'WETH'].includes(String(current.currency).toUpperCase())) return null;
  const value = Number(current.value);
  const decimals = Number(current.decimals ?? 18);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(decimals) || decimals < 0 || decimals > 30) return null;
  return value / 10 ** decimals;
}

async function fetchStatementOrders(apiKey: string) {
  let cursor: string | null = null;
  const orders: OpenSeaOrder[] = [];
  const seenCursors = new Set<string>();
  let pages = 0;
  do {
    const params = new URLSearchParams({ limit: '100' });
    if (cursor) params.set('next', cursor);
    const payload = await fetchJson(
      `https://api.opensea.io/api/v2/listings/collection/statements/all?${params}`,
      { 'x-api-key': apiKey },
    ) as { listings?: OpenSeaOrder[]; next?: string | null };
    if (!Array.isArray(payload.listings)) throw new Error('OpenSea Statement listings are unavailable');
    orders.push(...payload.listings);
    pages += 1;
    const next = typeof payload.next === 'string' && payload.next.length > 0 ? payload.next : null;
    if (next && (seenCursors.has(next) || pages >= 100)) throw new Error('OpenSea Statement pagination did not complete');
    if (next) seenCursors.add(next);
    cursor = next;
  } while (cursor);
  return orders;
}

async function loadLiveCreditsOverviewUncached(): Promise<LiveCreditsOverview> {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) throw new Error('OpenSea Statement listings are unavailable');

  const [officialPayload, tickerPayload, statementOrders] = await Promise.all([
    fetchJson(OFFICIAL_MARKET_URL),
    fetchJson(COINBASE_TICKER_URL),
    fetchStatementOrders(apiKey),
  ]);
  const ethUsd = Number((tickerPayload as { price?: string }).price);
  const normalized = normalizeOfficialCreditSnapshot(officialPayload, ethUsd);
  const looseByPrice = [...normalized.items].sort((a, b) => a.priceEth - b.priceEth || a.tokenId - b.tokenId);
  if (looseByPrice.length < 80) throw new Error('The executable 80-CREDIT basket is unavailable');
  const looseFloorEth = looseByPrice[0].priceEth;
  const looseBasket = looseByPrice.slice(0, 80);

  const metadataById = new Map((statementData.items as StatementMetadata[]).map((item) => [item.tokenId, item]));
  const lowestStatementById = new Map<number, number>();
  for (const order of statementOrders) {
    const offered = order.protocol_data?.parameters?.offer?.[0];
    if (String(offered?.token).toLowerCase() !== STATEMENTS_CONTRACT) continue;
    const tokenId = Number(offered?.identifierOrCriteria);
    const priceEth = orderPriceEth(order);
    const metadata = metadataById.get(tokenId);
    if (!Number.isInteger(tokenId) || metadata?.stage !== 'BASE' || !priceEth) continue;
    const previous = lowestStatementById.get(tokenId);
    if (previous === undefined || priceEth < previous) lowestStatementById.set(tokenId, priceEth);
  }
  const statementFloor = [...lowestStatementById]
    .map(([tokenId, priceEth]) => ({ tokenId, priceEth, metadata: metadataById.get(tokenId)! }))
    .sort((a, b) => a.priceEth - b.priceEth || a.tokenId - b.tokenId)[0];
  if (!statementFloor) throw new Error('No current Statement floor is available');

  return {
    snapshotAsOf: normalized.updatedAt ?? new Date().toISOString(),
    nextRefresh: normalized.nextRefresh,
    looseListings: looseByPrice.length,
    looseFloorEth,
    within25PctOfFloor: looseByPrice.filter((item) => item.priceEth <= looseFloorEth * 1.25).length,
    ethUsd,
    statementFloorEth: statementFloor.priceEth,
    statementFloorCr: statementFloor.metadata.creditRating,
    statementFloorTokenId: statementFloor.tokenId,
    looseBasketCredits: 80,
    looseBasketEth: looseBasket.reduce((sum, item) => sum + item.priceEth, 0),
    looseBasketCr: looseBasket.reduce((sum, item) => sum + item.creditRating, 0),
  };
}

export const loadLiveCreditsOverview = unstable_cache(
  loadLiveCreditsOverviewUncached,
  ['credits-overview-live-v2'],
  { revalidate: REFRESH_SECONDS },
);
