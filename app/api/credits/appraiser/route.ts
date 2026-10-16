import { NextResponse } from 'next/server';
import { FetchRequest, JsonRpcProvider, getAddress, isAddress } from 'ethers';
import statementData from '@/data/credits-statements.json';
import { fetchEthUsdQuote } from '@/lib/eth-usd';
import {
  matchingCreditListings,
  normalizeOfficialCreditSnapshot,
  normalizeOpenSeaStatementMetadata,
  type StatementMetadata,
} from '@/lib/credits-intelligence';
import {
  BENCHMARK_MIN_SAMPLE_SIZE,
  BENCHMARK_SAMPLE_SIZE,
  STATEMENTS_CONTRACT,
  buildAskBenchmark,
  buildWalletAppraisal,
  normalizeOwnedNftPage,
  normalizeRatedWalletPage,
  selectHighestRatedCredits,
  type OwnedCredit,
  type VerifiedAsk,
} from '@/lib/credits-wallet-appraisal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OFFICIAL_MARKET_URL = 'https://jack.art/credits/rating/api/market-snapshot';
const OFFICIAL_WALLET_URL = 'https://jack.art/credits/rating/api/wallet';
const OPEN_SEA_BASE = 'https://api.opensea.io/api/v2';
const USER_AGENT = 'GridPhantomsCreditsAppraiser/1.2';
const MAX_WALLET_INPUT = 128;
const MAX_OWNED_CREDITS = 1_000;
const MAX_DISPLAYED_CREDITS = 100;
const MAX_OWNED_STATEMENTS = 100;
const MAX_OWNER_PAGES = 10;
const OWNER_PAGE_DELAY_MS = 1_100;
const BENCHMARK_CANDIDATES = 125;
const BENCHMARK_BATCH_SIZE = 25;
const FLOOR_CANDIDATES = 25;
const RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, noimageindex',
};

type UnknownRecord = Record<string, unknown>;
type OpenSeaOrder = {
  price?: { current?: { currency?: string; value?: string; decimals?: number } };
  protocol_data?: { parameters?: { offer?: Array<{ token?: string; identifierOrCriteria?: string }> } };
};

class PublicError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: RESPONSE_HEADERS });
}

async function fetchJson(url: string, headers: HeadersInit = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json', 'user-agent': USER_AGENT, ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Source request failed (${response.status})`);
  return response.json() as Promise<unknown>;
}

