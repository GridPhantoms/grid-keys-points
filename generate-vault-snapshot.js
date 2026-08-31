/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node generator uses CommonJS */
const fs = require('fs');
const path = require('path');
const { Interface } = require('ethers');

const VAULT_SNAPSHOT_PATH = path.join(process.cwd(), 'public', 'vault-snapshot.csv');
const VAULT_METADATA_PATH = path.join(process.cwd(), 'public', 'vault-snapshot.meta.json');
const VEBLACK_BALANCE = 109840.99;
const COATTAIL_BROKER_WALLET = '0x3ba0c547Ec6465ddB56A5A8144D6253756E67f7b';
const ROBINHOOD_CHAIN_ID = 4663;
const ROBINHOOD_ASSETS_URL = 'https://api.robinhood.com/rhj/assets';
const ROBINHOOD_PRICES_URL = 'https://api.robinhood.com/rhj/prices/';
const ROBINHOOD_RPC_URL = 'https://rpc.mainnet.chain.robinhood.com/';
const ROBINHOOD_MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const BALANCE_OF_SELECTOR = '70a08231';
const MULTICALL3_INTERFACE = new Interface([
  'function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] returnData)',
]);

const SOURCES = {
  black: 'https://api.dexscreener.com/latest/dex/pairs/avalanche/0x0d9fd6dd9b1ff55fb0a9bb0e5f1b6a2d65b741a3',
  bytes: 'https://api.dexscreener.com/latest/dex/pairs/ethereum/0xfeb09c7e130a4b87b27ebd648ec485657b688b34',
  ethUsd: 'https://api.dexscreener.com/latest/dex/pairs/ethereum/0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
};

const FALLBACK_SOURCES = {
  black: 'https://api.geckoterminal.com/api/v2/networks/avax/pools/0x0d9fd6dd9b1ff55fb0a9bb0e5f1b6a2d65b741a3',
  bytes: 'https://api.geckoterminal.com/api/v2/networks/eth/pools/0xfeb09c7e130a4b87b27ebd648ec485657b688b34',
  ethUsd: 'https://api.coinbase.com/v2/prices/ETH-USD/spot',
};

const OPENSEA_COLLECTIONS = {
  neo_s1_floor_usd: 'neotokyo-citizens',
  neo_s2_floor_usd: 'neotokyo-outer-citizens',
  neo_items_cache_floor_usd: 'neo-tokyo-part-3-item-caches',
  grid_genesis_floor_usd: 'grid-phantoms-genesis-keys',
  coattail_brokers_floor_usd: 'coattailbrokers',
};

function parseArgs(argv) {
  const args = { preview: false, debank: process.env.DEBANK_PORTFOLIO_USD };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--preview') args.preview = true;
    if (arg === '--debank') args.debank = argv[++i];
    if (arg.startsWith('--debank=')) args.debank = arg.slice('--debank='.length);
  }
  return args;
}

