#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const archiveArg = process.argv[2];
if (!archiveArg) throw new Error('Usage: node scripts/generate-credits-intelligence-snapshot.mjs <verified-scheduled-archive>');

const archive = path.resolve(archiveArg);
const snapshotId = path.basename(archive);
if (!snapshotId.endsWith('-scheduled')) throw new Error('Only cadence-aligned *-scheduled archives may be published');

const projectRoot = path.resolve(import.meta.dirname, '..');
const overviewPath = path.join(projectRoot, 'data', 'credits-overview.json');
const statementsPath = path.join(projectRoot, 'data', 'credits-statements.json');
const [verification, live, market, ownership] = await Promise.all([
  readFile(path.join(archive, 'verification.json'), 'utf8').then(JSON.parse),
  readFile(path.join(archive, 'live-snapshot.json'), 'utf8').then(JSON.parse),
  readFile(path.join(archive, 'market-snapshot.json'), 'utf8').then(JSON.parse),
  readFile(path.join(archive, 'ownership-snapshot-post-statements.json'), 'utf8').then(JSON.parse),
]);

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

requireValue(verification.status === 'verified', 'Archive verification status is not verified');
requireValue(verification.review_only === true, 'Archive must remain review-only');
requireValue(verification.publication_authorized === false, 'Social publication authorization must remain false');
requireValue(live.status === 'verified', 'Live snapshot status is not verified');
requireValue(ownership.status === 'verified', 'Ownership snapshot status is not verified');
requireValue(verification.onchain_block === live.onchain_block, 'Verification/live block mismatch');
requireValue(verification.onchain_block === ownership.block_number, 'Verification/ownership block mismatch');
requireValue(verification.onchain_block_hash === live.onchain_block_hash, 'Verification/live block hash mismatch');
requireValue(verification.onchain_block_hash === ownership.block_hash, 'Verification/ownership block hash mismatch');
requireValue(verification.market_completed_at_utc === market.completed_at_utc, 'Verification/market completion mismatch');
requireValue(String(verification.eth_usd_close).length > 0, 'Verified archived ETH/USD close is missing');
requireValue(verification.eth_usd_candle_start_utc, 'Verified archived ETH/USD candle timestamp is missing');

const original = Number(verification.ownership.reconciled_original_supply);
const loose = Number(verification.ownership.unique_live_tokens);
const burned = Number(verification.ownership.protocol_burned_tokens);
const active = Number(live.statements.active);
const listed = Number(live.statements.listed);
const totalUnderlyingCredits = Number(live.statements.total_underlying_credits);
const stageCounts = live.statements.stage_counts;
requireValue(original === 122154 && loose + burned === original, 'Supply reconciliation failed');
requireValue(ownership.unique_live_tokens === loose && ownership.protocol_burned_tokens === burned, 'Ownership export mismatch');
requireValue(live.credits.loose_live_supply === loose && live.credits.burned_into_active_statements === burned, 'Live protocol export mismatch');
requireValue(Number.isInteger(active) && active >= 0, 'Live active Statement count is invalid');
requireValue(Number.isInteger(listed) && listed >= 0, 'Live listed Statement count is invalid');
requireValue(Number.isInteger(totalUnderlyingCredits) && totalUnderlyingCredits >= 0, 'Live underlying CREDIT count is invalid');
requireValue(stageCounts && typeof stageCounts === 'object' && !Array.isArray(stageCounts), 'Live Statement stage counts are missing');
requireValue(Array.isArray(live.statements.all_active) && live.statements.all_active.length === active, 'Active Statement coverage mismatch');
requireValue(Array.isArray(live.statements.rating_value_listed) && live.statements.rating_value_listed.length === listed, 'Statement listing count mismatch');
requireValue(market.unique_listed_tokens === verification.market.unique_listed_tokens, 'Market listing count mismatch');
requireValue(market.rating_listing_coverage_count === market.unique_listed_tokens, 'Archived market rating coverage is incomplete');