function rpcUrl() {
  if (process.env.ETHEREUM_RPC_URL) return process.env.ETHEREUM_RPC_URL;
  if (process.env.ALCHEMY_API_KEY) return `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  return null;
}

async function resolveWallet(input: string) {
  if (isAddress(input)) return { wallet: getAddress(input), ens: null };
  if (!/^(?=.{3,128}$)[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(input)) {
    throw new PublicError(400, 'Enter a valid Ethereum address or ENS name.');
  }
  const url = rpcUrl();
  if (!url) throw new PublicError(503, 'ENS lookup is temporarily unavailable. Try a wallet address instead.');
  const transport = new FetchRequest(url);
  transport.timeout = 12_000;
  const provider = new JsonRpcProvider(transport, 1, { staticNetwork: true });
  try {
    const chainId = await provider.send('eth_chainId', []);
    if (chainId !== '0x1') throw new Error('Ethereum RPC chain mismatch');
    const resolved = await provider.resolveName(input);
    if (!resolved) throw new PublicError(422, 'That ENS name did not resolve to an Ethereum wallet.');
    return { wallet: getAddress(resolved), ens: input };
  } finally {
    provider.destroy();
  }
}

async function fetchRatedWalletCredits(wallet: string) {
  const credits: OwnedCredit[] = [];
  const seenTokens = new Set<number>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const params = new URLSearchParams({ v: 'filter-traits', address: wallet });
    if (cursor) params.set('next', cursor);
    const payload = await fetchJson(`${OFFICIAL_WALLET_URL}?${params}`);
    const page = normalizeRatedWalletPage(payload);
    for (const credit of page.credits) {
      if (seenTokens.has(credit.tokenId)) throw new Error('Official wallet rating pagination returned a duplicate token');
      seenTokens.add(credit.tokenId);
      credits.push(credit);
      if (credits.length > MAX_OWNED_CREDITS) {
        throw new PublicError(422, 'This appraiser currently supports complete wallets with up to 1,000 loose CREDITS.');
      }
    }
    pages += 1;
    if (page.next && (seenCursors.has(page.next) || pages >= MAX_OWNER_PAGES)) {
      throw new PublicError(422, 'This appraiser currently supports complete wallets with up to 1,000 loose CREDITS.');
    }
    if (page.next) {
      seenCursors.add(page.next);
      await new Promise((resolve) => setTimeout(resolve, OWNER_PAGE_DELAY_MS));
    }
    cursor = page.next;
  } while (cursor);
  return { credits, pages };
}

async function fetchOwnedStatements(wallet: string, apiKey: string) {
  const statements: StatementMetadata[] = [];
  const seenTokens = new Set<number>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const params = new URLSearchParams({
      collection: 'statements',
      limit: '200',
      include_auto_hidden: 'true',
    });
    if (cursor) params.set('next', cursor);
    const payload = await fetchJson(
      `${OPEN_SEA_BASE}/chain/ethereum/account/${wallet}/nfts?${params}`,
      { 'x-api-key': apiKey },
    );
    const page = normalizeOwnedNftPage(payload, STATEMENTS_CONTRACT);
    const source = record(payload);
    const nfts = source?.nfts;
    if (!Array.isArray(nfts) || nfts.length !== page.tokenIds.length) {
      throw new Error('OpenSea Statement ownership page is malformed');
    }
    page.tokenIds.forEach((tokenId, index) => {
      if (seenTokens.has(tokenId)) throw new Error('OpenSea Statement pagination returned a duplicate token');
      seenTokens.add(tokenId);
      statements.push(normalizeOpenSeaStatementMetadata(tokenId, { nft: nfts[index] }));
      if (statements.length > MAX_OWNED_STATEMENTS) {
        throw new PublicError(422, 'This appraiser currently supports wallets with up to 100 Statements.');
      }
    });
    pages += 1;
    if (page.next && (seenCursors.has(page.next) || pages >= MAX_OWNER_PAGES)) {
      throw new Error('OpenSea Statement ownership pagination did not complete');
    }
    if (page.next) seenCursors.add(page.next);
    cursor = page.next;
  } while (cursor);
  statements.sort((a, b) => a.tokenId - b.tokenId);
  return statements;
}

function orderPriceEth(payload: unknown) {
  const order = record(payload) as OpenSeaOrder | null;
  const current = order?.price?.current;
  if (!current || !['ETH', 'WETH'].includes(String(current.currency).toUpperCase())) return null;
  const value = Number(current.value);
  const decimals = Number(current.decimals ?? 18);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(decimals) || decimals < 0 || decimals > 30) return null;
  return value / 10 ** decimals;
}

async function fetchCurrentAsk(tokenId: number, apiKey: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${OPEN_SEA_BASE}/listings/collection/credits/nfts/${tokenId}/best`, {
      cache: 'no-store',
      headers: { accept: 'application/json', 'user-agent': USER_AGENT, 'x-api-key': apiKey, 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 404) return null;
    if (response.status === 401 || response.status === 403) {
      throw new Error('OpenSea listing verification is not authorized');
    }
    if (response.ok) return orderPriceEth(await response.json());
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      continue;
    }
    return null;
  }
  return null;
}

async function revalidateBenchmarkBatch(candidates: Array<{ tokenId: number; creditRating: number }>, apiKey: string) {
  const results = new Array<VerifiedAsk | null>(candidates.length).fill(null);
  let cursor = 0;
  const worker = async () => {
    while (cursor < candidates.length) {
      const index = cursor;
      cursor += 1;
      const candidate = candidates[index];
      const priceEth = await fetchCurrentAsk(candidate.tokenId, apiKey);
      results[index] = priceEth ? { tokenId: candidate.tokenId, creditRating: candidate.creditRating, priceEth } : null;
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, candidates.length) }, () => worker()));
  return results.filter((item): item is VerifiedAsk => item !== null);
}