function parseNumber(value, label) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing ${label}`);
  }
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

const FETCH_MAX_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, label, init = {}) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          ...(init.headers || {}),
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.ok) return res;

      const body = (await res.text()).slice(0, 500);
      const error = new Error(`${label} HTTP ${res.status}: ${body}`);
      error.status = res.status;
      error.retryAfterMs = Number.parseFloat(res.headers.get('retry-after')) * 1_000;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable) {
        error.retryable = false;
        throw error;
      }
      if (attempt === FETCH_MAX_ATTEMPTS) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (error?.retryable === false || attempt === FETCH_MAX_ATTEMPTS) throw error;
    }

    const retryAfterMs = Number.isFinite(lastError?.retryAfterMs) && lastError.retryAfterMs > 0
      ? lastError.retryAfterMs
      : lastError?.status === 429
        ? 2_000 * 2 ** (attempt - 1)
        : 500 * 2 ** (attempt - 1);
    console.warn(`${label} attempt ${attempt} failed; retrying after ${retryAfterMs}ms.`);
    await sleep(retryAfterMs);
  }

  throw new Error(
    `${label} failed after ${FETCH_MAX_ATTEMPTS} attempts: ${lastError?.message || lastError}`
  );
}

async function fetchJson(url, label, init = {}) {
  const res = await fetchWithRetry(url, label, {
    ...init,
    headers: {
      accept: 'application/json',
      'user-agent': 'GridPhantomsVaultSnapshot/1.0',
      ...(init.headers || {}),
    },
  });
  return res.json();
}

async function fetchText(url, label) {
  const res = await fetchWithRetry(url, label, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 GridPhantomsVaultSnapshot/1.0',
    },
  });
  return res.text();
}

async function getDexScreenerPrice(url, label) {
  const json = await fetchJson(url, label);
  const price = Number.parseFloat(json?.pair?.priceUsd);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`${label} missing usable pair.priceUsd`);
  }
  return price;
}

async function getGeckoTerminalBasePrice(url, label) {
  const json = await fetchJson(url, label);
  const price = Number.parseFloat(json?.data?.attributes?.base_token_price_usd);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`${label} missing usable data.attributes.base_token_price_usd`);
  }
  return price;
}

async function getCoinbaseEthPrice(url, label) {
  const json = await fetchJson(url, label);
  const price = Number.parseFloat(json?.data?.amount);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`${label} missing usable data.amount`);
  }
  return price;
}

async function getPriceWithFallback(primaryUrl, primaryLabel, fallbackLabel, fallbackFetch) {
  try {
    return await getDexScreenerPrice(primaryUrl, primaryLabel);
  } catch {
    console.warn(`${primaryLabel} unavailable; using ${fallbackLabel}.`);
    return fallbackFetch();
  }
}

async function getOpenSeaFloorEth(slug) {
  const statsUrl = `https://api.opensea.io/api/v2/collections/${slug}/stats`;
  try {
    const stats = await fetchJson(statsUrl, `OpenSea stats ${slug}`);
    const floor = Number.parseFloat(stats?.total?.floor_price);
    if (Number.isFinite(floor) && floor > 0) return floor;
  } catch {
    console.warn(`OpenSea stats unavailable for ${slug}; falling back to collection page.`);
  }

  const pageUrl = `https://opensea.io/collection/${slug}${slug === 'neo-tokyo-part-3-item-caches' ? '' : '?status=listed'}`;
  const html = await fetchText(pageUrl, `OpenSea page ${slug}`);
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`"slug":"${escapedSlug}"[\\s\\S]{0,1500}?"floorPrice":\\{"pricePerItem":\\{"token":\\{"unit":([0-9.]+),"symbol":"ETH"`);
  const match = html.match(re);
  if (!match) throw new Error(`Could not extract OpenSea floor for ${slug}`);
  const floor = Number.parseFloat(match[1]);
  if (!Number.isFinite(floor) || floor <= 0) throw new Error(`Invalid OpenSea floor for ${slug}: ${match[1]}`);
  return floor;
}

function isEvmAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function balanceOfCallData(wallet) {
  if (!isEvmAddress(wallet)) throw new Error('Invalid Coattail Broker wallet address');
  return `0x${BALANCE_OF_SELECTOR}${wallet.slice(2).toLowerCase().padStart(64, '0')}`;
}

function formatTokenUnits(rawValue, decimals) {
  if (typeof rawValue !== 'bigint' || rawValue < 0n || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error('Invalid Robinhood token balance');
  }
  if (decimals === 0) return Number(rawValue);
  const padded = rawValue.toString().padStart(decimals + 1, '0');
  const value = Number(`${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`);
  if (!Number.isFinite(value) || value < 0) throw new Error('Unusable Robinhood token balance');
  return value;
}

async function getRobinhoodStockAssets() {
  const payload = await fetchJson(ROBINHOOD_ASSETS_URL, 'Robinhood Stock Token registry');
  if (!Array.isArray(payload?.assets)) throw new Error('Robinhood Stock Token registry missing assets');

  const seen = new Set();
  const assets = [];
  for (const asset of payload.assets) {
    const deployment = Array.isArray(asset?.deployments)
      ? asset.deployments.find((item) => item?.chainId === ROBINHOOD_CHAIN_ID && isEvmAddress(item?.contractAddress))
      : null;
    const symbol = typeof asset?.tokenSymbol === 'string' ? asset.tokenSymbol.trim() : '';
    const decimals = Number(asset?.tokenDecimals);
    const currentMultiplier = Number.parseFloat(asset?.currentMultiplier);
    const address = deployment?.contractAddress;
    if (!deployment || !symbol || !Number.isInteger(decimals) || decimals < 0 || decimals > 36 || !Number.isFinite(currentMultiplier) || currentMultiplier <= 0) continue;
    if (seen.has(address.toLowerCase())) continue;
    seen.add(address.toLowerCase());
    assets.push({ symbol, address, decimals, currentMultiplier });
  }

  if (!assets.length) throw new Error('Robinhood Stock Token registry has no usable mainnet assets');
  return assets;
}

