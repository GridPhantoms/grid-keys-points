import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Contract, FetchRequest, Interface, JsonRpcProvider, getAddress, id } from 'ethers';

import {
  AVALANCHE_BYTES_TOKEN_CONTRACT,
  AVALANCHE_CHAIN_ID,
  BYTES_TOKEN_CONTRACT,
  ETHEREUM_CHAIN_ID,
} from '../lib/bytes-addresses.mjs';

const OUTPUT_URL = new URL('../data/bytes-holder-snapshot.json', import.meta.url);
const ETHEREUM_DEPLOYMENT_BLOCK = 17_487_665;
const ETHEREUM_LOG_SPAN = 50_000;
const AVALANCHE_LOG_SPAN = 2_048;
const ROUTESCAN_BASE = 'https://api.routescan.io';
const ROUTESCAN_HOLDER_PATH = `/v2/network/mainnet/evm/${AVALANCHE_CHAIN_ID}/erc20/${AVALANCHE_BYTES_TOKEN_CONTRACT}/holders?limit=1000`;
const ROUTESCAN_ETHERSCAN_PATH = `/v2/network/mainnet/evm/${AVALANCHE_CHAIN_ID}/etherscan/api`;
const TRANSFER_TOPIC = id('Transfer(address,address,uint256)');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TRANSFER_INTERFACE = new Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const ERC20_ABI = ['function totalSupply() view returns (uint256)'];
const MAX_FETCH_RETRIES = 4;

function loadEnvFile(path) {
  return readFile(path, 'utf8').then((text) => {
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const index = line.indexOf('=');
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  }).catch((error) => {
    if (error?.code !== 'ENOENT') throw error;
  });
}

function digestAddresses(addresses) {
  return createHash('sha256').update(`${[...addresses].sort().join('\n')}\n`).digest('hex');
}

function addBalance(balances, address, delta) {
  if (address === ZERO_ADDRESS) return;
  const next = (balances.get(address) ?? 0n) + delta;
  if (next < 0n) throw new Error(`negative reconstructed balance for ${address}`);
  balances.set(address, next);
}

async function getLogsWithRetry(provider, filter, evidence, attempt = 0) {
  evidence.logQueryCalls += 1;
  try {
    return await provider.getLogs(filter);
  } catch (error) {
    if (attempt >= MAX_FETCH_RETRIES) throw error;
    evidence.logQueryRetries += 1;
    await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
    return getLogsWithRetry(provider, filter, evidence, attempt + 1);
  }
}

async function collectEthereumHolders(provider, sourceBlock) {
  const balances = new Map();
  const evidence = { transferEventCount: 0, logQueryCalls: 0, logQueryRetries: 0 };
  let start = ETHEREUM_DEPLOYMENT_BLOCK;
  while (start <= sourceBlock) {
    const end = Math.min(start + ETHEREUM_LOG_SPAN - 1, sourceBlock);
    let logs;
    try {
      logs = await getLogsWithRetry(provider, {
        address: BYTES_TOKEN_CONTRACT,
        topics: [TRANSFER_TOPIC],
        fromBlock: start,
        toBlock: end,
      }, evidence);
    } catch (error) {
      if (start === end) throw error;
      const middle = Math.floor((start + end) / 2);
      const left = await getLogsWithRetry(provider, { address: BYTES_TOKEN_CONTRACT, topics: [TRANSFER_TOPIC], fromBlock: start, toBlock: middle }, evidence);
      const right = await getLogsWithRetry(provider, { address: BYTES_TOKEN_CONTRACT, topics: [TRANSFER_TOPIC], fromBlock: middle + 1, toBlock: end }, evidence);
      logs = [...left, ...right];
    }
    for (const log of logs) {
      const parsed = TRANSFER_INTERFACE.parseLog(log);
      if (!parsed) throw new Error('unable to decode Ethereum Transfer event');
      const from = getAddress(parsed.args.from).toLowerCase();
      const to = getAddress(parsed.args.to).toLowerCase();
      const value = BigInt(parsed.args.value);
      addBalance(balances, from, -value);
      addBalance(balances, to, value);
      evidence.transferEventCount += 1;
    }
    start = end + 1;
  }
  const positive = new Map([...balances].filter(([, balance]) => balance > 0n));
  return { balances: positive, evidence };
}

async function fetchJson(path, attempt = 0) {
  const url = path.startsWith('http') ? path : `${ROUTESCAN_BASE}${path}`;
  try {
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'GridPhantomsBytesHolderSnapshot/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (attempt >= MAX_FETCH_RETRIES) throw error;
    await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
    return fetchJson(path, attempt + 1);
  }
}

