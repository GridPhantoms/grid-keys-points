import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  sampleMinMax,
  validateBytesMetricsResponse,
  validateEmissionsHistory,
} from '../lib/bytes-client-data.mjs';

const AS_OF = '2026-08-15T00:23:23.000Z';
const classifications = {
  configured: 'observed',
  modeled: 'calculated',
};

function scalarMetric(value = 1, overrides = {}) {
  return {
    value,
    unit: 'BYTES',
    classification: 'calculated',
    source: 'test-source',
    asOf: AS_OF,
    availability: 'available',
    ...overrides,
  };
}

function poolMetric(overrides = {}) {
  return {
    value: { S1: 5_500, S2: 375, BYTES: 0, LP: 0, total: 5_875 },
    unit: 'BYTES/day',
    classification: classifications.configured,
    source: 'staking-contract:getTotalEmissions',
    asOf: AS_OF,
    availability: 'available',
    ...overrides,
  };
}

function validMetricsPayload() {
  return {
    schemaVersion: 1,
    generatedAt: AS_OF,
    sourceBlock: 25_756_837,
    status: 'partial',
    freshnessPolicy: {
      freshForSeconds: 900,
      staleWhileRevalidateSeconds: 3_600,
      staleIfErrorSeconds: 3_600,
    },
    metrics: {
      currentConfiguredEmissions: poolMetric(),
      currentModeledRate: poolMetric({ classification: classifications.modeled }),
      projectedNext365DayIssuance: scalarMetric(1_550_000, { classification: 'projected' }),
      configuredVsTheoretical: scalarMetric(-1, { unit: 'BYTES/day' }),
      theoreticalWeek: scalarMetric(165, { unit: 'week' }),
      ethBytes2Supply: scalarMetric(null, {
        classification: 'observed',
        availability: 'unavailable',
        reason: 'Canonical source unavailable.',
      }),
      avalancheBytesSupply: scalarMetric(null, {
        classification: 'observed',
        availability: 'unavailable',
        reason: 'Canonical Avalanche source unavailable.',
      }),
      bytesHeldByStakingContract: scalarMetric(null, {
        classification: 'observed',
        availability: 'unavailable',
        reason: 'Canonical source unavailable.',
      }),
      pendingUnclaimedRewards: scalarMetric(null, {
        classification: 'calculated',
        source: 'staking-contract:getPendingPoolReward-indexed-aggregate',
        availability: 'unavailable',
        reason: 'Aggregate claimable methodology unavailable.',
      }),
      bytesPriceUsd: scalarMetric(null, { unit: 'USD/BYTES', availability: 'unavailable', reason: 'Pair price unavailable.' }),
      totalSupplyValuationUsd: scalarMetric(null, { unit: 'USD', availability: 'unavailable', reason: 'Pair price unavailable.' }),
      circulatingMarketCapUsd: scalarMetric(null, { unit: 'USD', availability: 'unavailable', reason: 'Circulating supply unavailable.' }),
    },
    projections: {
      steadyParticipationRemainingIssuance: scalarMetric(1_000_000, { classification: 'projected' }),
      maximumParticipationRemainingIssuance: scalarMetric(2_000_000, { classification: 'projected' }),
    },
    provenance: {
      chain: 'ethereum-mainnet',
      chainId: 1,
      sourceBlockHash: `0x${'ab'.repeat(32)}`,
      tokenIdentityVerified: false,
      tokenIdentityVerification: 'Unavailable at source block; token-dependent metrics are source-gated',
      avalanche: {
        chain: 'avalanche-c-chain',
        chainId: 43_114,
        sourceBlock: null,
        sourceBlockHash: null,
        asOf: null,
        bytesTokenContract: '0x13af0Fe9eB35e91758B467f95cbc78e16FdD8B6b',
        proxyImplementation: '0x5430B6C1cbF4f05737A5E6F5623efA0759017874',
        ccipBurnMintPool: '0xAb2e4F219E1A24bA061E0Ecf07c0e3Dc7d410A9A',
        tokenIdentityVerified: false,
        tokenIdentityVerification: 'Unavailable; Avalanche token-dependent metrics are source-gated',
      },
      crossChainSupplyTreatment: 'Ethereum canonical supply is counted once; remote BurnMint supplies are not added.',
      priceSource: {
        verified: false,
        verification: 'Unavailable at the Ethereum source block; price and valuation metrics are source-gated',
        dextoolsPairUrl: 'https://www.dextools.io/app/en/ether/pair-explorer/0xfeb09c7e130a4b87b27ebd648ec485657b688b34',
        uniswapV3Pool: '0xFEb09c7e130a4B87B27EBD648EC485657B688b34',
        uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        feeTier: 10_000,
        quoteToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        ethUsdFeed: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
        quoteCurrency: 'USD',
        method: 'Same-block pool ratio times ETH/USD.',
      },

      participantSnapshotBlock: 25_758_127,
      participantSnapshotCount: 3_318,
      participantSnapshotBlockHash: `0x${'cd'.repeat(32)}`,
      participantSnapshotDigest: 'ef'.repeat(32),
      participantSnapshotEvidence: {
        collectorVersion: '1.0.0',
        stakeEventCount: 13_433,
        claimEventCount: 32_888,
        uniqueStakeParticipants: 3_310,
        uniqueClaimRecipients: 3_318,
        logQueryCalls: 166,
        logQueryRetries: 0,
      },
      pendingWorkLimits: { maxDeltaBlocks: 250_000, maxDeltaLogEvents: 10_000, maxParticipants: 5_000, maxChunks: 32 },
    },
    warnings: ['Supply source is not verified.'],
  };
}

