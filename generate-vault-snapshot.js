/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node generator uses CommonJS */
const fs = require('fs');
const path = require('path');

const VAULT_SNAPSHOT_PATH = path.join(process.cwd(), 'public', 'vault-snapshot.csv');
const VAULT_METADATA_PATH = path.join(process.cwd(), 'public', 'vault-snapshot.meta.json');
const VEBLACK_BALANCE = 109840.99;

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

async function fetchWithRetry(url, label, headers) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.ok) return res;

      const body = (await res.text()).slice(0, 500);
      const error = new Error(`${label} HTTP ${res.status}: ${body}`);
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

    console.warn(`${label} attempt ${attempt} failed; retrying.`);
    await sleep(500 * 2 ** (attempt - 1));
  }

  throw new Error(
    `${label} failed after ${FETCH_MAX_ATTEMPTS} attempts: ${lastError?.message || lastError}`
  );
}

async function fetchJson(url, label) {
  const res = await fetchWithRetry(url, label, {
    accept: 'application/json',
    'user-agent': 'GridPhantomsVaultSnapshot/1.0',
  });
  return res.json();
}

async function fetchText(url, label) {
  const res = await fetchWithRetry(url, label, {
    accept: 'text/html,application/xhtml+xml',
    'user-agent': 'Mozilla/5.0 GridPhantomsVaultSnapshot/1.0',
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
  } catch (error) {
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

  const values = {
    debank_portfolio_usd: debankValue,
    black_price_usd: blackPrice,
    veblack_balance: VEBLACK_BALANCE,
    bytes_price_usd: bytesPrice,
  };

  const floorsEth = {};
  for (const [key, usd, eth] of floorEntries) {
    values[key] = usd;
    floorsEth[key] = eth;
  }

  return { values, ethUsd, floorsEth };
}

async function main() {
  const args = parseArgs(process.argv);
  const debank = args.debank ? parseNumber(args.debank, 'debank_portfolio_usd') : null;

  const { values, ethUsd, floorsEth } = await collectValues(debank ?? 0);

  if (args.preview || debank === null) {
    console.log('Vault snapshot source preview. No files were changed.');
    console.log(`black_price_usd=${formatValue(values.black_price_usd, 8)}`);
    console.log(`bytes_price_usd=${formatValue(values.bytes_price_usd, 8)}`);
    console.log(`veblack_balance=${formatValue(values.veblack_balance, 2)}`);
    console.log(`eth_usd=${formatValue(ethUsd, 2)}`);
    for (const key of Object.keys(OPENSEA_COLLECTIONS)) {
      console.log(`${key}=${formatValue(values[key], 2)} (${formatValue(floorsEth[key], 6)} ETH)`);
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