async function collectAvalancheHolders() {
  const balances = new Map();
  let path = ROUTESCAN_HOLDER_PATH;
  let pageCount = 0;
  let excludedNonpositiveRows = 0;
  while (path) {
    const payload = await fetchJson(path);
    if (!Array.isArray(payload.items)) throw new Error('Routescan holder response has no items array');
    for (const row of payload.items) {
      if (String(row.chainId) !== String(AVALANCHE_CHAIN_ID)) throw new Error('Routescan holder row has wrong chain ID');
      const address = getAddress(row.address).toLowerCase();
      const balance = BigInt(row.balance);
      if (balance <= 0n) {
        excludedNonpositiveRows += 1;
        continue;
      }
      if (balances.has(address)) throw new Error(`duplicate Routescan holder row for ${address}`);
      balances.set(address, balance);
    }
    pageCount += 1;
    if (pageCount > 200) throw new Error('Routescan pagination exceeded safety bound');
    path = payload.link?.next ?? null;
  }
  return { balances, evidence: { pageCount, excludedNonpositiveRows } };
}

async function latestAvalancheIndexedTransfer() {
  const query = new URLSearchParams({
    module: 'account',
    action: 'tokentx',
    contractaddress: AVALANCHE_BYTES_TOKEN_CONTRACT,
    page: '1',
    offset: '1',
    sort: 'desc',
  });
  const payload = await fetchJson(`${ROUTESCAN_ETHERSCAN_PATH}?${query}`);
  if (payload.status !== '1' || !Array.isArray(payload.result) || payload.result.length !== 1) throw new Error('Routescan latest-transfer checkpoint unavailable');
  const row = payload.result[0];
  if (getAddress(row.contractAddress) !== AVALANCHE_BYTES_TOKEN_CONTRACT) throw new Error('Routescan latest-transfer checkpoint has wrong token');
  return { blockNumber: Number(row.blockNumber), blockHash: row.blockHash, timestamp: new Date(Number(row.timeStamp) * 1_000).toISOString() };
}

async function assertNoAvalancheTransferGap(provider, fromBlock, toBlock) {
  if (fromBlock > toBlock) return 0;
  let count = 0;
  for (let start = fromBlock; start <= toBlock; start += AVALANCHE_LOG_SPAN) {
    const end = Math.min(start + AVALANCHE_LOG_SPAN - 1, toBlock);
    const logs = await provider.getLogs({ address: AVALANCHE_BYTES_TOKEN_CONTRACT, topics: [TRANSFER_TOPIC], fromBlock: start, toBlock: end });
    count += logs.length;
  }
  if (count !== 0) throw new Error('Routescan Avalanche holder index lags a finalized Transfer event');
  return count;
}

function assertSupplyParity(name, balances, totalSupply) {
  const sum = [...balances.values()].reduce((total, value) => total + value, 0n);
  if (sum !== totalSupply) throw new Error(`${name} positive holder balances do not sum to totalSupply`);
  return sum;
}

export function validateHolderSnapshot(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) throw new Error('holder snapshot schemaVersion must equal 1');
  if (!Number.isFinite(Date.parse(value.generatedAt))) throw new Error('holder snapshot generatedAt must be canonical');
  for (const name of ['ethereum', 'avalanche']) {
    const chain = value.chains?.[name];
    if (!chain || !Number.isInteger(chain.chainId) || !Number.isInteger(chain.holderCount) || chain.holderCount <= 0) throw new Error(`${name} holder snapshot is invalid`);
    if (!/^0x[0-9a-f]{64}$/.test(chain.sourceBlockHash)) throw new Error(`${name} source block hash is invalid`);
    if (!/^[0-9a-f]{64}$/.test(chain.addressesSha256)) throw new Error(`${name} address digest is invalid`);
    if (!/^\d+$/.test(chain.totalSupplyRaw) || !/^\d+$/.test(chain.balanceSumRaw) || chain.totalSupplyRaw !== chain.balanceSumRaw) throw new Error(`${name} holder balance sum does not match total supply`);
  }
  if (!Number.isInteger(value.crossChain?.uniqueHolderCount) || !Number.isInteger(value.crossChain?.overlapCount)) throw new Error('cross-chain holder counts are invalid');
  if (value.crossChain.uniqueHolderCount !== value.chains.ethereum.holderCount + value.chains.avalanche.holderCount - value.crossChain.overlapCount) throw new Error('cross-chain holder union identity is invalid');
  if (!/^[0-9a-f]{64}$/.test(value.crossChain.addressesSha256)) throw new Error('cross-chain address digest is invalid');
  return value;
}

