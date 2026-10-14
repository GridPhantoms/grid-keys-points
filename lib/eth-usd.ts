const COINBASE_TICKER_URL = 'https://api.exchange.coinbase.com/products/ETH-USD/ticker';
const KRAKEN_TICKER_URL = 'https://api.kraken.com/0/public/Ticker?pair=ETHUSD';
const USER_AGENT = 'GridPhantomsCredits/1.0';
const MAX_QUOTE_AGE_MS = 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5_000;

type QuoteProvider = 'coinbase' | 'kraken';

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type EthUsdQuote = {
  price: number;
  provider: QuoteProvider;
  checkedAt: string;
  providerAsOf: string | null;
  cached: boolean;
};

type ResolverOptions = {
  fetcher?: Fetcher;
  now?: () => Date;
  timeoutMs?: number;
};

function positivePrice(value: unknown) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) throw new Error('ETH-USD provider returned an invalid price');
  return price;
}

function parseCoinbaseQuote(payload: unknown, now: Date): Omit<EthUsdQuote, 'checkedAt' | 'cached'> {
  const source = payload as { price?: unknown; time?: unknown };
  const providerAsOf = typeof source?.time === 'string' ? source.time : null;
  const providerTime = providerAsOf ? Date.parse(providerAsOf) : NaN;
  if (!Number.isFinite(providerTime)) throw new Error('Coinbase ETH-USD timestamp is unavailable');
  const age = now.getTime() - providerTime;
  if (age > MAX_QUOTE_AGE_MS || age < -MAX_FUTURE_SKEW_MS) throw new Error('Coinbase ETH-USD quote is stale');
  return { price: positivePrice(source.price), provider: 'coinbase', providerAsOf };
}

function parseKrakenQuote(payload: unknown): Omit<EthUsdQuote, 'checkedAt' | 'cached'> {
  const source = payload as { error?: unknown; result?: Record<string, { c?: unknown[] }> };
  if (!Array.isArray(source?.error) || source.error.length > 0 || !source.result) {
    throw new Error('Kraken ETH-USD ticker is unavailable');
  }
  const ticker = Object.values(source.result)[0];
  return { price: positivePrice(ticker?.c?.[0]), provider: 'kraken', providerAsOf: null };
}

async function requestJson(fetcher: Fetcher, url: string, timeoutMs: number) {
  const response = await fetcher(url, {
    cache: 'no-store',
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`ETH-USD provider request failed (${response.status})`);
  return response.json() as Promise<unknown>;
}

export function createEthUsdQuoteResolver(options: ResolverOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastGoodQuote: EthUsdQuote | null = null;

  return async function resolveEthUsdQuote(): Promise<EthUsdQuote> {
    const attempts: Array<() => Promise<Omit<EthUsdQuote, 'checkedAt' | 'cached'>>> = [
      async () => parseCoinbaseQuote(await requestJson(fetcher, COINBASE_TICKER_URL, timeoutMs), now()),
      async () => parseKrakenQuote(await requestJson(fetcher, KRAKEN_TICKER_URL, timeoutMs)),
    ];

    for (const attempt of attempts) {
      try {
        const quote = await attempt();
        lastGoodQuote = { ...quote, checkedAt: now().toISOString(), cached: false };
        return lastGoodQuote;
      } catch {
        // Continue to the independent provider before considering a recent cached quote.
      }
    }

    const currentTime = now().getTime();
    if (lastGoodQuote && currentTime - Date.parse(lastGoodQuote.checkedAt) <= MAX_QUOTE_AGE_MS) {
      return { ...lastGoodQuote, cached: true };
    }
    throw new Error('ETH-USD price is unavailable from Coinbase, Kraken, and the recent quote cache');
  };
}

export const fetchEthUsdQuote = createEthUsdQuoteResolver();
