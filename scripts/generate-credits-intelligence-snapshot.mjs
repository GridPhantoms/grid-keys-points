#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const snapshotDir = process.argv[2];
if (!snapshotDir) {
  throw new Error('Usage: node scripts/generate-credits-intelligence-snapshot.mjs <verified-snapshot-directory>');
}

const projectRoot = path.resolve(import.meta.dirname, '..');
const overviewPath = path.join(projectRoot, 'data', 'credits-overview.json');
const statementsPath = path.join(projectRoot, 'data', 'credits-statements.json');
const [verification, live, market, previousOverview] = await Promise.all([
  readJson(path.join(snapshotDir, 'verification.json')),
  readJson(path.join(snapshotDir, 'live-snapshot.json')),
  readJson(path.join(snapshotDir, 'market-snapshot.json')),
  readJson(overviewPath),
]);

if (verification.status !== 'verified' || verification.review_only !== true) {
  throw new Error('CREDITS source package is not a verified review-only snapshot');
}
if (verification.onchain_block !== live.onchain_block || verification.onchain_block_hash !== live.onchain_block_hash) {
  throw new Error('CREDITS source package block identity does not reconcile');
}
if (verification.market_completed_at_utc !== market.completed_at_utc) {
  throw new Error('CREDITS source package market completion does not reconcile');
}

const activeStatements = live.statements.all_active;
if (!Array.isArray(activeStatements) || activeStatements.length !== live.statements.active) {
  throw new Error('Active Statement metadata is incomplete');
}
const publicStatements = activeStatements
  .map((item) => ({
    tokenId: Number(item.token_id),
    format: String(item.format),
    stage: String(item.stage),
    credits: Number(item.credits),
    layers: Number(item.layers),
    creditRating: Number(item.credit_rating),
  }))
  .sort((a, b) => a.tokenId - b.tokenId);

const creditsInStatements = publicStatements.reduce((sum, item) => sum + item.credits, 0);
const stageCounts = publicStatements.reduce((counts, item) => {
  counts[item.stage] = (counts[item.stage] || 0) + 1;
  return counts;
}, {});
if (creditsInStatements !== live.credits.burned_into_active_statements) {
  throw new Error('Statement CREDIT total does not reconcile');
}
if (JSON.stringify(stageCounts) !== JSON.stringify(live.statements.stage_counts)) {
  throw new Error('Statement stage counts do not reconcile');
}

const officialResponse = await fetch('https://jack.art/credits/rating/api/market-snapshot', {
  cache: 'no-store',
  headers: { accept: 'application/json', 'user-agent': 'GridPhantomsCreditsSnapshot/1.0' },
  signal: AbortSignal.timeout(30_000),
});
if (!officialResponse.ok) throw new Error(`Official rating snapshot unavailable (${officialResponse.status})`);
const official = await officialResponse.json();
if (official.complete !== true || !Array.isArray(official.items)) {
  throw new Error('Official rating snapshot is incomplete');
}
const scoreById = new Map(official.items.map((item) => [Number(item.id), Number(item.score)]));
const basketIds = live.credits.basket_80?.token_ids;
if (!Array.isArray(basketIds) || basketIds.length !== 80) {
  throw new Error('Executable 80-CREDIT basket is unavailable');
}
const basketScores = basketIds.map((tokenId) => scoreById.get(Number(tokenId)));
if (basketScores.some((score) => !Number.isFinite(score))) {
  throw new Error('Official rating coverage is incomplete for the executable basket');
}

const baseFloor = live.statements.stage_floors?.BASE;
const baseFloorStatement = publicStatements.find((item) => item.tokenId === Number(baseFloor?.floor_token_id));
if (!baseFloorStatement || !Number.isFinite(Number(baseFloor?.floor_eth))) {
  throw new Error('Base Statement floor does not reconcile to active metadata');
}

const snapshotAsOf = market.completed_at_utc;
const sourceDate = new Date(snapshotAsOf).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const ethUsd = Number(live.eth_usd.close_usd);
const looseBasketEth = Number(live.credits.basket_80.subtotal_eth);
const looseBasketCr = basketScores.reduce((sum, score) => sum + score, 0);

const overview = {
  snapshotAsOf,
  sourceLabel: `Verified ${sourceDate} snapshot`,
  market: {
    looseListings: Number(market.unique_listed_tokens),
    looseFloorEth: Number(market.floor_eth),
    within25PctOfFloor: Number(market.within_25pct_of_floor),
    ethUsd,
  },
  supply: {
    original: Number(live.credits.original_supply),
    loose: Number(live.credits.loose_live_supply),
    burnedIntoStatements: Number(live.credits.burned_into_active_statements),
    burnedPct: Number(live.credits.burned_pct_original_supply),
  },
  statements: {
    active: Number(live.statements.active),
    listed: Number(live.statements.listed),
    creditsLocked: Number(live.statements.total_underlying_credits),
    stageCounts,
    floorEth: Number(baseFloor.floor_eth),
  },
  buildVsBuy: {
    looseBasketCredits: 80,
    looseBasketEth,
    looseBasketCr,
    statementFloorEth: Number(baseFloor.floor_eth),
    statementFloorCr: baseFloorStatement.creditRating,
    statementFloorTokenId: baseFloorStatement.tokenId,
  },
};

if (overview.supply.loose + overview.supply.burnedIntoStatements !== overview.supply.original) {
  throw new Error('Overview supply does not reconcile');
}
if (overview.snapshotAsOf <= previousOverview.snapshotAsOf) {
  console.log(JSON.stringify({ status: 'unchanged', snapshotAsOf: overview.snapshotAsOf }));
  process.exit(0);
}

await Promise.all([
  writeFile(overviewPath, `${JSON.stringify(overview, null, 2)}\n`),
  writeFile(statementsPath, `${JSON.stringify({ snapshotAsOf, items: publicStatements }, null, 2)}\n`),
]);

console.log(JSON.stringify({
  status: 'updated',
  snapshotAsOf,
  activeStatements: publicStatements.length,
  burnedIntoStatements: creditsInStatements,
  looseSupply: overview.supply.loose,
  stageCounts,
}));

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}
