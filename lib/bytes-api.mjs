import {
  assertFiniteNonNegative,
  assertMetricMetadata,
  assertNonEmptyString,
  metricEnvelope,
} from './bytes-model.mjs';


export const FRESHNESS_POLICY = Object.freeze({
  freshForSeconds: 900,
  pendingRewardsSeconds: 86_400,
  participantSnapshotSeconds: 604_800,
  staleWhileRevalidateSeconds: 3_600,
  staleIfErrorSeconds: 3_600,
});
export const PUBLIC_CACHE_CONTROL = 'public, s-maxage=900, stale-while-revalidate=3600, stale-if-error=3600';

export function withTimeout(promise, timeoutMs, label = 'Operation') {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number');
  }
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), deadline]).finally(() => clearTimeout(timer));
}

export function assertExpectedChainId(chainId, expectedChainId = 1) {
  if (!Number.isInteger(expectedChainId) || expectedChainId <= 0) {
    throw new TypeError('expectedChainId must be a positive integer');
  }
  if ((typeof chainId !== 'bigint' && typeof chainId !== 'number') || (typeof chainId === 'number' && !Number.isInteger(chainId))) {
    throw new TypeError('chainId must be an integer');
  }
  if (BigInt(chainId) !== BigInt(expectedChainId)) {
    throw new Error('Unexpected Ethereum chain');
  }
  return expectedChainId;
}

export function ethereumRpcUrl(env) {
  if (env.ETHEREUM_RPC_URL) return env.ETHEREUM_RPC_URL;
  return env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}` : null;
}

export function hasSuccessfulPoolEmissionRead(reads) {
  return reads.slice(0, 4).some((read) => read.status === 'fulfilled');
}

export function availableMetric(value, unit, classification, source, asOf, formula, assumptions) {
  assertNonEmptyString(unit, 'unit');
  return {
    ...metricEnvelope(value, classification, source, asOf, formula, assumptions),
    unit,
    availability: 'available',
  };
}

export function unavailableMetric(unit, classification, source, asOf, reason) {
  assertNonEmptyString(unit, 'unit');
  assertMetricMetadata(classification, source, asOf);
  assertNonEmptyString(reason, 'reason');
  return {
    value: null,
    unit,
    classification,
    source,
    asOf,
    availability: 'unavailable',
    reason,
  };
}


export function configuredEmissionsMetric(poolValues, asOf) {
  const names = ['S1', 'S2', 'BYTES', 'LP'];
  assertMetricMetadata('observed', 'staking-contract:getTotalEmissions', asOf);
  for (const name of names) {
    if (Object.hasOwn(poolValues, name)) assertFiniteNonNegative(poolValues[name], name);
  }
  const value = Object.fromEntries(names.map((name) => [name, poolValues[name] ?? null]));
  const missingPools = names.filter((name) => value[name] === null);
  value.total = missingPools.length === 0 ? names.reduce((sum, name) => sum + value[name], 0) : null;

  return {
    value,
    unit: 'BYTES/day',
    classification: 'observed',
    source: 'staking-contract:getTotalEmissions',
    asOf,
    availability: missingPools.length === 0 ? 'available' : missingPools.length === names.length ? 'unavailable' : 'partial',
    ...(missingPools.length === 0 ? {} : { unavailablePools: missingPools }),
    formula: 'Each pool getTotalEmissions(pool, blockTimestamp - 86400); total is the sum only when all pools are available.',
  };
}

export function signedMetric(value, unit, classification, source, asOf, formula) {
  if (!Number.isFinite(value)) throw new TypeError('value must be finite');
  assertNonEmptyString(unit, 'unit');
  assertMetricMetadata(classification, source, asOf, formula);
  return { value, unit, classification, source, asOf, availability: 'available', formula };
}

export function publicFailurePayload(asOf) {
  assertMetricMetadata('observed', 'failure-response', asOf);
  return {
    schemaVersion: 1,
    generatedAt: asOf,
    sourceBlock: null,
    status: 'unavailable',
    metrics: {},
    projections: {},
    provenance: { chain: 'unverified' },
    warnings: ['Primary contract reads are temporarily unavailable.'],
  };
}