function validHistory() {
  return {
    schemaVersion: 1,
    generatedAt: AS_OF,
    sourceBlock: 25_756_837,
    methodology: {
      classification: 'calculated',
      source: 'Historical staking-contract reconstruction',
      normalization: 'Normalized to daily values.',
    },
    rows: [
      { date: '2023-06-22', S1: 10_000, S2: 1_000, BYTES: 0, LP: 0, total: 11_000 },
      { date: '2023-06-23', S1: 6_303.000400437509, S2: 429.0937749593868, BYTES: 0, LP: 0, total: 6_732.0941753968955 },
    ],
  };
}

test('shape-preserving sampling retains endpoints, extrema, and abrupt transition dates without mutation', () => {
  const rows = Array.from({ length: 240 }, (_, index) => ({
    date: new Date(Date.UTC(2023, 5, index + 1)).toISOString().slice(0, 10),
    total: index < 22 ? 11_000 : index === 22 ? 6_732.0941753968955 : 6_290.586676300009,
  }));
  const snapshot = structuredClone(rows);
  const sampled = sampleMinMax(rows, 180, (row) => row.total);

  assert.ok(sampled.length <= 180);
  assert.equal(sampled[0], rows[0]);
  assert.equal(sampled.at(-1), rows.at(-1));
  assert.ok(sampled.some((row) => row.date === '2023-06-23' && row.total === 6_732.0941753968955));
  assert.ok(sampled.some((row) => row.date === '2023-06-22' && row.total === 11_000));
  assert.deepEqual(rows, snapshot);
  assert.notEqual(sampled, rows);
});

test('sampling with a limit of 2 returns exactly the ordered endpoints without mutation', () => {
  const totals = [0, 1, 2, 100, 101, 102, 103, 104];
  const rows = totals.map((total, index) => ({ index, total }));
  const snapshot = structuredClone(rows);
  const sampled = sampleMinMax(rows, 2, (row) => row.total);

  assert.deepEqual(sampled, [rows[0], rows.at(-1)]);
  assert.deepEqual(rows, snapshot);
  assert.notEqual(sampled, rows);
});

