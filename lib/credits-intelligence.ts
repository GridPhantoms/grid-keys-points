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
const CREDITS_CONTRACT = '0x97630aa70ab14ed9883b41dafccbc11349723043';
const ORIGINAL_CREDITS_SUPPLY = 122_154;
const MAX_LISTING_AGE_MS = 24 * 60 * 60 * 1_000;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
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
    return url.protocol === 'https:' && url.hostname === 'opensea.io' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function optionalMillis(value: unknown) {
  if (value === null || value === undefined) return null;
  const milliseconds = finiteNumber(value);
  if (milliseconds === null || milliseconds <= 0) throw new Error('Official snapshot timestamp is invalid');
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) throw new Error('Official snapshot timestamp is invalid');
  return date.toISOString();
}

export function parseValueQuery(params: URLSearchParams): ValueQuery {
  const minCr = nonNegativeNumber(params.get('minCr')) ?? 0;
  const maxEthParam = params.get('maxEth');
  const maxEthRaw = maxEthParam === null || maxEthParam === '' ? null : nonNegativeNumber(maxEthParam);
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
  if (source?.complete !== true) throw new Error('Official CREDITS market snapshot is incomplete');
  if (!Array.isArray(source.items) || source.items.length === 0) throw new Error('Official rating/listing coverage is unavailable');
  if (!Number.isFinite(ethUsd) || ethUsd <= 0) throw new Error('ETH-USD price is unavailable');

  const items = source.items.map((value) => {
    const item = record(value);
    const tokenId = finiteNumber(item?.id);
    const creditRating = positiveNumber(item?.score);
    const officialRank = finiteNumber(item?.rank);
    const priceEth = positiveNumber(item?.price);
    const checkedAtMs = typeof item?.checkedAt === 'string' ? Date.parse(item.checkedAt) : Number.NaN;
    const checkedAt = Number.isFinite(checkedAtMs) && checkedAtMs <= Date.now() + 5 * 60_000
      && checkedAtMs >= Date.now() - MAX_LISTING_AGE_MS ? new Date(checkedAtMs).toISOString() : null;
    if (item?.listed !== true || item.currency !== 'ETH' || !Number.isInteger(tokenId) || tokenId! < 1
      || tokenId! > ORIGINAL_CREDITS_SUPPLY || !creditRating || !Number.isInteger(officialRank) || officialRank! <= 0
      || !priceEth || !safeOpenSeaUrl(item?.url) || !checkedAt) {
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
      url: `https://opensea.io/assets/ethereum/${CREDITS_CONTRACT}/${tokenId}`,
    };
  });

  if (new Set(items.map((item) => item.tokenId)).size !== items.length) {
    throw new Error('Official rating/listing coverage contains duplicate tokens');
  }

  return {
    items,
    updatedAt: optionalMillis(source.updatedAt),
    nextRefresh: optionalMillis(source.nextRefresh),
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

export function compareBuildAndBuyValue(input: {
  looseBasketEth: number;
  looseBasketCr: number;
  statementFloorEth: number;
  statementFloorCr: number;
}) {
  const values = [input.looseBasketEth, input.looseBasketCr, input.statementFloorEth, input.statementFloorCr];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Build versus buy inputs must be positive');
  }
  const looseEthPer1kCr = input.looseBasketEth / input.looseBasketCr * 1_000;
  const statementEthPer1kCr = input.statementFloorEth / input.statementFloorCr * 1_000;
  const cheaperMarket = looseEthPer1kCr <= statementEthPer1kCr ? 'loose' as const : 'statement' as const;
  const savingsPct = cheaperMarket === 'loose'
    ? (1 - looseEthPer1kCr / statementEthPer1kCr) * 100
    : (1 - statementEthPer1kCr / looseEthPer1kCr) * 100;
  return { looseEthPer1kCr, statementEthPer1kCr, cheaperMarket, savingsPct };
}

export function rankStatementListings(metadata: StatementMetadata[], listings: StatementListing[], ethUsd: number) {
  if (!Number.isFinite(ethUsd) || ethUsd <= 0) throw new Error('ETH-USD price is unavailable');
  const metadataById = new Map(metadata.map((item) => [item.tokenId, item]));
  if (metadataById.size !== metadata.length) throw new Error('Statement metadata contains duplicate tokens');
  const missingMetadata = listings.filter((listing) => !metadataById.has(listing.tokenId));
  if (missingMetadata.length > 0) throw new Error('Current Statement metadata coverage is incomplete');
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
