import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import statementData from '@/data/credits-statements.json';
import {
  matchingCreditListings,
  normalizeOpenSeaStatementMetadata,
  normalizeOfficialCreditSnapshot,
  parseValueQuery,
  reconcileFreshCreditListings,
  rankStatementListings,
  type CreditListing,
  type FreshCreditListing,
  type StatementListing,
  type StatementMetadata,
} from '@/lib/credits-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OFFICIAL_MARKET_URL = 'https://jack.art/credits/rating/api/market-snapshot';
const COINBASE_TICKER_URL = 'https://api.exchange.coinbase.com/products/ETH-USD/ticker';
const CREDITS_SLUG = 'credits';
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

type OpenSeaApiKey = string;

async function fetchBestCreditListingUncached(tokenId: number): Promise<{ checkedAt: string; value: FreshCreditListing | null }> {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) throw new Error('Current OpenSea listing validation is unavailable');
  const response = await fetch(
    `https://api.opensea.io/api/v2/listings/collection/${CREDITS_SLUG}/nfts/${tokenId}/best`,
    {
      cache: 'no-store',
      headers: { accept: 'application/json', 'user-agent': USER_AGENT, 'x-api-key': apiKey, 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (response.status === 404) {
    return { checkedAt: new Date().toISOString(), value: null };
  }
  if (!response.ok) throw new Error(`OpenSea current-listing check failed (${response.status})`);
  const order = await response.json() as OpenSeaOrder;
  const priceEth = orderPriceEth(order);
  const value = priceEth ? { tokenId, priceEth } : null;
  return { checkedAt: new Date().toISOString(), value };
}

const fetchBestCreditListingCached = unstable_cache(
  fetchBestCreditListingUncached,
  ['credits-auto-opensea-token-v1'],
  { revalidate: 60 },
);

async function revalidateCreditCandidates(candidates: CreditListing[], bypassCache: boolean) {
  const freshListings: FreshCreditListing[] = [];
  const checkedTimes: string[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor];
      cursor += 1;
      const result = await (bypassCache ? fetchBestCreditListingUncached(candidate.tokenId) : fetchBestCreditListingCached(candidate.tokenId));
      checkedTimes.push(result.checkedAt);
      if (result.value) freshListings.push(result.value);
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, candidates.length) }, () => worker()));
  return { freshListings, checkedAt: checkedTimes.sort()[0] ?? new Date().toISOString() };
}

async function fetchAllStatementListings(apiKey: OpenSeaApiKey): Promise<{ items: StatementListing[]; pages: number; checkedAt: string }> {
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

  return { items: [...lowestByToken.values()], pages, checkedAt: new Date().toISOString() };
}

