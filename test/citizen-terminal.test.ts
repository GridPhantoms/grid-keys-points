import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { calculateStakingPoints, getStakingBytesCap } from '../lib/citizen-terminal.ts';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { extractOpenSeaEstimatedRank } from '../lib/opensea-rarity.ts';

test('S2 accepts 200 BYTES and never calculates more than one BYTES point', () => {
  const atCap = calculateStakingPoints({ season: 's2', lockPeriod: '12 months', bytesStaked: 200 });
  const overCap = calculateStakingPoints({ season: 's2', lockPeriod: '12 months', bytesStaked: 999_999 });

  assert.equal(atCap.bytesStaked, 200);
  assert.equal(atCap.bytesPoints, 1);
  assert.equal(atCap.totalPoints, 2.75);
  assert.equal(atCap.wasClamped, false);
  assert.equal(overCap.bytesStaked, 200);
  assert.equal(overCap.bytesPoints, 1);
  assert.equal(overCap.totalPoints, 2.75);
  assert.equal(overCap.wasClamped, true);
});

test('vaultless S1 uses the same 200 BYTES cap', () => {
  const result = calculateStakingPoints({
    season: 's1',
    creditYield: 'High',
    vaultMultiplier: 'None',
    lockPeriod: '12 months',
    bytesStaked: 500,
    hasVault: false,
  });

  assert.equal(getStakingBytesCap('s1', false), 200);
  assert.equal(result.bytesStaked, 200);
  assert.equal(result.bytesPoints, 1);
  assert.equal(result.totalPoints, 7);
  assert.equal(result.wasClamped, true);
});

test('vaulted S1 retains the configured 2,000 BYTES cap', () => {
  const result = calculateStakingPoints({
    season: 's1',
    creditYield: 'Low',
    vaultMultiplier: 'Low',
    lockPeriod: '1 month',
    bytesStaked: 2_001,
    hasVault: true,
  });

  assert.equal(getStakingBytesCap('s1', true), 2_000);
  assert.equal(result.bytesStaked, 2_000);
  assert.equal(result.bytesPoints, 10);
  assert.equal(result.totalPoints, 11);
  assert.equal(result.wasClamped, true);
});

test('invalid and negative BYTES inputs contribute zero points', () => {
  assert.equal(calculateStakingPoints({ season: 's2', bytesStaked: Number.NaN }).bytesPoints, 0);
  assert.equal(calculateStakingPoints({ season: 's2', bytesStaked: -50 }).bytesPoints, 0);
});

test('OpenSea estimated rank parser validates the requested item', () => {
  const contract = '0x4481507cc228FA19D203BD42110d679571f7912E';
  const html = '<script>{"itemByIdentifier":{"contractAddress":"0x4481507cc228fa19d203bd42110d679571f7912e","tokenId":"739","rarity":{"rank":680,"category":"RARE"}}}</script>';
  assert.equal(extractOpenSeaEstimatedRank(html, contract, '739'), 680);
  assert.equal(extractOpenSeaEstimatedRank(html, contract, '740'), null);
  assert.equal(extractOpenSeaEstimatedRank(html.replace('"rarity":{"rank":680,"category":"RARE"}', '"rarity":null'), contract, '739'), null);
});