test('sampling respects accepted low limits while retaining order and endpoints without mutation', () => {
  const totals = [0, 1, 2, 100, 3, 99, 4, 98, 5, 97, 6, 96];
  const rows = totals.map((total, index) => ({ index, total }));
  const snapshot = structuredClone(rows);

  for (const limit of [2, 3, 4, 5, 6, 7, 8]) {
    const sampled = sampleMinMax(rows, limit, (row) => row.total);
    const sampledIndexes = sampled.map((row) => row.index);

    assert.ok(sampled.length <= limit, `limit ${limit} returned ${sampled.length} rows`);
    assert.equal(sampled[0], rows[0]);
    assert.equal(sampled.at(-1), rows.at(-1));
    assert.deepEqual(sampledIndexes, [...sampledIndexes].sort((left, right) => left - right));
  }

  assert.deepEqual(rows, snapshot);
});

test('sampling retains the existing minimum limit validation', () => {
  assert.throws(
    () => sampleMinMax([{ total: 1 }], 1, (row) => row.total),
    /limit must be an integer of at least 2/,
  );
});

test('sampling the production history retains the June 23, 2023 reward-window drop', async () => {
  const historyUrl = new URL('../public/data/bytes-emissions-history.json', import.meta.url);
  const history = JSON.parse(await readFile(historyUrl, 'utf8'));
  validateEmissionsHistory(history);
  const sampled = sampleMinMax(history.rows, 180, (row) => row.total);
  const transition = sampled.find((row) => row.date === '2023-06-23');

  assert.ok(sampled.length <= 180);
  assert.equal(transition?.total, 6_732.0941753968955);
  assert.ok(sampled.some((row) => row.date === '2023-06-22' && row.total === 11_000));
});

test('chart source keeps all theoretical Genesis half-level references and accessible copy', async () => {
  const chartUrl = new URL('../app/bytes/EmissionsChart.tsx', import.meta.url);
  const cssUrl = new URL('../app/bytes/bytes.css', import.meta.url);
  const [chartSource, cssSource] = await Promise.all([
    readFile(chartUrl, 'utf8'),
    readFile(cssUrl, 'utf8'),
  ]);

  for (const milestone of ['5_500', '2_750', '1_375', '687.5']) {
    assert.match(chartSource, new RegExp(milestone.replace('.', '\\.')));
  }
  assert.match(chartSource, /theoretical Genesis half-level milestones/i);
  assert.match(chartSource, /bytes-chart-milestone/);
  assert.match(cssSource, /\.bytes-chart-milestone line[^}]*stroke-dasharray/);
});

test('validators accept complete metrics and nonempty history payloads', () => {
  const metrics = validMetricsPayload();
  const history = validHistory();
  assert.equal(validateBytesMetricsResponse(metrics), metrics);
  assert.equal(validateEmissionsHistory(history), history);
});

test('metrics validator rejects failure-shaped success metadata', () => {
  const nullBlock = validMetricsPayload();
  nullBlock.sourceBlock = null;
  assert.throws(() => validateBytesMetricsResponse(nullBlock), /sourceBlock/);

  const missingFreshness = validMetricsPayload();
  delete missingFreshness.freshnessPolicy;
  assert.throws(() => validateBytesMetricsResponse(missingFreshness), /freshnessPolicy/);

  const incompleteFreshness = validMetricsPayload();
  delete incompleteFreshness.freshnessPolicy.staleIfErrorSeconds;
  assert.throws(() => validateBytesMetricsResponse(incompleteFreshness), /staleIfErrorSeconds/);

  const unavailableStatus = validMetricsPayload();
  unavailableStatus.status = 'unavailable';
  assert.throws(() => validateBytesMetricsResponse(unavailableStatus), /status/);

  const contradictoryIdentity = validMetricsPayload();
  contradictoryIdentity.provenance.tokenIdentityVerified = true;
  assert.throws(() => validateBytesMetricsResponse(contradictoryIdentity), /tokenIdentityVerified/);

  const missingWorkLimit = validMetricsPayload();
  delete missingWorkLimit.provenance.pendingWorkLimits.maxDeltaLogEvents;
  assert.throws(() => validateBytesMetricsResponse(missingWorkLimit), /maxDeltaLogEvents/);
});