async function getRobinhoodWalletBalances(assets) {
  const calls = assets.map((asset) => ({
    target: asset.address,
    allowFailure: false,
    callData: balanceOfCallData(COATTAIL_BROKER_WALLET),
  }));
  const callData = MULTICALL3_INTERFACE.encodeFunctionData('aggregate3', [calls]);
  const response = await fetchJson(ROBINHOOD_RPC_URL, 'Robinhood wallet balance multicall', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: ROBINHOOD_MULTICALL3, data: callData }, 'latest'],
    }),
  });
  if (response?.error || typeof response?.result !== 'string') {
    throw new Error('Robinhood RPC returned an invalid multicall response');
  }

  let results;
  try {
    [results] = MULTICALL3_INTERFACE.decodeFunctionResult('aggregate3', response.result);
  } catch {
    throw new Error('Robinhood RPC returned undecodable multicall balance data');
  }
  if (!Array.isArray(results) || results.length !== assets.length) {
    throw new Error('Robinhood RPC returned an incomplete multicall balance result');
  }

  const positive = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (!result?.success || typeof result?.returnData !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result.returnData)) {
      throw new Error(`Robinhood multicall returned an invalid balance for ${assets[index].symbol}`);
    }
    const rawBalance = BigInt(result.returnData);
    if (rawBalance > 0n) {
      const asset = assets[index];
      positive.push({ ...asset, balance: formatTokenUnits(rawBalance, asset.decimals) });
    }
  }

  return positive;
}

async function getRobinhoodTokenPrice(asset) {
  const payload = await fetchJson(`${ROBINHOOD_PRICES_URL}${encodeURIComponent(asset.symbol)}`, `Robinhood ${asset.symbol} price`);
  const quote = Array.isArray(payload?.quotes)
    ? payload.quotes.find((item) => item?.tokenSymbol === asset.symbol && item?.currency === 'USD')
    : null;
  const bid = Number.parseFloat(quote?.bid);
  const ask = Number.parseFloat(quote?.ask);
  if (!Number.isFinite(bid) || bid <= 0 || !Number.isFinite(ask) || ask <= 0 || ask < bid) {
    throw new Error(`Robinhood ${asset.symbol} price missing a usable USD bid/ask`);
  }
  return {
    midpointUsd: ((bid + ask) / 2) * asset.currentMultiplier,
    generatedAt: typeof quote?.generatedAt === 'string' ? quote.generatedAt : '',
  };
}

async function getCoattailBrokerWalletValue() {
  const assets = await getRobinhoodStockAssets();
  const balances = await getRobinhoodWalletBalances(assets);
  const holdings = [];

  for (const asset of balances) {
    const price = await getRobinhoodTokenPrice(asset);
    holdings.push({
      symbol: asset.symbol,
      balance: asset.balance,
      priceUsd: price.midpointUsd,
      valueUsd: asset.balance * price.midpointUsd,
      generatedAt: price.generatedAt,
    });
    await sleep(100);
  }

  const totalUsd = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  if (!Number.isFinite(totalUsd) || totalUsd < 0) throw new Error('Invalid Coattail Broker wallet value');
  return { totalUsd, holdings };
}

function readExistingSnapshot() {
  if (!fs.existsSync(VAULT_SNAPSHOT_PATH)) return null;
  return fs.readFileSync(VAULT_SNAPSHOT_PATH, 'utf8').replace(/\r\n/g, '\n').trim();
}

function toCsv(values) {
  const rows = [
    ['stat', 'value'],
    ['debank_portfolio_usd', formatValue(values.debank_portfolio_usd, 2)],
    ['black_price_usd', formatValue(values.black_price_usd, 8)],
    ['veblack_balance', formatValue(values.veblack_balance, 2)],
    ['bytes_price_usd', formatValue(values.bytes_price_usd, 8)],
    ['neo_s1_floor_usd', formatValue(values.neo_s1_floor_usd, 2)],
    ['neo_s2_floor_usd', formatValue(values.neo_s2_floor_usd, 2)],
    ['neo_items_cache_floor_usd', formatValue(values.neo_items_cache_floor_usd, 2)],
    ['grid_genesis_floor_usd', formatValue(values.grid_genesis_floor_usd, 2)],
    ['coattail_brokers_floor_usd', formatValue(values.coattail_brokers_floor_usd, 2)],
    ['coattail_broker_wallet_usd', formatValue(values.coattail_broker_wallet_usd, 2)],
    ['coattail_broker_wallet_token_count', formatValue(values.coattail_broker_wallet_token_count, 0)],
  ];
  return `${rows.map((row) => row.join(',')).join('\n')}\n`;
}