async function fetchVerifiedCreditFloor(
  items: Parameters<typeof matchingCreditListings>[0],
  apiKey: string,
) {
  const candidates = matchingCreditListings(items, {
    minCr: 0,
    maxEth: null,
    sort: 'lowest-price',
    limit: FLOOR_CANDIDATES,
  }).slice(0, FLOOR_CANDIDATES);
  const verified = await revalidateBenchmarkBatch(candidates, apiKey);
  if (verified.length === 0) throw new Error('Current CREDITS floor coverage is insufficient');
  const floor = verified.reduce((lowest, ask) => ask.priceEth < lowest.priceEth ? ask : lowest);
  return { floorEth: floor.priceEth, floorTokenId: floor.tokenId, floorCandidatesChecked: candidates.length };
}

async function fetchBenchmark(apiKey: string, ethUsd: number) {
  const payload = await fetchJson(OFFICIAL_MARKET_URL);
  const normalized = normalizeOfficialCreditSnapshot(payload, ethUsd);
  const candidates = matchingCreditListings(normalized.items, {
    minCr: 0,
    maxEth: null,
    sort: 'best-value',
    limit: 100,
  }).slice(0, BENCHMARK_CANDIDATES);
  const asks: VerifiedAsk[] = [];
  let candidatesChecked = 0;
  for (let start = 0; start < candidates.length; start += BENCHMARK_BATCH_SIZE) {
    const batch = candidates.slice(start, start + BENCHMARK_BATCH_SIZE);
    asks.push(...await revalidateBenchmarkBatch(batch, apiKey));
    candidatesChecked += batch.length;
    if (asks.length >= BENCHMARK_SAMPLE_SIZE) break;
  }
  if (asks.length < BENCHMARK_MIN_SAMPLE_SIZE) throw new Error('Current appraisal benchmark coverage is insufficient');
  const floor = await fetchVerifiedCreditFloor(normalized.items, apiKey);
  return {
    benchmark: buildAskBenchmark(asks),
    ...floor,
    sourceUpdatedAt: normalized.updatedAt,
    candidatesChecked,
    verifiedCount: asks.length,
  };
}

async function fetchMissingStatementMetadata(apiKey: string, tokenIds: number[]) {
  const metadata = new Array<StatementMetadata>(tokenIds.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < tokenIds.length) {
      const index = cursor;
      cursor += 1;
      const tokenId = tokenIds[index];
      const payload = await fetchJson(
        `${OPEN_SEA_BASE}/chain/ethereum/contract/${STATEMENTS_CONTRACT}/nfts/${tokenId}`,
        { 'x-api-key': apiKey },
      );
      metadata[index] = normalizeOpenSeaStatementMetadata(tokenId, payload);
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, tokenIds.length) }, () => worker()));
  return metadata;
}