async function generate() {
  await Promise.all([
    loadEnvFile(new URL('../.env.local', import.meta.url)),
    loadEnvFile(new URL('../../../.hermes/.env', import.meta.url)),
  ]);
  if (!process.env.ALCHEMY_API_KEY) throw new Error('ALCHEMY_API_KEY is required');

  const ethereumRequest = new FetchRequest(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
  ethereumRequest.timeout = 60_000;
  const ethereum = new JsonRpcProvider(ethereumRequest, ETHEREUM_CHAIN_ID, { staticNetwork: true });
  const avalanche = new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc', AVALANCHE_CHAIN_ID, { staticNetwork: true });
  try {
    const [ethereumBlock, avalancheBlock] = await Promise.all([ethereum.getBlock('finalized'), avalanche.getBlock('finalized').catch(() => avalanche.getBlock('latest'))]);
    if (!ethereumBlock?.hash || !avalancheBlock?.hash) throw new Error('finalized holder snapshot blocks unavailable');

    const [ethereumLedger, avalancheLedger, checkpoint] = await Promise.all([
      collectEthereumHolders(ethereum, ethereumBlock.number),
      collectAvalancheHolders(),
      latestAvalancheIndexedTransfer(),
    ]);
    await assertNoAvalancheTransferGap(avalanche, checkpoint.blockNumber + 1, avalancheBlock.number);

    const [ethereumTotalSupply, avalancheTotalSupply] = await Promise.all([
      new Contract(BYTES_TOKEN_CONTRACT, ERC20_ABI, ethereum).totalSupply({ blockTag: ethereumBlock.number }),
      new Contract(AVALANCHE_BYTES_TOKEN_CONTRACT, ERC20_ABI, avalanche).totalSupply({ blockTag: avalancheBlock.number }),
    ]);
    const ethereumSum = assertSupplyParity('Ethereum', ethereumLedger.balances, ethereumTotalSupply);
    const avalancheSum = assertSupplyParity('Avalanche', avalancheLedger.balances, avalancheTotalSupply);

    const ethereumAddresses = new Set(ethereumLedger.balances.keys());
    const avalancheAddresses = new Set(avalancheLedger.balances.keys());
    const union = new Set([...ethereumAddresses, ...avalancheAddresses]);
    const overlapCount = [...ethereumAddresses].filter((address) => avalancheAddresses.has(address)).length;
    const generatedAt = new Date().toISOString();
    return validateHolderSnapshot({
      schemaVersion: 1,
      generatedAt,
      methodology: 'Positive ERC-20 balances only. Ethereum is reconstructed from every finalized Transfer event. Avalanche uses the Routescan positive-balance ledger only after exact totalSupply parity and a direct finalized-chain check finds no Transfer events after Routescan’s latest indexed token transfer. Addresses are normalized to lowercase only for cross-chain union and hashing; wallet lists are not published.',
      chains: {
        ethereum: {
          chainId: ETHEREUM_CHAIN_ID,
          tokenContract: BYTES_TOKEN_CONTRACT,
          method: 'finalized-transfer-log-reconstruction',
          sourceBlock: ethereumBlock.number,
          sourceBlockHash: ethereumBlock.hash,
          asOf: new Date(ethereumBlock.timestamp * 1_000).toISOString(),
          deploymentBlock: ETHEREUM_DEPLOYMENT_BLOCK,
          holderCount: ethereumAddresses.size,
          addressesSha256: digestAddresses(ethereumAddresses),
          totalSupplyRaw: ethereumTotalSupply.toString(),
          balanceSumRaw: ethereumSum.toString(),
          evidence: ethereumLedger.evidence,
        },
        avalanche: {
          chainId: AVALANCHE_CHAIN_ID,
          tokenContract: AVALANCHE_BYTES_TOKEN_CONTRACT,
          method: 'routescan-positive-balance-ledger-with-direct-chain-parity-and-gap-check',
          sourceBlock: avalancheBlock.number,
          sourceBlockHash: avalancheBlock.hash,
          asOf: new Date(avalancheBlock.timestamp * 1_000).toISOString(),
          holderCount: avalancheAddresses.size,
          addressesSha256: digestAddresses(avalancheAddresses),
          totalSupplyRaw: avalancheTotalSupply.toString(),
          balanceSumRaw: avalancheSum.toString(),
          latestIndexedTransferBlock: checkpoint.blockNumber,
          latestIndexedTransferBlockHash: checkpoint.blockHash,
          latestIndexedTransferAt: checkpoint.timestamp,
          evidence: avalancheLedger.evidence,
        },
      },
      crossChain: {
        uniqueHolderCount: union.size,
        overlapCount,
        addressesSha256: digestAddresses(union),
        method: 'lowercase Ethereum address union across the two validated positive-balance ledgers',
      },
    });
  } finally {
    ethereum.destroy();
    avalanche.destroy();
  }
}

const validateOnly = process.argv.includes('--validate');
if (validateOnly) {
  const current = JSON.parse(await readFile(OUTPUT_URL, 'utf8'));
  validateHolderSnapshot(current);
  console.log(`Validated ${current.crossChain.uniqueHolderCount.toLocaleString('en-US')} cross-chain unique BYTES holders.`);
} else {
  const snapshot = await generate();
  await writeFile(OUTPUT_URL, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${snapshot.chains.ethereum.holderCount.toLocaleString('en-US')} Ethereum, ${snapshot.chains.avalanche.holderCount.toLocaleString('en-US')} Avalanche, and ${snapshot.crossChain.uniqueHolderCount.toLocaleString('en-US')} cross-chain unique BYTES holders.`);
}
