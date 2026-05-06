const fs = require('fs');
const path = require('path');

const VAULT_SNAPSHOT_PATH = path.join(process.cwd(), 'public', 'vault-snapshot.csv');
const ENGINE_PAGE_PATH = path.join(process.cwd(), 'app', 'engine', 'page.tsx');
const VEBLACK_BALANCE = 109527.37;

const SOURCES = {
  black: 'https://api.dexscreener.com/latest/dex/pairs/avalanche/0x0d9fd6dd9b1ff55fb0a9bb0e5f1b6a2d65b741a3',
  bytes: 'https://api.dexscreener.com/latest/dex/pairs/ethereum/0xfeb09c7e130a4b87b27ebd648ec485657b688b34',
  ethUsd: 'https://api.dexscreener.com/latest/dex/pairs/ethereum/0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
};

const OPENSEA_COLLECTIONS = {
  neo_s1_floor_usd: 'neotokyo-citizens',
  neo_s2_floor_usd: 'neotokyo-outer-citizens',
  neo_items_cache_floor_usd: 'neo-tokyo-part-3-item-caches',
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

async function fetchJson(url, label) {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'GridPhantomsVaultSnapshot/1.0' },
  });
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchText(url, label) {
  const res = await fetch(url, {
    headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Mozilla/5.0 GridPhantomsVaultSnapshot/1.0' },
  });
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}: ${await res.text()}`);
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

async function getOpenSeaFloorEth(slug) {
  const statsUrl = `https://api.opensea.io/api/v2/collections/${slug}/stats`;
  try {
    const stats = await fetchJson(statsUrl, `OpenSea stats ${slug}`);
    const floor = Number.parseFloat(stats?.total?.floor_price);
    if (Number.isFinite(floor) && floor > 0) return floor;
  } catch (err) {
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
  ];
  return `${rows.map((row) => row.join(',')).join('\n')}\n`;
}

function formatValue(value, decimals) {
  return Number(value).toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function formatUtcSnapshot(date = new Date()) {
  const month = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const day = date.toLocaleString('en-US', { day: 'numeric', timeZone: 'UTC' });
  const year = date.toLocaleString('en-US', { year: 'numeric', timeZone: 'UTC' });
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return `${month} ${day}, ${year} ${hour}:${minute} UTC`;
}

function updateEngineSnapshotTime(snapshotTime) {
  const source = fs.readFileSync(ENGINE_PAGE_PATH, 'utf8');
  const next = source.replace(/const LAST_SNAPSHOT = "[^"]+";/, `const LAST_SNAPSHOT = "${snapshotTime}";`);
  if (next === source) throw new Error('Could not update LAST_SNAPSHOT in app/engine/page.tsx');
  fs.writeFileSync(ENGINE_PAGE_PATH, next);
}

async function collectValues(debankValue) {
  const [blackPrice, bytesPrice, ethUsd] = await Promise.all([
    getDexScreenerPrice(SOURCES.black, 'BLACK DexScreener price'),
    getDexScreenerPrice(SOURCES.bytes, 'BYTES DexScreener price'),
    getDexScreenerPrice(SOURCES.ethUsd, 'ETH/USD DexScreener price'),
  ]);

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
  updateEngineSnapshotTime(snapshotTime);

  console.log(`Updated ${path.relative(process.cwd(), VAULT_SNAPSHOT_PATH)}`);
  console.log(`Updated Engine Room snapshot time to ${snapshotTime}`);
  console.log(`black_price_usd=${formatValue(values.black_price_usd, 8)}`);
  console.log(`bytes_price_usd=${formatValue(values.bytes_price_usd, 8)}`);
  console.log(`neo_s1_floor_usd=${formatValue(values.neo_s1_floor_usd, 2)}`);
  console.log(`neo_s2_floor_usd=${formatValue(values.neo_s2_floor_usd, 2)}`);
  console.log(`neo_items_cache_floor_usd=${formatValue(values.neo_items_cache_floor_usd, 2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