async function fetchMissingStatementMetadata(apiKey: OpenSeaApiKey, tokenIds: number[]) {
  const metadata: StatementMetadata[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < tokenIds.length) {
      const tokenId = tokenIds[cursor];
      cursor += 1;
      const payload = await fetchJson(
        `https://api.opensea.io/api/v2/chain/ethereum/contract/${STATEMENTS_CONTRACT}/nfts/${tokenId}`,
        { 'x-api-key': apiKey },
      );
      metadata.push(normalizeOpenSeaStatementMetadata(tokenId, payload));
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, tokenIds.length) }, () => worker()));
  return metadata;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const query = parseValueQuery(requestUrl.searchParams);
  const validationMode = requestUrl.searchParams.get('refresh');
  const forceFresh = validationMode === 'auto' || validationMode === 'manual';
  try {
    const [officialPayload, ethUsd] = await Promise.all([
      fetchJson(OFFICIAL_MARKET_URL),
      fetchEthUsd(),
    ]);
    const normalized = normalizeOfficialCreditSnapshot(officialPayload, ethUsd);
    const snapshotMatches = matchingCreditListings(normalized.items, query);
    let matchingCredits = snapshotMatches;
    let freshValidatedAt: string | null = null;
    let freshCandidatesChecked = 0;
    const apiKey = process.env.OPENSEA_API_KEY;
    if (forceFresh) {
      if (!apiKey) throw new Error('Current OpenSea listing validation is unavailable');
      const validationBudget = Math.min(snapshotMatches.length, query.limit + 75);
      const candidates: CreditListing[] = [];
      const freshListings: FreshCreditListing[] = [];
      const validationTimes: string[] = [];
      for (let start = 0; start < validationBudget; start += 25) {
        const batch = snapshotMatches.slice(start, Math.min(start + 25, validationBudget));
        candidates.push(...batch);
        const validation = await revalidateCreditCandidates(batch, validationMode === 'manual');
        freshListings.push(...validation.freshListings);
        validationTimes.push(validation.checkedAt);
        const currentlyValid = matchingCreditListings(
          reconcileFreshCreditListings(candidates, freshListings, ethUsd, new Date().toISOString()),
          query,
        );
        if (currentlyValid.length >= query.limit) break;
      }
      freshValidatedAt = validationTimes.sort()[0] ?? new Date().toISOString();
      freshCandidatesChecked = candidates.length;
      matchingCredits = matchingCreditListings(
        reconcileFreshCreditListings(candidates, freshListings, ethUsd, freshValidatedAt),
        query,
      );
    }
    const filteredCredits = matchingCredits.slice(0, query.limit);

    let statements: {
      available: boolean;
      reason: string | null;
      snapshotAsOf: string;
      listingPages: number;
      listingCheckedAt: string | null;
      metadataCoverage: { matched: number; listed: number };
      items: ReturnType<typeof rankStatementListings>;
    } = {
      available: false,
      reason: 'Live Statement listings require an OpenSea API key.',
      snapshotAsOf: statementData.snapshotAsOf,
      listingPages: 0,
      listingCheckedAt: null,
      metadataCoverage: { matched: 0, listed: 0 },
      items: [],
    };
    if (apiKey) {
      try {
        const liveListings = await fetchAllStatementListings(apiKey);
        const baselineMetadata = statementData.items as StatementMetadata[];
        const metadataIds = new Set(baselineMetadata.map((item) => item.tokenId));
        const missingIds = liveListings.items
          .map((item) => item.tokenId)
          .filter((tokenId) => !metadataIds.has(tokenId));
        const currentMetadata = await fetchMissingStatementMetadata(apiKey, missingIds);
        const completeMetadata = [...baselineMetadata, ...currentMetadata];
        const ranked = rankStatementListings(completeMetadata, liveListings.items, ethUsd);
        statements = {
          available: true,
          reason: null,
          snapshotAsOf: statementData.snapshotAsOf,
          listingPages: liveListings.pages,
          listingCheckedAt: liveListings.checkedAt,
          metadataCoverage: { matched: liveListings.items.length, listed: liveListings.items.length },
          items: ranked,
        };
      } catch {
        statements.reason = 'Current OpenSea Statement listings are unavailable. No stale listings are shown.';
      }
    }

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      ethUsd,
      query,
      credits: {
        available: true,
        source: 'Official CREDITS market snapshot',
        sourceUpdatedAt: normalized.updatedAt,
        nextRefresh: normalized.nextRefresh,
        checkedAtOldest: normalized.items.reduce<string | null>((oldest, item) => !oldest || item.checkedAt < oldest ? item.checkedAt : oldest, null),
        totalLiveListings: normalized.items.length,
        matchingListings: forceFresh ? matchingCredits.length : snapshotMatches.length,
        snapshotMatchingListings: snapshotMatches.length,
        freshValidatedAt,
        freshCandidatesChecked,
        validationScopeComplete: forceFresh ? freshCandidatesChecked >= snapshotMatches.length : false,
        moreCandidatesRemain: forceFresh ? freshCandidatesChecked < snapshotMatches.length : snapshotMatches.length > query.limit,
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