test('metrics validator accepts the pending/unclaimed secondary-failure source gate', () => {
  const metrics = validMetricsPayload();
  const validated = validateBytesMetricsResponse(metrics);

  assert.equal(validated.metrics.pendingUnclaimedRewards.value, null);
  assert.equal(validated.metrics.pendingUnclaimedRewards.availability, 'unavailable');
  assert.equal(validated.metrics.pendingUnclaimedRewards.classification, 'calculated');
});

test('metrics validator enforces Avalanche identity, valuation dependency, and unavailable circulating market cap', () => {
  const contradictoryAvalanche = validMetricsPayload();
  contradictoryAvalanche.provenance.avalanche.tokenIdentityVerified = true;
  assert.throws(() => validateBytesMetricsResponse(contradictoryAvalanche), /avalanche.*tokenIdentityVerified/i);

  const orphanValuation = validMetricsPayload();
  orphanValuation.metrics.totalSupplyValuationUsd = scalarMetric(1_200_000, { unit: 'USD', rawValue: '1200000' });
  assert.throws(() => validateBytesMetricsResponse(orphanValuation), /totalSupplyValuationUsd/);

  const fakeMarketCap = validMetricsPayload();
  fakeMarketCap.metrics.circulatingMarketCapUsd = scalarMetric(1_000_000, { unit: 'USD' });
  assert.throws(() => validateBytesMetricsResponse(fakeMarketCap), /circulatingMarketCapUsd/);

  const falseSuccessfulPriceProvenance = validMetricsPayload();
  falseSuccessfulPriceProvenance.provenance.priceSource.verified = true;
  assert.throws(() => validateBytesMetricsResponse(falseSuccessfulPriceProvenance), /priceSource\.verified/);

});

test('metrics validator enforces exact-value coherence, pairing, and metric placement', () => {
  const metrics = validMetricsPayload();
  metrics.metrics.ethBytes2Supply = scalarMetric(Number('5215262.04112142936541243'), {
    classification: 'observed',
    rawValue: '5215262.04112142936541243',
  });
  metrics.metrics.bytesHeldByStakingContract = scalarMetric(1_853_137, {
    classification: 'observed',
    rawValue: '1853137.0',
  });
  metrics.metrics.pendingUnclaimedRewards = scalarMetric(Number('870970.189837981616925528'), {
    rawValue: '870970.189837981616925528',
    daoTaxExcluded: Number('26937.222366123142790828'),
    daoTaxExcludedRawValue: '26937.222366123142790828',
  });
  metrics.provenance.tokenIdentityVerified = true;
  metrics.provenance.tokenIdentityVerification = 'Verified at source block';
  metrics.metrics.bytesPriceUsd = scalarMetric(0.2425, { unit: 'USD/BYTES', rawValue: '0.2425' });
  metrics.metrics.totalSupplyValuationUsd = scalarMetric(1_264_678, { unit: 'USD', rawValue: '1264678' });
  metrics.provenance.priceSource.verified = true;
  metrics.provenance.priceSource.verification = 'Verified at the Ethereum source block';
  assert.equal(validateBytesMetricsResponse(metrics), metrics);

  const malformed = structuredClone(metrics);
  malformed.metrics.pendingUnclaimedRewards.rawValue = 'not-a-decimal';
  assert.throws(() => validateBytesMetricsResponse(malformed), /rawValue/);

  const contradictory = structuredClone(metrics);
  contradictory.metrics.ethBytes2Supply.value = 1;
  assert.throws(() => validateBytesMetricsResponse(contradictory), /numerically match/);

  const unpaired = structuredClone(metrics);
  delete unpaired.metrics.pendingUnclaimedRewards.daoTaxExcludedRawValue;
  assert.throws(() => validateBytesMetricsResponse(unpaired), /pair/);

  const misplaced = structuredClone(metrics);
  misplaced.metrics.ethBytes2Supply.daoTaxExcluded = 1;
  misplaced.metrics.ethBytes2Supply.daoTaxExcludedRawValue = '1.0';
  assert.throws(() => validateBytesMetricsResponse(misplaced), /allowed only/);
});