async function fetchStatementBenchmark(apiKey: string) {
  let cursor: string | null = null;
  let pages = 0;
  const seenCursors = new Set<string>();
  const lowestByToken = new Map<number, { tokenId: number; priceEth: number }>();
  do {
    const params = new URLSearchParams({ limit: '100' });
    if (cursor) params.set('next', cursor);
    const payload = await fetchJson(
      `${OPEN_SEA_BASE}/listings/collection/statements/all?${params}`,
      { 'x-api-key': apiKey },
    );
    const source = record(payload);
    if (!source || !Array.isArray(source.listings)) throw new Error('OpenSea Statement listings are malformed');
    for (const value of source.listings) {
      const order = record(value) as OpenSeaOrder | null;
      const offered = order?.protocol_data?.parameters?.offer?.[0];
      if (String(offered?.token).toLowerCase() !== STATEMENTS_CONTRACT) continue;
      const identifier = offered?.identifierOrCriteria;
      if (typeof identifier !== 'string' || !/^\d+$/.test(identifier)) continue;
      const tokenId = Number(identifier);
      const priceEth = orderPriceEth(value);
      if (!Number.isSafeInteger(tokenId) || tokenId < 0 || !priceEth) continue;
      const prior = lowestByToken.get(tokenId);
      if (!prior || priceEth < prior.priceEth) lowestByToken.set(tokenId, { tokenId, priceEth });
    }
    pages += 1;
    const next = typeof source.next === 'string' && source.next.length > 0 ? source.next : null;
    if (next && (seenCursors.has(next) || pages >= 10)) throw new Error('OpenSea Statement listing pagination did not complete');
    if (next) seenCursors.add(next);
    cursor = next;
  } while (cursor);

  const listings = [...lowestByToken.values()];
  const baseline = statementData.items as StatementMetadata[];
  const metadataById = new Map(baseline.map((item) => [item.tokenId, item]));
  const missingIds = listings.map((item) => item.tokenId).filter((tokenId) => !metadataById.has(tokenId));
  for (const item of await fetchMissingStatementMetadata(apiKey, missingIds)) metadataById.set(item.tokenId, item);
  const asks = listings.map((listing) => {
    const metadata = metadataById.get(listing.tokenId);
    if (!metadata) throw new Error('Current Statement metadata coverage is incomplete');
    return { tokenId: listing.tokenId, creditRating: metadata.creditRating, priceEth: listing.priceEth };
  });
  return {
    benchmark: buildAskBenchmark(asks),
    floorEth: Math.min(...listings.map((listing) => listing.priceEth)),
    listingCheckedAt: new Date().toISOString(),
    listingCount: listings.length,
    pages,
  };
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 1_024) return jsonError(413, 'Request is too large.');
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonError(415, 'Send the wallet lookup as JSON.');
  }
  try {
    const body = record(await request.json());
    const input = typeof body?.wallet === 'string' ? body.wallet.trim() : '';
    if (!input || input.length > MAX_WALLET_INPUT) throw new PublicError(400, 'Enter a valid Ethereum address or ENS name.');
    const apiKey = process.env.OPENSEA_API_KEY;
    if (!apiKey) throw new PublicError(503, 'Wallet appraisal is temporarily unavailable.');
    const resolved = await resolveWallet(input);
    const [creditOwnership, statements, ethUsdQuote] = await Promise.all([
      fetchRatedWalletCredits(resolved.wallet),
      fetchOwnedStatements(resolved.wallet, apiKey),
      fetchEthUsdQuote(),
    ]);
    const [market, statementMarket] = await Promise.all([
      fetchBenchmark(apiKey, ethUsdQuote.price),
      statements.length > 0 ? fetchStatementBenchmark(apiKey) : Promise.resolve(null),
    ]);
    const capturedAt = new Date().toISOString();
    const appraisal = buildWalletAppraisal({
      wallet: resolved.wallet,
      ens: resolved.ens,
      credits: creditOwnership.credits,
      statements,
      benchmark: market.benchmark,
      statementBenchmark: statementMarket?.benchmark,
      creditFloorEth: market.floorEth,
      statementFloorEth: statementMarket?.floorEth,
      ethUsd: ethUsdQuote.price,
      capturedAt,
    });
    const displayedCredits = selectHighestRatedCredits(appraisal.credits, MAX_DISPLAYED_CREDITS);
    return NextResponse.json({
      ...appraisal,
      credits: displayedCredits,
      ownership: {
        source: 'Jack.art rated wallet index + OpenSea-visible Statement holdings',
        credits: creditOwnership.credits.length,
        creditsShown: displayedCredits.length,
        creditPages: creditOwnership.pages,
        statements: statements.length,
      },
      statementMarket: statementMarket ? {
        source: 'Current OpenSea Statement listings + verified Statement metadata',
        listingCheckedAt: statementMarket.listingCheckedAt,
        listingCount: statementMarket.listingCount,
        pages: statementMarket.pages,
        sampleCount: statementMarket.benchmark.sampleTokenIds.length,
        confidence: statementMarket.benchmark.sampleTokenIds.length >= BENCHMARK_SAMPLE_SIZE ? 'moderate' : 'limited',
      } : null,
      market: {
        source: 'Official CREDITS market snapshot + direct OpenSea listing verification',
        sourceUpdatedAt: market.sourceUpdatedAt,
        floorEth: market.floorEth,
        floorTokenId: market.floorTokenId,
        floorCandidatesChecked: market.floorCandidatesChecked,
        candidatesChecked: market.candidatesChecked,
        verifiedCount: market.verifiedCount,
        confidence: market.verifiedCount >= BENCHMARK_SAMPLE_SIZE ? 'moderate' : 'limited',
        ethUsdSource: ethUsdQuote.provider,
        ethUsdCheckedAt: ethUsdQuote.checkedAt,
      },
    }, { headers: RESPONSE_HEADERS });
  } catch (cause) {
    if (cause instanceof PublicError) return jsonError(cause.status, cause.message);
    return jsonError(502, 'Current wallet or market data could not be verified. Please try again.');
  }
}
