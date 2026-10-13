export type CreditSort = 'best-value' | 'lowest-price' | 'highest-cr';

export type ValueQuery = {
  minCr: number;
  maxEth: number | null;
  sort: CreditSort;
  limit: 25 | 50 | 100;
};

export type CreditListing = {
  tokenId: number;
  creditRating: number;
  officialRank: number;
  priceEth: number;
  priceUsd: number;
  ethPer1kCr: number;
  checkedAt: string;
  url: string;
};

export type FreshCreditListing = {
  tokenId: number;
  priceEth: number;
};

export type StatementMetadata = {
  tokenId: number;
  format: string;
  stage: string;
  credits: number;
  layers: number;
  creditRating: number;
};

export type StatementListing = {
  tokenId: number;
  priceEth: number;
  url: string;
};

export type RankedStatement = StatementMetadata & StatementListing & {
  priceUsd: number;
  ethPer1kCr: number;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function finiteNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumber(value: unknown) {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function nonNegativeNumber(value: unknown) {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function safeOpenSeaUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'opensea.io' || url.hostname.endsWith('.opensea.io')) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseValueQuery(params: URLSearchParams): ValueQuery {
  const minCr = nonNegativeNumber(params.get('minCr')) ?? 0;
  const maxEthRaw = positiveNumber(params.get('maxEth'));
  const requestedSort = params.get('sort');
  const sort: CreditSort = requestedSort === 'lowest-price' || requestedSort === 'highest-cr' || requestedSort === 'best-value'
    ? requestedSort
    : 'best-value';
  const requestedLimit = Number(params.get('limit'));
  const limit: 25 | 50 | 100 = requestedLimit === 25 || requestedLimit === 100 ? requestedLimit : 50;
  return {
    minCr: Math.min(minCr, 1_000_000),
    maxEth: maxEthRaw === null ? null : Math.min(maxEthRaw, 10_000),
    sort,
    limit,
  };
}

export function normalizeOfficialCreditSnapshot(payload: unknown, ethUsd: number) {
  const source = record(payload);
  if (!source?.complete) throw new Error('Official CREDITS market snapshot is incomplete');
  if (!Array.isArray(source.items) || source.items.length === 0) throw new Error('Official rating/listing coverage is unavailable');
  if (!Number.isFinite(ethUsd) || ethUsd <= 0) throw new Error('ETH-USD price is unavailable');

  const items = source.items.map((value) => {
    const item = record(value);
    const tokenId = finiteNumber(item?.id);
    const creditRating = positiveNumber(item?.score);
    const officialRank = finiteNumber(item?.rank);
    const priceEth = positiveNumber(item?.price);
    const url = safeOpenSeaUrl(item?.url);
    const checkedAt = typeof item?.checkedAt === 'string' && Number.isFinite(Date.parse(item.checkedAt)) ? item.checkedAt : null;
    if (!item?.listed || item.currency !== 'ETH' || !Number.isInteger(tokenId) || tokenId! < 0 || !creditRating
      || !Number.isInteger(officialRank) || officialRank! <= 0 || !priceEth || !url || !checkedAt) {
      throw new Error('Official rating/listing coverage is unavailable');
    }
    return {
      tokenId: tokenId!,
      creditRating,
      officialRank: officialRank!,
      priceEth,
      priceUsd: priceEth * ethUsd,
      ethPer1kCr: priceEth / (creditRating / 1_000),
      checkedAt,
      url,
    };
  });

  if (new Set(items.map((item) => item.tokenId)).size !== items.length) {
    throw new Error('Official rating/listing coverage contains duplicate tokens');
  }

  const updatedAtNumber = finiteNumber(source.updatedAt);
  const nextRefreshNumber = finiteNumber(source.nextRefresh);
  return {
    items,
    updatedAt: updatedAtNumber === null ? null : new Date(updatedAtNumber).toISOString(),
    nextRefresh: nextRefreshNumber === null ? null : new Date(nextRefreshNumber).toISOString(),
  };
}

export function matchingCreditListings(items: CreditListing[], query: ValueQuery) {
  const rows = items.filter((item) => item.creditRating >= query.minCr && (query.maxEth === null || item.priceEth <= query.maxEth));
  rows.sort((a, b) => {
    if (query.sort === 'lowest-price') return a.priceEth - b.priceEth || a.tokenId - b.tokenId;
    if (query.sort === 'highest-cr') return b.creditRating - a.creditRating || a.tokenId - b.tokenId;
    return a.ethPer1kCr - b.ethPer1kCr || a.tokenId - b.tokenId;
  });
  return rows;
}

export function filterCreditListings(items: CreditListing[], query: ValueQuery) {
  return matchingCreditListings(items, query).slice(0, query.limit);
}

export function reconcileFreshCreditListings(
  candidates: CreditListing[],
  freshListings: FreshCreditListing[],
  ethUsd: number,
  checkedAt: string,
) {
  if (!Number.isFinite(ethUsd) || ethUsd <= 0) throw new Error('ETH-USD price is unavailable');
  if (!Number.isFinite(Date.parse(checkedAt))) throw new Error('Fresh listing timestamp is unavailable');
  const priceByToken = new Map(freshListings.flatMap((listing) => (
    Number.isInteger(listing.tokenId) && listing.tokenId >= 0 && Number.isFinite(listing.priceEth) && listing.priceEth > 0
      ? [[listing.tokenId, listing.priceEth] as const]
      : []
  )));
  return candidates.flatMap((item) => {
    const priceEth = priceByToken.get(item.tokenId);
    if (!priceEth) return [];
    return [{
      ...item,
      priceEth,
      priceUsd: priceEth * ethUsd,
      ethPer1kCr: priceEth / (item.creditRating / 1_000),
      checkedAt,
    }];
  });
}

export function rankStatementListings(metadata: StatementMetadata[], listings: StatementListing[], ethUsd: number) {
  if (!Number.isFinite(ethUsd) || ethUsd <= 0) throw new Error('ETH-USD price is unavailable');
  const metadataById = new Map(metadata.map((item) => [item.tokenId, item]));
  return listings.flatMap((listing) => {
    const details = metadataById.get(listing.tokenId);
    if (!details || !Number.isFinite(listing.priceEth) || listing.priceEth <= 0 || !safeOpenSeaUrl(listing.url)
      || !Number.isFinite(details.creditRating) || details.creditRating <= 0) return [];
    return [{
      ...details,
      ...listing,
      priceUsd: listing.priceEth * ethUsd,
      ethPer1kCr: listing.priceEth / (details.creditRating / 1_000),
    }];
  }).sort((a, b) => a.ethPer1kCr - b.ethPer1kCr || a.tokenId - b.tokenId).slice(0, 10);
}
