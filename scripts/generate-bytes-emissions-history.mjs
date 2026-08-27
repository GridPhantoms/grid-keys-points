#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Interface, JsonRpcProvider, formatUnits } from 'ethers';

const DAY_SECONDS = 86_400;
const HISTORY_START = Date.parse('2023-06-01T00:00:00Z') / 1_000;
const STAKING_CONTRACT = '0x67e1eCFA9232E27EAf3133B968A33A9a0dCa9e16';
const POOLS = Object.freeze([
  { id: 0, label: 'S1' },
  { id: 1, label: 'S2' },
  { id: 2, label: 'BYTES' },
  { id: 3, label: 'LP' },
]);
const BATCH_SIZE = 100;
const iface = new Interface(['function getTotalEmissions(uint8 assetType,uint256 fromTimestamp) view returns (uint256)']);

export function completedUtcBoundary(epochSeconds) {
  if (!Number.isInteger(epochSeconds) || epochSeconds <= 0) throw new TypeError('epochSeconds must be a positive integer');
  return Math.floor(epochSeconds / DAY_SECONDS) * DAY_SECONDS;
}

export function utcDayBoundaries(startSeconds, endExclusiveSeconds) {
  if (!Number.isInteger(startSeconds) || !Number.isInteger(endExclusiveSeconds)) throw new TypeError('UTC boundaries must be integers');
  if (startSeconds % DAY_SECONDS !== 0 || endExclusiveSeconds % DAY_SECONDS !== 0) throw new RangeError('UTC boundaries must be midnight-aligned');
  if (endExclusiveSeconds <= startSeconds) throw new RangeError('End boundary must be after start boundary');
  const values = [];
  for (let value = startSeconds; value <= endExclusiveSeconds; value += DAY_SECONDS) values.push(value);
  return values;
}

function dailyDifference(values, index) {
  const current = values[index];
  const next = values[index + 1];
  if (typeof current === 'bigint' && typeof next === 'bigint') {
    const difference = current - next;
    if (difference < 0n) throw new Error(`Cumulative emissions increased unexpectedly at interval ${index}`);
    return Number(formatUnits(difference, 18));
  }
  const difference = Number(current) - Number(next);
  if (!Number.isFinite(difference) || difference < 0) throw new Error(`Invalid cumulative emissions at interval ${index}`);
  return difference;
}

export function buildHistoryDocument({ boundaries, cumulative, generatedAt, sourceBlock, sourceBlockHash }) {
  if (!Array.isArray(boundaries) || boundaries.length < 2) throw new TypeError('At least two UTC boundaries are required');
  for (const { label } of POOLS) {
    if (!Array.isArray(cumulative[label]) || cumulative[label].length !== boundaries.length) {
      throw new Error(`${label} cumulative series must match the UTC boundaries`);
    }
  }
  const rows = boundaries.slice(0, -1).map((timestamp, index) => {
    const row = { date: new Date(timestamp * 1_000).toISOString().slice(0, 10) };
    for (const { label } of POOLS) row[label] = dailyDifference(cumulative[label], index);
    row.total = POOLS.reduce((sum, { label }) => sum + row[label], 0);
    return row;
  });
  return {
    schemaVersion: 1,
    generatedAt,
    sourceBlock,
    ...(sourceBlockHash ? { sourceBlockHash } : {}),
    methodology: {
      classification: 'calculated',
      source: 'Neo Tokyo staking contract getTotalEmissions cumulative differences',
      contract: STAKING_CONTRACT,
      normalization: 'Each row is one complete 24-hour UTC interval reconstructed from cumulative contract emissions at a single pinned Ethereum block.',
      pools: Object.fromEntries(POOLS.map(({ id, label }) => [id, label])),
    },
    start: rows[0].date,
    end: rows.at(-1).date,
    rows,
  };
}

