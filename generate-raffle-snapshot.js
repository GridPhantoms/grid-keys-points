const fs = require('fs');
const path = require('path');

const EXODUS_CONTRACT = '0xddf1d5f3a79ccba74e284fd5b9ee0faddb8993aa';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ANNOUNCEMENT_UNIX_SECONDS = 1776818640; // April 22, 2026 00:44 UTC / Apr 21, 2026 7:44 PM Central
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv(path.join(process.cwd(), '.env.local'));
loadDotEnv(path.join(process.cwd(), '.env'));

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
if (!ALCHEMY_API_KEY) {
  console.error('Missing ALCHEMY_API_KEY or NEXT_PUBLIC_ALCHEMY_API_KEY.');
  process.exit(1);
}

const RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  if (!res.ok) {
    throw new Error(`${method} HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (json.error) {
    throw new Error(`${method}: ${json.error.message || JSON.stringify(json.error)}`);
  }
  return json.result;
}

const toHex = (n) => `0x${Number(n).toString(16)}`;
const fromHex = (h) => Number.parseInt(h, 16);

const blockTimestampCache = new Map();
async function getBlockTimestamp(blockNumber) {
  const num = typeof blockNumber === 'string' ? fromHex(blockNumber) : blockNumber;
  if (blockTimestampCache.has(num)) return blockTimestampCache.get(num);
  const block = await rpc('eth_getBlockByNumber', [toHex(num), false]);
  if (!block) throw new Error(`Could not fetch block ${num}`);
  const ts = fromHex(block.timestamp);
  blockTimestampCache.set(num, ts);
  return ts;
}

async function latestBlockNumber() {
  return fromHex(await rpc('eth_blockNumber', []));
}

async function findFirstBlockAtOrAfter(timestampSeconds) {
  let low = 0;
  let high = await latestBlockNumber();
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const ts = await getBlockTimestamp(mid);
    if (ts < timestampSeconds) low = mid + 1;
    else high = mid;
  }
  return low;
}

function transferTimestampSeconds(t) {
  if (t.metadata && t.metadata.blockTimestamp) {
    return Math.floor(Date.parse(t.metadata.blockTimestamp) / 1000);
  }
  return null;
}

async function fetchMintTransfers(fromBlock) {
  const transfers = [];
  let pageKey;
  let page = 0;

  do {
    page += 1;
    const params = [{
      fromBlock: toHex(fromBlock),
      toBlock: 'latest',
      fromAddress: ZERO_ADDRESS,
      contractAddresses: [EXODUS_CONTRACT],
      category: ['erc721'],
      withMetadata: true,
      excludeZeroValue: false,
      maxCount: '0x3e8',
      order: 'asc',
      ...(pageKey ? { pageKey } : {}),
    }];

    const result = await rpc('alchemy_getAssetTransfers', params);
    transfers.push(...(result.transfers || []));
    pageKey = result.pageKey;
    console.log(`Fetched mint transfer page ${page}: ${result.transfers?.length || 0} rows`);
  } while (pageKey);

  const unique = new Map();
  for (const t of transfers) {
    const contract = (t.rawContract?.address || '').toLowerCase();
    const from = (t.from || '').toLowerCase();
    const to = (t.to || '').toLowerCase();
    if (contract !== EXODUS_CONTRACT || from !== ZERO_ADDRESS || !to || to === ZERO_ADDRESS) continue;
    const key = `${t.hash || ''}:${t.erc721TokenId || t.tokenId || t.rawContract?.tokenId || ''}:${to}`;
    unique.set(key, t);
  }

  const mints = [];
  for (const t of unique.values()) {
    const blockNum = fromHex(t.blockNum);
    const ts = transferTimestampSeconds(t) || await getBlockTimestamp(blockNum);
    mints.push({
      wallet: t.to.toLowerCase(),
      tokenId: t.erc721TokenId || t.tokenId || t.rawContract?.tokenId || '',
      hash: t.hash,
      blockNum,
      timestamp: ts,
    });
  }

  return mints.sort((a, b) => a.timestamp - b.timestamp || a.blockNum - b.blockNum || String(a.tokenId).localeCompare(String(b.tokenId)));
}

function formatUtc(timestampMs = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(timestampMs));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('month')} ${Number(get('day'))}, ${get('year')} ${get('hour')}:${get('minute')} UTC`;
}

function writeCsv(ticketCounts) {
  const rows = [...ticketCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([wallet, quantity]) => `${wallet},${quantity}`);
  fs.writeFileSync(path.join(process.cwd(), 'public', 'raffle-snapshot.csv'), `wallet,quantity\n${rows.join('\n')}\n`);
}

function updateRaffleSnapshotTime(snapshotTime) {
  const filePath = path.join(process.cwd(), 'app', 'raffle', 'page.tsx');
  const src = fs.readFileSync(filePath, 'utf8');
  const next = src.replace(
    /const \[lastSnapshot\] = useState\("[^"]+"\);/,
    `const [lastSnapshot] = useState("${snapshotTime}");`,
  );
  if (next === src) {
    throw new Error('Could not find raffle lastSnapshot state in app/raffle/page.tsx');
  }
  fs.writeFileSync(filePath, next);
}

async function main() {
  console.log('Generating raffle snapshot from Exodus mint events...');
  console.log(`Announcement start: ${formatUtc(ANNOUNCEMENT_UNIX_SECONDS * 1000)}`);

  const fromBlock = await findFirstBlockAtOrAfter(ANNOUNCEMENT_UNIX_SECONDS);
  console.log(`First block at/after announcement: ${fromBlock}`);

  const mints = await fetchMintTransfers(fromBlock);
  const mintsAfterAnnouncement = mints.filter((m) => m.timestamp >= ANNOUNCEMENT_UNIX_SECONDS);

  if (mintsAfterAnnouncement.length < 30) {
    console.log(`30th post-announcement Exodus mint not reached yet: ${mintsAfterAnnouncement.length}/30`);
  }

  const thirtiethMint = mintsAfterAnnouncement[29] || null;
  const raffleEnd = thirtiethMint ? thirtiethMint.timestamp + SEVEN_DAYS_SECONDS : null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const effectiveEnd = raffleEnd ? Math.min(nowSeconds, raffleEnd) : nowSeconds;

  const eligibleMints = mintsAfterAnnouncement.filter((m) => m.timestamp <= effectiveEnd);
  const ticketCounts = new Map();
  for (const mint of eligibleMints) {
    ticketCounts.set(mint.wallet, (ticketCounts.get(mint.wallet) || 0) + 1);
  }

  writeCsv(ticketCounts);
  const snapshotTime = formatUtc();
  updateRaffleSnapshotTime(snapshotTime);

  const totalTickets = [...ticketCounts.values()].reduce((sum, n) => sum + n, 0);
  console.log(`Raffle snapshot time: ${snapshotTime}`);
  console.log(`Wallets: ${ticketCounts.size}`);
  console.log(`Tickets: ${totalTickets}`);
  if (thirtiethMint) {
    console.log(`30th post-announcement mint: ${formatUtc(thirtiethMint.timestamp * 1000)} block ${thirtiethMint.blockNum}`);
    console.log(`Raffle end: ${formatUtc(raffleEnd * 1000)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
