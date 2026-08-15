import test from 'node:test';
import assert from 'node:assert/strict';

import {
  availableMetric,
  assertExpectedChainId,
  configuredEmissionsMetric,
  ethereumRpcUrl,
  FRESHNESS_POLICY,
  hasSuccessfulPoolEmissionRead,

  PUBLIC_CACHE_CONTROL,
  publicFailurePayload,
  signedMetric,
  unavailableMetric,

  withTimeout,
} from '../lib/bytes-api.mjs';

const AS_OF = '2026-08-15T00:23:23.000Z';

test('configured emissions shape includes all pools and an exact total', () => {
  const metric = configuredEmissionsMetric({ S1: 696.7255561, S2: 47.50401519, BYTES: 0, LP: 0 }, AS_OF);
  assert.equal(metric.availability, 'available');
  assert.deepEqual(Object.keys(metric.value), ['S1', 'S2', 'BYTES', 'LP', 'total']);
  assert.equal(metric.value.total, 744.22957129);
  assert.equal(metric.classification, 'observed');
});

test('configured total is unavailable rather than inferred from partial pools', () => {
  const metric = configuredEmissionsMetric({ S1: 1, S2: 2 }, AS_OF);
  assert.equal(metric.availability, 'partial');
  assert.equal(metric.value.total, null);
  assert.deepEqual(metric.unavailablePools, ['BYTES', 'LP']);
});

test('available and unavailable metric records have stable metadata', () => {
  const available = availableMetric(10, 'BYTES', 'observed', 'verified-contract-read', AS_OF);
  const unavailable = unavailableMetric('BYTES', 'observed', 'canonical-source-not-established', AS_OF, 'Contract read unavailable.');
  assert.deepEqual(Object.keys(available), ['value', 'classification', 'source', 'asOf', 'unit', 'availability']);
  assert.equal(unavailable.value, null);
  assert.equal(unavailable.reason, 'Contract read unavailable.');
  assert.equal(signedMetric(-1, 'BYTES/day', 'calculated', 'configured-minus-modeled', AS_OF, 'configured - modeled').value, -1);
});

test('all exported metric constructors validate metadata and configured pool values', () => {
  assert.throws(() => unavailableMetric('BYTES', 'guessed', 'source', AS_OF, 'No source.'), /classification must be one of/);
  assert.throws(() => unavailableMetric('', 'observed', 'source', AS_OF, 'No source.'), /unit must be a non-empty string/);
  assert.throws(() => signedMetric(1, 'BYTES', 'calculated', '', AS_OF, 'formula'), /source must be a non-empty string/);
  assert.throws(() => configuredEmissionsMetric({ S1: -1 }, AS_OF), /S1 must be a finite non-negative number/);
  assert.throws(() => configuredEmissionsMetric({ S1: Number.NaN }, AS_OF), /S1 must be a finite non-negative number/);
  assert.throws(() => configuredEmissionsMetric({}, '2026-08-15'), /canonical ISO-8601/);
});

test('withTimeout resolves promptly and rejects a bounded operation deterministically', async () => {
  assert.equal(await withTimeout(Promise.resolve('ok'), 50), 'ok');
  await assert.rejects(withTimeout(new Promise(() => {}), 10), /timed out/);
  assert.throws(() => withTimeout(Promise.resolve(), 0), /positive finite/);
});

test('expected chain validation requires Ethereum mainnet', () => {
  assert.equal(assertExpectedChainId(1n), 1);
  assert.equal(assertExpectedChainId(1), 1);
  assert.throws(() => assertExpectedChainId(11155111n), /Unexpected Ethereum chain/);
  assert.throws(() => assertExpectedChainId('1'), /chainId must be an integer/);
});

test('freshness policy and cache control expose the CDN contract', () => {
  assert.deepEqual(FRESHNESS_POLICY, {
    freshForSeconds: 900,
    pendingRewardsSeconds: 86_400,
    participantSnapshotSeconds: 604_800,
    staleWhileRevalidateSeconds: 3600,
    staleIfErrorSeconds: 3600,
  });
  assert.equal(PUBLIC_CACHE_CONTROL, 'public, s-maxage=900, stale-while-revalidate=3600, stale-if-error=3600');
});


test('RPC config accepts only private environment variables', () => {
  assert.equal(ethereumRpcUrl({ ETHEREUM_RPC_URL: 'https://private.example/rpc' }), 'https://private.example/rpc');
  assert.equal(ethereumRpcUrl({ ALCHEMY_API_KEY: 'private-key' }), 'https://eth-mainnet.g.alchemy.com/v2/private-key');
  assert.equal(ethereumRpcUrl({ NEXT_PUBLIC_ALCHEMY_API_KEY: 'public-key' }), null);
});

test('primary-read success is determined only by the four pool emission reads', () => {
  const rejected = { status: 'rejected', reason: new Error('unavailable') };
  const fulfilled = { status: 'fulfilled', value: 1n };

  assert.equal(hasSuccessfulPoolEmissionRead([rejected, rejected, rejected, rejected]), false);
  assert.equal(hasSuccessfulPoolEmissionRead([rejected, rejected, rejected, rejected, fulfilled, fulfilled]), false);
  assert.equal(hasSuccessfulPoolEmissionRead([rejected, fulfilled, rejected, rejected]), true);
});

test('503 payload is versioned and contains only a private-safe label', () => {
  const payload = publicFailurePayload(AS_OF);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.status, 'unavailable');
  assert.equal(payload.sourceBlock, null);
  assert.equal(payload.provenance.chain, 'unverified');
  assert.doesNotMatch(JSON.stringify(payload), /ethereum/i);
  assert.doesNotMatch(JSON.stringify(payload), /alchemy|https?:|\/v2\/|error|stack/i);
});
