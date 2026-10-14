import { NextResponse } from 'next/server';
import { FetchRequest, JsonRpcProvider, getAddress, isAddress } from 'ethers';
import { fetchEthUsdQuote } from '@/lib/eth-usd';
import { matchingCreditListings, normalizeOfficialCreditSnapshot } from '@/lib/credits-intelligence';
import {
  BENCHMARK_MIN_SAMPLE_SIZE,
  BENCHMARK_SAMPLE_SIZE,
  CREDITS_CONTRACT,
  buildAskBenchmark,
  buildWalletAppraisal,
  normalizeCreditDetail,
  normalizeOwnedNftPage,
  type VerifiedAsk,
} from '@/lib/credits-wallet-appraisal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OFFICIAL_MARKET_URL = 'https://jack.art/credits/rating/api/market-snapshot';
const OPEN_SEA_BASE = 'https://api.opensea.io/api/v2';
const USER_AGENT = 'GridPhantomsCreditsWalletLab/0.1';
const MAX_WALLET_INPUT = 128;
const MAX_OWNED_CREDITS = 100;
const MAX_OWNER_PAGES = 10;
const BENCHMARK_CANDIDATES = 125;
const BENCHMARK_BATCH_SIZE = 25;
const RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, noimageindex',
};

type UnknownRecord = Record<string, unknown>;
type OpenSeaOrder = {
  price?: { current?: { currency?: string; value?: string; decimals?: number } };
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

async function fetchOwnedCreditIds(wallet: string, apiKey: string) {
  const tokenIds: number[] = [];
  const seenTokens = new Set<number>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const params = new URLSearchParams({
      collection: 'credits',
      limit: '200',
      include_auto_hidden: 'true',
    });
    if (cursor) params.set('next', cursor);
    const payload = await fetchJson(
      `${OPEN_SEA_BASE}/chain/ethereum/account/${wallet}/nfts?${params}`,
      { 'x-api-key': apiKey },
    );
    const page = normalizeOwnedNftPage(payload, CREDITS_CONTRACT);
    for (const tokenId of page.tokenIds) {
      if (seenTokens.has(tokenId)) throw new Error('OpenSea ownership pagination returned a duplicate token');
      seenTokens.add(tokenId);
      tokenIds.push(tokenId);
      if (tokenIds.length > MAX_OWNED_CREDITS) throw new PublicError(422, 'This prototype currently supports wallets with up to 100 loose CREDITS.');
    }
    pages += 1;
    if (page.next && (seenCursors.has(page.next) || pages >= MAX_OWNER_PAGES)) {
      throw new Error('OpenSea ownership pagination did not complete');
    }
    if (page.next) seenCursors.add(page.next);
    cursor = page.next;
  } while (cursor);
  tokenIds.sort((a, b) => a - b);
  return tokenIds;
}

async function fetchOwnedCreditDetails(tokenIds: number[]) {
  const results = new Array<ReturnType<typeof normalizeCreditDetail>>(tokenIds.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < tokenIds.length) {
      const index = cursor;
      cursor += 1;
      const tokenId = tokenIds[index];
      const payload = await fetchJson(`https://jack.art/credits/rating/api/detail/${tokenId}`);
      results[index] = normalizeCreditDetail(payload, tokenId);
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, tokenIds.length) }, () => worker()));
  return results;
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
  return {
    benchmark: buildAskBenchmark(asks),
    sourceUpdatedAt: normalized.updatedAt,
    candidatesChecked,
    verifiedCount: asks.length,
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
    const [tokenIds, ethUsdQuote] = await Promise.all([
      fetchOwnedCreditIds(resolved.wallet, apiKey),
      fetchEthUsdQuote(),
    ]);
    const [credits, market] = await Promise.all([
      fetchOwnedCreditDetails(tokenIds),
      fetchBenchmark(apiKey, ethUsdQuote.price),
    ]);
    const capturedAt = new Date().toISOString();
    return NextResponse.json({
      ...buildWalletAppraisal({
        wallet: resolved.wallet,
        ens: resolved.ens,
        credits,
        benchmark: market.benchmark,
        ethUsd: ethUsdQuote.price,
        capturedAt,
      }),
      ownership: {
        source: 'OpenSea-visible direct holdings',
        count: tokenIds.length,
      },
      market: {
        source: 'Official CREDITS market snapshot + direct OpenSea listing verification',
        sourceUpdatedAt: market.sourceUpdatedAt,
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