test('metrics validator rejects missing or malformed pending/unclaimed source gates', () => {
  const missing = validMetricsPayload();
  delete missing.metrics.pendingUnclaimedRewards;
  assert.throws(() => validateBytesMetricsResponse(missing), /pendingUnclaimedRewards/);

  const availableNull = validMetricsPayload();
  availableNull.metrics.pendingUnclaimedRewards = scalarMetric(null);
  assert.throws(() => validateBytesMetricsResponse(availableNull), /pendingUnclaimedRewards/);

  const malformedValue = validMetricsPayload();
  malformedValue.metrics.pendingUnclaimedRewards = scalarMetric('not-null');
  assert.throws(() => validateBytesMetricsResponse(malformedValue), /pendingUnclaimedRewards/);

  const malformedReason = validMetricsPayload();
  malformedReason.metrics.pendingUnclaimedRewards.reason = 42;
  assert.throws(() => validateBytesMetricsResponse(malformedReason), /pendingUnclaimedRewards.*reason/);

  const unavailableNonNull = validMetricsPayload();
  unavailableNonNull.metrics.pendingUnclaimedRewards.value = 1;
  assert.throws(() => validateBytesMetricsResponse(unavailableNonNull), /pendingUnclaimedRewards.*value/);
});

test('metrics validator rejects available null and malformed numbers', () => {
  const availableNull = validMetricsPayload();
  availableNull.metrics.projectedNext365DayIssuance.value = null;
  assert.throws(() => validateBytesMetricsResponse(availableNull), /projectedNext365DayIssuance/);

  const infinite = validMetricsPayload();
  infinite.projections.maximumParticipationRemainingIssuance.value = Number.POSITIVE_INFINITY;
  assert.throws(() => validateBytesMetricsResponse(infinite), /maximumParticipationRemainingIssuance/);
});

test('metrics validator accepts a consistent partial configured metric and rejects an inferred partial total', () => {
  const partial = validMetricsPayload();
  partial.metrics.currentConfiguredEmissions = poolMetric({
    value: { S1: 5_500, S2: 375, BYTES: null, LP: null, total: null },
    availability: 'partial',
    unavailablePools: ['BYTES', 'LP'],
  });
  assert.equal(validateBytesMetricsResponse(partial), partial);

  const inferredTotal = structuredClone(partial);
  inferredTotal.metrics.currentConfiguredEmissions.value.total = 5_875;
  assert.throws(() => validateBytesMetricsResponse(inferredTotal), /currentConfiguredEmissions/);
});

test('history validator rejects empty rows, impossible dates, non-finite values, and incorrect totals', () => {
  const empty = validHistory();
  empty.rows = [];
  assert.throws(() => validateEmissionsHistory(empty), /rows/);

  const badDate = validHistory();
  badDate.rows[0].date = '2023-02-29';
  assert.throws(() => validateEmissionsHistory(badDate), /date/);

  const badNumber = validHistory();
  badNumber.rows[0].S1 = Number.NaN;
  assert.throws(() => validateEmissionsHistory(badNumber), /S1/);

  const badTotal = validHistory();
  badTotal.rows[0].total = 10_999;
  assert.throws(() => validateEmissionsHistory(badTotal), /total/);

  const dailyGap = validHistory();
  dailyGap.rows[1].date = '2023-06-24';
  assert.throws(() => validateEmissionsHistory(dailyGap), /daily series without gaps/);
});
