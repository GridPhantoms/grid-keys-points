import test from 'node:test';
import assert from 'node:assert/strict';

import {
  annualizedIssuance,
  emissionAtWeek,
  fractionThroughWeek,
  metricEnvelope,
  progressTowardLowerMilestone,
  remainingGeometricIssuance,
  theoreticalWeek,
} from '../lib/bytes-model.mjs';

const closeTo = (actual, expected, tolerance = 1e-12) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

test('emissionAtWeek reproduces the verified week 155 checkpoint', () => {
  closeTo(emissionAtWeek(5_875, 155), 744.229571294358);
  closeTo(emissionAtWeek(5_500, 155), 696.7255561053565);
  closeTo(emissionAtWeek(375, 155), 47.50401518900158);
});

test('emission curve halves every 52 weeks', () => {
  assert.equal(emissionAtWeek(11_000, 0), 11_000);
  assert.equal(emissionAtWeek(11_000, 52), 5_500);
  assert.equal(emissionAtWeek(11_000, 104), 2_750);
});

test('theoreticalWeek floors complete seven-day periods since epoch', () => {
  assert.equal(theoreticalWeek(1_000, 1_000), 0);
  assert.equal(theoreticalWeek(1_000, 1_000 + 7 * 86_400 - 1), 0);
  assert.equal(theoreticalWeek(1_000, 1_000 + 7 * 86_400), 1);
});

test('annualized issuance uses 365 days', () => {
  closeTo(annualizedIssuance(744.229571294358), 744.229571294358 * 365);
});

test('remaining issuance sums the weekly geometric series', () => {
  const daily = emissionAtWeek(5_875, 155);
  const expected = (daily * 7) / (1 - 2 ** (-1 / 52));
  closeTo(remainingGeometricIssuance(daily), expected, 1e-9);
  assert.ok(remainingGeometricIssuance(daily / 2) < remainingGeometricIssuance(daily));
});

test('remaining issuance prorates the current weekly period', () => {
  const daily = 1_000;
  const atBoundary = remainingGeometricIssuance(daily, 0);
  const midweek = remainingGeometricIssuance(daily, 0.5);
  const almostNextWeek = remainingGeometricIssuance(daily, 0.999);

  closeTo(atBoundary, (daily * 7) / (1 - 2 ** (-1 / 52)), 1e-9);
  assert.ok(atBoundary > midweek);
  assert.ok(midweek > almostNextWeek);
  closeTo(atBoundary - midweek, daily * 3.5, 1e-9);
  assert.throws(() => remainingGeometricIssuance(daily, -0.01), /fraction.*between 0 and 1/);
  assert.throws(() => remainingGeometricIssuance(daily, 1), /fraction.*between 0 and 1/);
  assert.throws(() => remainingGeometricIssuance(daily, Number.NaN), /fraction.*between 0 and 1/);
});

test('fractionThroughWeek derives exact boundary and midweek progress from the epoch', () => {
  const week = 7 * 86_400;
  assert.equal(fractionThroughWeek(1_000, 1_000), 0);
  assert.equal(fractionThroughWeek(1_000, 1_000 + week), 0);
  assert.equal(fractionThroughWeek(1_000, 1_000 + week / 2), 0.5);
});

test('milestone progress is measured from prior toward next lower level', () => {
  assert.equal(progressTowardLowerMilestone(5_500, 5_500, 2_750), 0);
  assert.equal(progressTowardLowerMilestone(4_125, 5_500, 2_750), 0.5);
  assert.equal(progressTowardLowerMilestone(2_750, 5_500, 2_750), 1);
});

test('metricEnvelope preserves provenance and optional methodology', () => {
  assert.deepEqual(
    metricEnvelope(744.2, 'observed', 'staking-contract', '2026-08-15T00:00:00.000Z', '24-hour contract window', ['latest block']),
    {
      value: 744.2,
      classification: 'observed',
      source: 'staking-contract',
      asOf: '2026-08-15T00:00:00.000Z',
      formula: '24-hour contract window',
      assumptions: ['latest block'],
    },
  );
});

test('invalid model inputs throw clear errors', () => {
  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => emissionAtWeek(value, 1), /reservoir must be a finite non-negative number/);
    assert.throws(() => annualizedIssuance(value), /daily must be a finite non-negative number/);
  }
  assert.throws(() => emissionAtWeek(1, -1), /week must be a finite non-negative number/);
  assert.throws(() => theoreticalWeek(2, 1), /atSeconds must be on or after epochSeconds/);
  assert.throws(() => progressTowardLowerMilestone(3, 2, 1), /currentDaily must be between/);
  assert.throws(() => progressTowardLowerMilestone(1, 1, 2), /priorMilestone must be greater than nextMilestone/);
  assert.throws(() => metricEnvelope(1, 'guessed', 'source', '2026-08-15T00:00:00.000Z'), /classification must be one of/);
  assert.throws(() => metricEnvelope(1, 'observed', 'source', '2026-08-15'), /canonical ISO-8601/);
  assert.throws(() => metricEnvelope(1, 'observed', 'source', '2026-08-15T00:00:00Z'), /canonical ISO-8601/);
  assert.throws(() => metricEnvelope(1, 'observed', 'source', '2026-02-30T00:00:00.000Z'), /canonical ISO-8601/);
});
