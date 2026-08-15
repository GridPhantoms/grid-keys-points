import assert from 'node:assert/strict';
import test from 'node:test';
import {
  avalancheSupplyMetric,
  marketMetrics,
  verifyAvalancheTokenIdentity,
} from '../lib/bytes-market.mjs';

const AS_OF = '2026-08-15T01:30:00.000Z';
const AVAX_TOKEN = '0x13af0Fe9eB35e91758B467f95cbc78e16FdD8B6b';
const AVAX_IMPLEMENTATION = '0x5430B6C1cbF4f05737A5E6F5623efA0759017874';

test('Avalanche identity requires chain token metadata, proxy implementation, and verified BurnMint pool linkage', () => {
  const input = {
    chainId: 43_114n,
    name: 'BYTES',
    symbol: 'BYTES',
    decimals: 18n,
    implementation: AVAX_IMPLEMENTATION,
    poolToken: AVAX_TOKEN,
    poolTypeAndVersion: 'BurnMintTokenPool 1.5.1',
    poolHasMinterRole: true,
    poolCanSelfBurn: true,
  };
  assert.equal(verifyAvalancheTokenIdentity(input, {
    token: AVAX_TOKEN,
    implementation: AVAX_IMPLEMENTATION,
  }), true);
  assert.equal(verifyAvalancheTokenIdentity({ ...input, implementation: AVAX_TOKEN }, {
    token: AVAX_TOKEN,
    implementation: AVAX_IMPLEMENTATION,
  }), false);
  assert.equal(verifyAvalancheTokenIdentity({ ...input, poolHasMinterRole: false }, {
    token: AVAX_TOKEN,
    implementation: AVAX_IMPLEMENTATION,
  }), false);
  assert.equal(verifyAvalancheTokenIdentity({ ...input, poolCanSelfBurn: false }, {
    token: AVAX_TOKEN,
    implementation: AVAX_IMPLEMENTATION,
  }), false);
});

test('Avalanche supply preserves exact value and observed provenance', () => {
  const metric = avalancheSupplyMetric({
    totalSupply: 255_598_914_220_296_195_495_542n,
    asOf: AS_OF,
  });
  assert.equal(metric.value, Number('255598.914220296195495542'));
  assert.equal(metric.rawValue, '255598.914220296195495542');
  assert.equal(metric.classification, 'observed');
  assert.match(metric.formula, /totalSupply/);
});

test('price and total-supply valuation use the DEXTools pair state and canonical Ethereum supply only', () => {
  const metrics = marketMetrics({
    ethereumTotalSupply: 5_215_262_041_121_429_365_412_430n,
    sqrtPriceX96: 899_826_975_519_911_673_468_905_219n,
    ethUsdAnswer: 187_931_000_000n,
    ethUsdDecimals: 8,
    feedUpdatedAt: 1_786_774_031,
    sourceTimestamp: 1_786_774_100,
    asOf: AS_OF,
  });
  assert.equal(metrics.bytesPriceUsd.classification, 'calculated');
  assert.equal(metrics.bytesPriceUsd.unit, 'USD/BYTES');
  assert.ok(Math.abs(metrics.bytesPriceUsd.value - 0.24241376362268513) < 1e-15);
  assert.equal(metrics.totalSupplyValuationUsd.unit, 'USD');
  assert.ok(Math.abs(metrics.totalSupplyValuationUsd.value - 1_264_251.2996667726) < 1e-8);
  assert.match(metrics.totalSupplyValuationUsd.formula, /canonical Ethereum totalSupply/);
  assert.throws(() => marketMetrics({
    ethereumTotalSupply: 1n,
    sqrtPriceX96: 1n,
    ethUsdAnswer: 1n,
    ethUsdDecimals: 8,
    feedUpdatedAt: 1_786_760_000,
    sourceTimestamp: 1_786_774_100,
    asOf: AS_OF,
  }), /stale/);
});