export function preserveStableRows(document, priorDocument, tolerance = 1e-8) {
  if (!priorDocument || !Array.isArray(priorDocument.rows)) return document;
  const priorByDate = new Map(priorDocument.rows.map((row) => [row.date, row]));
  const fields = POOLS.map(({ label }) => label).concat('total');
  document.rows = document.rows.map((row) => {
    const prior = priorByDate.get(row.date);
    if (!prior) return row;
    const equivalent = fields.every((field) => Number.isFinite(prior[field]) && Math.abs(prior[field] - row[field]) <= tolerance);
    return equivalent ? prior : row;
  });
  return document;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function rpcUrl() {
  if (process.env.ETHEREUM_RPC_URL) return process.env.ETHEREUM_RPC_URL;
  const key = process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!key) throw new Error('Ethereum RPC configuration is unavailable');
  return `https://eth-mainnet.g.alchemy.com/v2/${key}`;
}

async function rpcBatch(url, calls, blockTag) {
  const body = calls.map((call, id) => ({
    jsonrpc: '2.0',
    id,
    method: 'eth_call',
    params: [call, blockTag],
  }));
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'GridPhantomsBytesHistory/1.0' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Ethereum RPC batch returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error('Ethereum RPC batch returned an invalid payload');
  const byId = new Map(payload.map((item) => [item.id, item]));
  return body.map(({ id }) => {
    const item = byId.get(id);
    if (!item) throw new Error(`Ethereum RPC batch omitted response ${id}`);
    if (item.error) throw new Error(`Ethereum RPC batch failed: ${item.error.message ?? 'unknown error'}`);
    return item.result;
  });
}

async function cumulativePool(url, blockTag, pool, boundaries) {
  const values = [];
  const calls = boundaries.map((timestamp) => ({
    to: STAKING_CONTRACT,
    data: iface.encodeFunctionData('getTotalEmissions', [pool.id, timestamp]),
  }));
  for (let index = 0; index < calls.length; index += BATCH_SIZE) {
    const results = await rpcBatch(url, calls.slice(index, index + BATCH_SIZE), blockTag);
    for (const result of results) {
      const [amount] = iface.decodeFunctionResult('getTotalEmissions', result);
      values.push(amount);
    }
  }
  return [pool.label, values];
}

function parseOutputPath(argv) {
  const index = argv.indexOf('--output');
  if (index === -1) return path.resolve(process.cwd(), 'public/data/bytes-emissions-history.json');
  if (!argv[index + 1]) throw new Error('--output requires a path');
  return path.resolve(process.cwd(), argv[index + 1]);
}

async function main() {
  loadEnvFile(path.join(os.homedir(), '.hermes', '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  const url = rpcUrl();
  const provider = new JsonRpcProvider(url, undefined, { staticNetwork: true });
  const [network, block] = await Promise.all([provider.getNetwork(), provider.getBlock('latest')]);
  if (network.chainId !== 1n) throw new Error('Ethereum RPC chain mismatch');
  if (!block?.hash) throw new Error('Pinned Ethereum source block is unavailable');

  const endExclusive = completedUtcBoundary(block.timestamp);
  const boundaries = utcDayBoundaries(HISTORY_START, endExclusive);
  const blockTag = `0x${block.number.toString(16)}`;
  const entries = [];
  for (const pool of POOLS) entries.push(await cumulativePool(url, blockTag, pool, boundaries));
  const document = buildHistoryDocument({
    boundaries,
    cumulative: Object.fromEntries(entries),
    generatedAt: new Date(block.timestamp * 1_000).toISOString(),
    sourceBlock: block.number,
    sourceBlockHash: block.hash,
  });

  const outputPath = parseOutputPath(process.argv.slice(2));
  let priorDocument = null;
  if (fs.existsSync(outputPath)) {
    try {
      priorDocument = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    } catch {
      throw new Error('Existing emissions history is not valid JSON');
    }
  }
  preserveStableRows(document, priorDocument);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(document, null, 2)}\n`);
  fs.renameSync(temporaryPath, outputPath);
  console.log(JSON.stringify({
    output: outputPath,
    sourceBlock: document.sourceBlock,
    generatedAt: document.generatedAt,
    samples: document.rows.length,
    start: document.start,
    end: document.end,
    latest: document.rows.at(-1),
  }));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
