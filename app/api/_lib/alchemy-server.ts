import 'server-only';

const ALCHEMY_ORIGIN = 'https://eth-mainnet.g.alchemy.com';
const REQUEST_TIMEOUT_MS = 10_000;

export class AlchemyServerError extends Error {
  constructor() {
    super('Alchemy server request failed');
    this.name = 'AlchemyServerError';
  }
}

function apiKey() {
  const value = process.env.ALCHEMY_API_KEY?.trim();
  if (!value) throw new AlchemyServerError();
  return value;
}

async function fetchJsonWithTimeout<T>(url: URL, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new AlchemyServerError();
    return await response.json() as T;
  } catch {
    throw new AlchemyServerError();
  } finally {
    clearTimeout(timeout);
  }
}

export type AlchemyOwnedNft = {
  tokenId?: unknown;
  name?: unknown;
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
  contractAddress: string,
  limit = 100,
  withMetadata = false,
) {
  const ownedNfts: AlchemyOwnedNft[] = [];
  let pageKey: string | undefined;

  for (let page = 0; page < 100; page += 1) {
    const url = new URL(
      `/nft/v3/${encodeURIComponent(apiKey())}/getNFTsForOwner`,
      ALCHEMY_ORIGIN,
    );
    url.searchParams.set('owner', owner);
    url.searchParams.append('contractAddresses[]', contractAddress);
    url.searchParams.set('withMetadata', String(withMetadata));
    url.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 100)));
    if (pageKey) url.searchParams.set('pageKey', pageKey);

    const data = await fetchJsonWithTimeout<AlchemyOwnedNftsResponse>(url);
    if (!Array.isArray(data.ownedNfts)) throw new AlchemyServerError();
    ownedNfts.push(...data.ownedNfts);

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
