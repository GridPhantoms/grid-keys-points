import 'server-only';
import { unstable_cache } from 'next/cache';
import statementData from '@/data/credits-statements.json';
import { normalizeOfficialCreditSnapshot, normalizeOpenSeaStatementMetadata, type StatementMetadata } from '@/lib/credits-intelligence';

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
  sourceRefreshing: boolean;
  sourceDegraded: boolean;
  looseListings: number;
  looseFloorEth: number;
  within25PctOfFloor: number;
  ethUsd: number;
  statementAvailable: boolean;
  statementReason: string | null;
  statementOrdersCheckedAt: string | null;
  statementMetadataAsOf: string;
  statementFloorEth: number | null;
  statementFloorCr: number | null;
  statementFloorTokenId: number | null;
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

async function fetchStatementOrdersUncached() {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) throw new Error('OpenSea Statement listings are unavailable');
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
  return { orders, checkedAt: new Date().toISOString() };
}

async function fetchMissingStatementMetadata(key: string, tokenIds: number[]) {
  const metadata: StatementMetadata[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < tokenIds.length) {
      const tokenId = tokenIds[cursor];
      cursor += 1;
      const payload = await fetchJson(
        `https://api.opensea.io/api/v2/chain/ethereum/contract/${STATEMENTS_CONTRACT}/nfts/${tokenId}`,
        { 'x-api-key': key },
      );
      metadata.push(normalizeOpenSeaStatementMetadata(tokenId, payload));
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, tokenIds.length) }, () => worker()));
  return metadata;
}

const loadStatementOrders = unstable_cache(
  fetchStatementOrdersUncached,
  ['credits-statement-orders-v2'],
  { revalidate: REFRESH_SECONDS },
);

export async function loadLiveCreditsOverview(): Promise<LiveCreditsOverview> {
  const [officialPayload, tickerPayload] = await Promise.all([
    fetchJson(OFFICIAL_MARKET_URL),
    fetchJson(COINBASE_TICKER_URL),
  ]);
  const officialStatus = officialPayload as { refreshing?: boolean; error?: unknown };
  const ethUsd = Number((tickerPayload as { price?: string }).price);
  const normalized = normalizeOfficialCreditSnapshot(officialPayload, ethUsd);
  const looseByPrice = [...normalized.items].sort((a, b) => a.priceEth - b.priceEth || a.tokenId - b.tokenId);
  if (looseByPrice.length < 80) throw new Error('The executable 80-CREDIT basket is unavailable');
  const looseFloorEth = looseByPrice[0].priceEth;
  const looseBasket = looseByPrice.slice(0, 80);

  const metadata = statementData.items as StatementMetadata[];
  const metadataById = new Map(metadata.map((item) => [item.tokenId, item]));
  let statementAvailable = false;
  let statementReason: string | null = 'Current Statement orders are unavailable.';
  let statementOrdersCheckedAt: string | null = null;
  let statementFloorEth: number | null = null;
  let statementFloorCr: number | null = null;
  let statementFloorTokenId: number | null = null;

  try {
    const statementScan = await loadStatementOrders();
    statementOrdersCheckedAt = statementScan.checkedAt;
    const listedTokenIds = [...new Set(statementScan.orders.flatMap((order) => {
      const offered = order.protocol_data?.parameters?.offer?.[0];
      const tokenId = Number(offered?.identifierOrCriteria);
      return String(offered?.token).toLowerCase() === STATEMENTS_CONTRACT && Number.isInteger(tokenId) && tokenId >= 0
        ? [tokenId] : [];
    }))];
    const missingIds = listedTokenIds.filter((tokenId) => !metadataById.has(tokenId));
    if (missingIds.length > 0) {
      const apiKey = process.env.OPENSEA_API_KEY;
      if (!apiKey) throw new Error('OpenSea Statement metadata is unavailable');
      const currentMetadata = await fetchMissingStatementMetadata(apiKey, missingIds);
      for (const item of currentMetadata) metadataById.set(item.tokenId, item);
    }
    const eligibleOrders: Array<{ tokenId: number; priceEth: number; metadata: StatementMetadata }> = [];
    const listedIds = new Set<number>();
    for (const order of statementScan.orders) {
      const offered = order.protocol_data?.parameters?.offer?.[0];
      if (String(offered?.token).toLowerCase() !== STATEMENTS_CONTRACT) continue;
      const tokenId = Number(offered?.identifierOrCriteria);
      const priceEth = orderPriceEth(order);
      if (!Number.isInteger(tokenId) || tokenId < 0 || !priceEth) continue;
      listedIds.add(tokenId);
      const details = metadataById.get(tokenId);
      if (!details) throw new Error('Current Statement metadata coverage is incomplete');
      if (details.stage === 'BASE') eligibleOrders.push({ tokenId, priceEth, metadata: details });
    }
    const floor = eligibleOrders.sort((a, b) => a.priceEth - b.priceEth || a.tokenId - b.tokenId)[0];
    if (!floor || listedIds.size === 0) throw new Error('No verified current Statement floor is available');
    statementAvailable = true;
    statementReason = null;
    statementFloorEth = floor.priceEth;
    statementFloorCr = floor.metadata.creditRating;
    statementFloorTokenId = floor.tokenId;
  } catch {
    statementAvailable = false;
  }

  return {
    snapshotAsOf: normalized.updatedAt ?? new Date().toISOString(),
    nextRefresh: normalized.nextRefresh,
    sourceRefreshing: officialStatus.refreshing === true,
    sourceDegraded: typeof officialStatus.error === 'string' && officialStatus.error.length > 0,
    looseListings: looseByPrice.length,
    looseFloorEth,
    within25PctOfFloor: looseByPrice.filter((item) => item.priceEth <= looseFloorEth * 1.25).length,
    ethUsd,
    statementAvailable,
    statementReason,
    statementOrdersCheckedAt,
    statementMetadataAsOf: statementData.snapshotAsOf,
    statementFloorEth,
    statementFloorCr,
    statementFloorTokenId,
    looseBasketCredits: 80,
    looseBasketEth: looseBasket.reduce((sum, item) => sum + item.priceEth, 0),
    looseBasketCr: looseBasket.reduce((sum, item) => sum + item.creditRating, 0),
  };
}
