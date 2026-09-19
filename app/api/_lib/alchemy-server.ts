import 'server-only';

const ALCHEMY_ORIGIN = 'https://eth-mainnet.g.alchemy.com';
const REQUEST_TIMEOUT_MS = 10_000;

export class AlchemyServerError extends Error {
  retryable: boolean;

  constructor(retryable = true) {
    super('Alchemy server request failed');
    this.name = 'AlchemyServerError';
    this.retryable = retryable;
  }
}

function apiKey() {
  const value = process.env.ALCHEMY_API_KEY?.trim();
  if (!value) throw new AlchemyServerError();
  return value;
}

const FETCH_ATTEMPTS = 3;
const FETCH_RETRY_DELAY_MS = 250;

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonOnce<T>(url: URL, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new AlchemyServerError(isRetryableStatus(response.status));
    return await response.json() as T;
  } catch (error) {
    if (error instanceof AlchemyServerError) throw error;
    throw new AlchemyServerError();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout<T>(url: URL, init?: RequestInit): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchJsonOnce<T>(url, init);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof AlchemyServerError ? error.retryable : true;
      if (!retryable || attempt === FETCH_ATTEMPTS) throw error instanceof AlchemyServerError ? error : new AlchemyServerError();
      await wait(FETCH_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError instanceof AlchemyServerError ? lastError : new AlchemyServerError();
}

export type AlchemyOwnedNft = {
  tokenId?: unknown;
  name?: unknown;
  contractAddress?: unknown;
  contract?: { address?: unknown } | null;
  image?: {
    cachedUrl?: unknown;
    thumbnailUrl?: unknown;
    pngUrl?: unknown;
    originalUrl?: unknown;
  } | null;
};

type AlchemyOwnedNftsResponse = {
  ownedNfts?: unknown;
  pageKey?: unknown;
};

export async function getNftsForOwner(
  owner: string,
  contractAddress: string | readonly string[],
  limit = 100,
  withMetadata = false,
  maxResults = 10_000,
) {
  const ownedNfts: AlchemyOwnedNft[] = [];
  const contractAddresses = Array.isArray(contractAddress) ? contractAddress : [contractAddress];
  if (contractAddresses.length === 0 || maxResults < 1) throw new AlchemyServerError();
  let pageKey: string | undefined;

  for (let page = 0; page < 100; page += 1) {
    const url = new URL(
      `/nft/v3/${encodeURIComponent(apiKey())}/getNFTsForOwner`,
      ALCHEMY_ORIGIN,
    );
    url.searchParams.set('owner', owner);
    for (const address of contractAddresses) url.searchParams.append('contractAddresses[]', address);
    url.searchParams.set('withMetadata', String(withMetadata));
    url.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 100)));
    if (pageKey) url.searchParams.set('pageKey', pageKey);

    const data = await fetchJsonWithTimeout<AlchemyOwnedNftsResponse>(url);
    if (!Array.isArray(data.ownedNfts)) throw new AlchemyServerError();
    ownedNfts.push(...data.ownedNfts);
    if (ownedNfts.length > maxResults) throw new AlchemyServerError();

    if (data.pageKey === undefined || data.pageKey === null || data.pageKey === '') return ownedNfts;
    if (typeof data.pageKey !== 'string') throw new AlchemyServerError();
    pageKey = data.pageKey;
  }

  throw new AlchemyServerError();
}

type AlchemyRpcResponse<T> = {
  result?: T;
  error?: unknown;
};

export async function alchemyRpc<T>(method: string, params: unknown[]): Promise<T> {
  const url = new URL(`/v2/${encodeURIComponent(apiKey())}`, ALCHEMY_ORIGIN);
  const data = await fetchJsonWithTimeout<AlchemyRpcResponse<T>>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  if (data.error || data.result === undefined) throw new AlchemyServerError();
  return data.result;
}
