const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ENV_PATH = path.join(ROOT, '.env.local');
const OUTPUT_PATH = path.join(ROOT, 'public', 'holders-snapshot.csv');

const GENESIS_CONTRACT = '0xF26e168D053F6779f7172A1d0b0A6cD8d7446493';
const EXODUS_CONTRACT = '0xddF1d5f3A79ccbA74e284fD5b9Ee0FAdDB8993aa';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return env;

      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      env[key.trim()] = value;
      return env;
    }, {});
}

const envFile = loadEnvFile(ENV_PATH);
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || envFile.ALCHEMY_API_KEY || envFile.NEXT_PUBLIC_ALCHEMY_API_KEY;

if (!ALCHEMY_KEY) {
  console.error('Missing Alchemy key. Set ALCHEMY_API_KEY or NEXT_PUBLIC_ALCHEMY_API_KEY in your environment or .env.local.');
  process.exit(1);
}

async function fetchOwnersForContract(contractAddress, label) {
  const ownersByWallet = new Map();
  let pageKey;
  let page = 0;

  do {
    page += 1;

    const params = new URLSearchParams({
      contractAddress,
      withTokenBalances: 'true',
    });

    if (pageKey) params.set('pageKey', pageKey);

    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getOwnersForContract?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${label} Alchemy request failed: HTTP ${res.status} ${res.statusText} — ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const owners = data.owners || [];

    for (const owner of owners) {
      const wallet = owner.ownerAddress.toLowerCase();
      const qty = (owner.tokenBalances || []).reduce((sum, token) => sum + Number(token.balance || 0), 0);
      ownersByWallet.set(wallet, (ownersByWallet.get(wallet) || 0) + qty);
    }

    pageKey = data.pageKey;
    console.log(`${label}: fetched page ${page} (${owners.length} holder rows)`);
  } while (pageKey);

  const totalTokens = [...ownersByWallet.values()].reduce((sum, qty) => sum + qty, 0);
  console.log(`${label}: ${ownersByWallet.size} holders, ${totalTokens} tokens`);

  return ownersByWallet;
}

async function main() {
  console.log('Generating holder snapshot from Alchemy...');

  const genesis = await fetchOwnersForContract(GENESIS_CONTRACT, 'Genesis');
  const exodus = await fetchOwnersForContract(EXODUS_CONTRACT, 'Exodus');

  const wallets = [...new Set([...genesis.keys(), ...exodus.keys()])].sort();

  let csv = 'wallet,genesis_qty,exodus_qty\n';
  for (const wallet of wallets) {
    csv += `${wallet},${genesis.get(wallet) || 0},${exodus.get(wallet) || 0}\n`;
  }

  fs.writeFileSync(OUTPUT_PATH, csv);

  console.log(`Combined holders: ${wallets.length}`);
  console.log(`✅ Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
