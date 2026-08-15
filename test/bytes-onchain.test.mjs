import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildParticipantSnapshot,
  mergeParticipantAddresses,
  pendingRewardsMetric,
  tokenMetrics,
  validateParticipantSnapshot,
  validatePendingWorkBounds,
  verifyCanonicalTokenLinks,
} from '../lib/bytes-onchain.mjs';

const STAKING = '0x67e1eCFA9232E27EAf3133B968A33A9a0dCa9e16';
const TOKEN = '0xa19f5264F7D7Be11c451C093D8f92592820Bea86';
const AS_OF = '2026-08-15T00:23:23.000Z';
const A = '0x0000000000000000000000000000000000000001';
const B = '0x0000000000000000000000000000000000000002';
const C = '0x0000000000000000000000000000000000000003';

function snapshot() {
  return buildParticipantSnapshot({
    generatedAt: AS_OF,
    sourceBlock: 25_758_127,
    sourceBlockHash: `0x${'ab'.repeat(32)}`,
    deploymentBlock: 17_487_669,
    contract: STAKING,
    evidence: {
      collectorVersion: '1.0.0',
      stakeEventCount: 2,
      claimEventCount: 1,
      uniqueStakeParticipants: 2,
      uniqueClaimRecipients: 1,
      logQueryCalls: 3,
      logQueryRetries: 0,
    },
    addresses: [B, A, B],
  });
}

test('participant snapshot is deterministic, deduplicated, sorted, and strictly validated', () => {
  const value = snapshot();
  assert.deepEqual(value.addresses, [A, B]);
  assert.equal(value.count, 2);
  assert.equal(value.methodology, 'Unique Stake.staker and Claim.recipient addresses from deploymentBlock through sourceBlock inclusive; checksummed, deduplicated, and sorted by lowercase address.');
  assert.equal(validateParticipantSnapshot(value, {
    contract: STAKING,
    deploymentBlock: 17_487_669,
    sourceBlock: 25_758_127,
    sourceBlockHash: `0x${'ab'.repeat(32)}`,
    count: 2,
    addressesSha256: value.addressesSha256,
  }), value);

  const unsorted = structuredClone(value);
  unsorted.addresses.reverse();
  assert.throws(() => validateParticipantSnapshot(unsorted, { contract: STAKING, deploymentBlock: 17_487_669 }), /sorted/);

  const wrongCount = structuredClone(value);
  wrongCount.count = 3;
  assert.throws(() => validateParticipantSnapshot(wrongCount, { contract: STAKING, deploymentBlock: 17_487_669 }), /count/);

  const truncated = structuredClone(value);
  truncated.addresses.pop();
  truncated.count = 1;
  truncated.addressesSha256 = '0'.repeat(64);
  assert.throws(() => validateParticipantSnapshot(truncated, { count: 2, addressesSha256: value.addressesSha256 }), /digest|count/);
});

test('pending aggregation work limits fail closed before unbounded RPC work', () => {
  const limits = { maxDeltaBlocks: 250_000, maxParticipants: 5_000, maxChunks: 32 };
  assert.equal(validatePendingWorkBounds({ snapshotBlock: 100, currentBlock: 200, participantCount: 3_318, chunkCount: 20 }, limits), true);
  assert.throws(() => validatePendingWorkBounds({ snapshotBlock: 100, currentBlock: 250_101, participantCount: 3_318, chunkCount: 20 }, limits), /delta/);
  assert.throws(() => validatePendingWorkBounds({ snapshotBlock: 100, currentBlock: 200, participantCount: 5_001, chunkCount: 31 }, limits), /participant/);
  assert.throws(() => validatePendingWorkBounds({ snapshotBlock: 100, currentBlock: 200, participantCount: 5_000, chunkCount: 33 }, limits), /chunk/);
});

test('delta participants merge with the validated snapshot deterministically', () => {
  assert.deepEqual(mergeParticipantAddresses(snapshot(), [C, A]), [A, B, C]);
});

test('canonical token identity requires both staking-to-token and token-to-staking links', () => {
  assert.equal(verifyCanonicalTokenLinks(TOKEN, STAKING, 18n, { tokenContract: TOKEN, stakingContract: STAKING }), true);
  assert.equal(verifyCanonicalTokenLinks(A, STAKING, 18n, { tokenContract: TOKEN, stakingContract: STAKING }), false);
  assert.equal(verifyCanonicalTokenLinks(TOKEN, A, 18n, { tokenContract: TOKEN, stakingContract: STAKING }), false);
  assert.equal(verifyCanonicalTokenLinks(TOKEN, STAKING, 6n, { tokenContract: TOKEN, stakingContract: STAKING }), false);
});

test('verified token metrics preserve exact 18-decimal values and bidirectional provenance', () => {
  const metrics = tokenMetrics({
    totalSupply: 5_215_262_041_121_429_365_412_430n,
    stakingBalance: 1_853_137_000_000_000_000_000_000n,
    asOf: AS_OF,
  });
  assert.equal(metrics.ethBytes2Supply.value, 5_215_262.04112143);
  assert.equal(metrics.ethBytes2Supply.rawValue, '5215262.04112142936541243');
  assert.equal(metrics.ethBytes2Supply.source, 'canonical-ethereum-bytes:totalSupply');
  assert.match(metrics.ethBytes2Supply.formula, /staking\.BYTES\(\).*token\.STAKER\(\).*token\.decimals\(\)/);
  assert.equal(metrics.bytesHeldByStakingContract.value, 1_853_137);
  assert.equal(metrics.bytesHeldByStakingContract.rawValue, '1853137.0');
});

test('pending aggregate reports user rewards only and preserves DAO tax separately', () => {
  const metric = pendingRewardsMetric({
    reward: 870_970_189_837_981_616_925_528n,
    tax: 26_937_222_366_123_142_790_828n,
    asOf: AS_OF,
    participantCount: 3_318,
    snapshotBlock: 25_758_127,
  });
  assert.equal(metric.value, 870_970.1898379816);
  assert.equal(metric.rawValue, '870970.189837981616925528');
  assert.equal(metric.classification, 'calculated');
  assert.equal(metric.daoTaxExcluded, 26_937.222366123143);
  assert.equal(metric.daoTaxExcludedRawValue, '26937.222366123142790828');
  assert.deepEqual(metric.assumptions, [
    '3,318 indexed participants from Stake.staker and Claim.recipient events',
    'Economically claimable staking pools S1 (0), S2 (1), and LP (3); claimReward does not claim pool 2',
    'DAO tax is summed separately and excluded from the net pending reward snapshot aggregate',
    'Snapshot source block 25,758,127 plus event-log delta through the response source block',
  ]);
});