function formatValue(value, decimals) {
  return Number(value).toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function formatUtcSnapshot(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function updateVaultSnapshotMetadata(snapshotTime) {
  fs.writeFileSync(VAULT_METADATA_PATH, `${JSON.stringify({ capturedAt: snapshotTime }, null, 2)}\n`);
}

async function collectValues(debankValue) {
  // Avoid bursty parallel requests to DexScreener. Its public endpoint can
  // intermittently return 5xx responses or stall when several pair lookups
  // arrive together from the same client.
  const blackPrice = await getPriceWithFallback(
    SOURCES.black,
    'BLACK DexScreener price',
    'BLACK GeckoTerminal price',
    () => getGeckoTerminalBasePrice(FALLBACK_SOURCES.black, 'BLACK GeckoTerminal price')
  );
  await sleep(250);
  const bytesPrice = await getPriceWithFallback(
    SOURCES.bytes,
    'BYTES DexScreener price',
    'BYTES GeckoTerminal price',
    () => getGeckoTerminalBasePrice(FALLBACK_SOURCES.bytes, 'BYTES GeckoTerminal price')
  );
  await sleep(250);
  const ethUsd = await getPriceWithFallback(
    SOURCES.ethUsd,
    'ETH/USD DexScreener price',
    'Coinbase ETH/USD spot',
    () => getCoinbaseEthPrice(FALLBACK_SOURCES.ethUsd, 'Coinbase ETH/USD spot')
  );

  const floorEntries = await Promise.all(
    Object.entries(OPENSEA_COLLECTIONS).map(async ([key, slug]) => {
      const floorEth = await getOpenSeaFloorEth(slug);
      return [key, floorEth * ethUsd, floorEth];
    })
  );
  const brokerWallet = await getCoattailBrokerWalletValue();

  const values = {
    debank_portfolio_usd: debankValue,
    black_price_usd: blackPrice,
    veblack_balance: VEBLACK_BALANCE,
    bytes_price_usd: bytesPrice,
    coattail_broker_wallet_usd: brokerWallet.totalUsd,
    coattail_broker_wallet_token_count: brokerWallet.holdings.length,
  };

  const floorsEth = {};
  for (const [key, usd, eth] of floorEntries) {
    values[key] = usd;
    floorsEth[key] = eth;
  }

  return { values, ethUsd, floorsEth, brokerWalletHoldings: brokerWallet.holdings };
}

async function main() {
  const args = parseArgs(process.argv);
  const debank = args.debank ? parseNumber(args.debank, 'debank_portfolio_usd') : null;

  const { values, ethUsd, floorsEth, brokerWalletHoldings } = await collectValues(debank ?? 0);

  if (args.preview || debank === null) {
    console.log('Vault snapshot source preview. No files were changed.');
    console.log(`black_price_usd=${formatValue(values.black_price_usd, 8)}`);
    console.log(`bytes_price_usd=${formatValue(values.bytes_price_usd, 8)}`);
    console.log(`veblack_balance=${formatValue(values.veblack_balance, 2)}`);
    console.log(`eth_usd=${formatValue(ethUsd, 2)}`);
    for (const key of Object.keys(OPENSEA_COLLECTIONS)) {
      console.log(`${key}=${formatValue(values[key], 2)} (${formatValue(floorsEth[key], 6)} ETH)`);
    }
    console.log(`coattail_broker_wallet_usd=${formatValue(values.coattail_broker_wallet_usd, 2)} (${brokerWalletHoldings.length} tokenized stocks)`);
    for (const holding of brokerWalletHoldings) {
      console.log(`  ${holding.symbol}: balance=${formatValue(holding.balance, 8)} price_usd=${formatValue(holding.priceUsd, 4)} value_usd=${formatValue(holding.valueUsd, 2)}`);
    }
    if (debank === null) {
      console.log('Missing debank_portfolio_usd. Re-run with --debank <usd_value> to update public/vault-snapshot.csv.');
    }
    return;
  }

  const nextCsv = toCsv(values);
  const existingCsv = readExistingSnapshot();
  if (existingCsv === nextCsv.trim()) {
    console.log('No vault snapshot data changes; leaving Engine Room snapshot time unchanged.');
    return;
  }

  fs.writeFileSync(VAULT_SNAPSHOT_PATH, nextCsv);
  const snapshotTime = formatUtcSnapshot();
  updateVaultSnapshotMetadata(snapshotTime);

  console.log(`Updated ${path.relative(process.cwd(), VAULT_SNAPSHOT_PATH)}`);
  console.log(`Updated ${path.relative(process.cwd(), VAULT_METADATA_PATH)} capture time to ${snapshotTime}`);
  console.log(`black_price_usd=${formatValue(values.black_price_usd, 8)}`);
  console.log(`bytes_price_usd=${formatValue(values.bytes_price_usd, 8)}`);
  console.log(`neo_s1_floor_usd=${formatValue(values.neo_s1_floor_usd, 2)}`);
  console.log(`neo_s2_floor_usd=${formatValue(values.neo_s2_floor_usd, 2)}`);
  console.log(`neo_items_cache_floor_usd=${formatValue(values.neo_items_cache_floor_usd, 2)}`);
  console.log(`grid_genesis_floor_usd=${formatValue(values.grid_genesis_floor_usd, 2)}`);
  console.log(`coattail_brokers_floor_usd=${formatValue(values.coattail_brokers_floor_usd, 2)}`);
  console.log(`coattail_broker_wallet_usd=${formatValue(values.coattail_broker_wallet_usd, 2)}`);
  console.log(`coattail_broker_wallet_token_count=${formatValue(values.coattail_broker_wallet_token_count, 0)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