// Older verification manifests duplicated the Statement summary. Newer report
// manifests keep the canonical protocol export in live-snapshot.json. When the
// duplicate block exists, retain it as an additional cross-check rather than a
// required schema dependency.
if (verification.statements !== undefined) {
  requireValue(Number(verification.statements.active) === active, 'Verification/live active Statement mismatch');
  requireValue(Number(verification.statements.listed) === listed, 'Verification/live listed Statement mismatch');
  requireValue(Number(verification.statements.credits_burned_into_statements) === totalUnderlyingCredits, 'Verification/live underlying CREDIT mismatch');
  requireValue(canonical(verification.statements.stage_counts) === canonical(stageCounts), 'Verification/live Statement stage-count mismatch');
}

const statementItems = live.statements.all_active.map((item) => ({
  tokenId: Number(item.token_id),
  format: String(item.format),
  credits: Number(item.credits),
  overprints: Number(item.overprints),
  layers: Number(item.layers),
  creditRating: Number(item.credit_rating),
  avgRatingPerCredit: Number(item.avg_rating_per_credit),
  stage: String(item.stage),
})).sort((a, b) => a.tokenId - b.tokenId);
requireValue(new Set(statementItems.map((item) => item.tokenId)).size === active, 'Statement token IDs are not unique');
requireValue(statementItems.reduce((sum, item) => sum + item.credits, 0) === burned, 'Statement CREDIT total mismatch');
const totalCreditRating = statementItems.reduce((sum, item) => sum + item.creditRating, 0);
requireValue(Number.isFinite(totalCreditRating) && totalCreditRating > 0, 'Statement Credit Rating total is invalid');

const capturedAt = verification.market_completed_at_utc;
const provenance = {
  snapshotId,
  status: 'verified',
  cadence: 'scheduled',
  protocolBlock: Number(verification.onchain_block),
  protocolBlockHash: String(verification.onchain_block_hash),
  protocolBlockTime: String(verification.onchain_block_time_utc),
  marketStartedAt: String(market.started_at_utc),
  marketCompletedAt: String(market.completed_at_utc),
  ethUsdCandleStart: String(verification.eth_usd_candle_start_utc),
  sourceFiles: ['verification.json', 'live-snapshot.json', 'market-snapshot.json', 'ownership-snapshot-post-statements.json'],
};

const overviewBase = {
  schemaVersion: 2,
  snapshotAsOf: capturedAt,
  sourceLabel: 'Verified cadence-aligned CREDITS DAILY archive',
  sourceUrl: '/credits/value',
  provenance,
  supply: { original, loose, burned, burnedPct: Number(((burned / original) * 100).toFixed(4)) },
  statements: {
    active,
    listed,
    totalUnderlyingCredits,
    totalCreditRating,
    stageCounts,
  },
  archivedReferences: {
    marketAsOf: String(market.completed_at_utc),
    looseListings: Number(market.unique_listed_tokens),
    looseFloorEth: Number(market.floor_eth),
    within25PctOfFloor: Number(market.within_25pct_of_floor),
    ethUsdCandleStart: String(verification.eth_usd_candle_start_utc),
    ethUsdClose: Number(verification.eth_usd_close),
    executableNow: false,
  },
};
const statementsBase = { schemaVersion: 2, snapshotAsOf: capturedAt, provenance, activeCount: active, items: statementItems };
const artifactSetDigest = sha256(canonical({ overview: overviewBase, statements: statementsBase }));
const overviewExport = { ...overviewBase, artifactSetDigest };
const statementsExport = { ...statementsBase, artifactSetDigest };

const prohibited = /\b(owner|seller|orderHash|wallet|address|private_holder|private_market)\b/i;
requireValue(!prohibited.test(JSON.stringify(overviewExport)), 'Overview export contains prohibited public fields');
requireValue(!prohibited.test(JSON.stringify(statementsExport)), 'Statement export contains prohibited public fields');

await Promise.all([
  writeFile(overviewPath, `${JSON.stringify(overviewExport, null, 2)}\n`),
  writeFile(statementsPath, `${JSON.stringify(statementsExport, null, 2)}\n`),
]);
console.log(JSON.stringify({ snapshotId, capturedAt, protocolBlock: provenance.protocolBlock, activeStatements: active, loose, burned, artifactSetDigest }, null, 2));
