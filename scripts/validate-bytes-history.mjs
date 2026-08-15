import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const historyPath = path.resolve(process.cwd(), 'public/data/bytes-emissions-history.json');
const tolerance = 1e-8;
const verifiedStakingContract = '0x67e1eCFA9232E27EAf3133B968A33A9a0dCa9e16';
const canonicalIsoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const utcDate = /^\d{4}-\d{2}-\d{2}$/;

function fail(message) {
  throw new Error(`BYTES history validation failed: ${message}`);
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string' || !canonicalIsoTimestamp.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function dateToEpochDay(value) {
  if (typeof value !== 'string' || !utcDate.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const milliseconds = Date.UTC(year, month - 1, day);
  const normalized = new Date(milliseconds).toISOString().slice(0, 10);
  return normalized === value ? milliseconds / 86_400_000 : null;
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${name} must be a non-empty string`);
}

const document = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
if (document.schemaVersion !== 1) fail('schemaVersion must equal 1');
if (!isCanonicalIsoTimestamp(document.generatedAt)) fail('generatedAt must be a canonical ISO timestamp');
if (!Number.isInteger(document.sourceBlock) || document.sourceBlock <= 0) fail('sourceBlock must be a positive integer');
if (!document.methodology || typeof document.methodology !== 'object' || Array.isArray(document.methodology)) fail('methodology is required');
if (!Array.isArray(document.rows) || document.rows.length === 0) fail('rows must be a non-empty array');

for (const field of ['classification', 'source', 'contract', 'normalization']) {
  requireNonEmptyString(document.methodology[field], `methodology.${field}`);
}
if (document.methodology.classification !== 'calculated') fail('methodology.classification must equal calculated');
if (document.methodology.contract !== verifiedStakingContract) fail('methodology.contract must equal the verified staking contract');
const expectedPools = { 0: 'S1', 1: 'S2', 2: 'BYTES', 3: 'LP' };
if (!document.methodology.pools || typeof document.methodology.pools !== 'object' || Array.isArray(document.methodology.pools)) {
  fail('methodology.pools is required');
}
for (const [pool, label] of Object.entries(expectedPools)) {
  if (document.methodology.pools[pool] !== label) fail(`methodology.pools.${pool} must equal ${label}`);
}
if (Object.keys(document.methodology.pools).length !== Object.keys(expectedPools).length) fail('methodology.pools contains unexpected entries');

const startDay = dateToEpochDay(document.start);
const endDay = dateToEpochDay(document.end);
if (startDay === null) fail('start must be a valid UTC date');
if (endDay === null) fail('end must be a valid UTC date');
if (endDay < startDay) fail('end must be on or after start');
if (document.start !== document.rows[0].date) fail('start must match the first row date');
if (document.end !== document.rows.at(-1).date) fail('end must match the last row date');

let priorEpochDay = null;
for (const [index, row] of document.rows.entries()) {
  const epochDay = dateToEpochDay(row.date);
  if (epochDay === null) fail(`row ${index} has an invalid UTC date`);
  if (priorEpochDay !== null && epochDay !== priorEpochDay + 1) {
    fail(`row ${index} must be exactly one UTC day after the prior row`);
  }
  priorEpochDay = epochDay;

  for (const field of ['S1', 'S2', 'BYTES', 'LP', 'total']) {
    if (!Number.isFinite(row[field]) || row[field] < 0) fail(`row ${index} ${field} must be finite and non-negative`);
  }
  const sum = row.S1 + row.S2 + row.BYTES + row.LP;
  if (Math.abs(row.total - sum) > tolerance) fail(`row ${index} total differs from the pool sum`);
}

console.log(`Validated ${document.rows.length} BYTES emissions history rows (${document.rows[0].date} through ${document.rows.at(-1).date}).`);
