const CLASSIFICATIONS = new Set(['observed', 'calculated', 'projected', 'reference']);
const POOL_NAMES = ['S1', 'S2', 'BYTES', 'LP'];
const HISTORY_FIELDS = [...POOL_NAMES, 'total'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TOTAL_RELATIVE_TOLERANCE = 1e-9;
const DAY_MS = 86_400_000;

function fail(path, message) {
  throw new TypeError(`Invalid BYTES payload at ${path}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, path) {
  if (!isObject(value)) fail(path, 'must be an object');
  return value;
}

function requireNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'must be a non-empty string');
}

function requireStringArray(value, path) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) fail(path, 'must be an array of strings');
}

function requireCanonicalTimestamp(value, path) {
  requireNonEmptyString(value, path);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) fail(path, 'must be a canonical ISO-8601 timestamp');
}

function requireSourceBlock(value, path) {
  if (value !== null && (!Number.isInteger(value) || value <= 0)) fail(path, 'must be a positive integer or null');
}

function requirePositiveInteger(value, path) {
  if (!Number.isInteger(value) || value <= 0) fail(path, 'must be a positive integer');
}

function isStrictDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function requireFinite(value, path, nonnegative = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (nonnegative && value < 0)) {
    fail(path, `must be a finite${nonnegative ? ' nonnegative' : ''} number`);
  }
}

function totalsMatch(total, sum) {
  return Math.abs(total - sum) <= Math.max(1e-9, Math.abs(sum) * TOTAL_RELATIVE_TOLERANCE);
}

function validateMetricMetadata(metric, path) {
  requireNonEmptyString(metric.unit, `${path}.unit`);
  if (!CLASSIFICATIONS.has(metric.classification)) fail(`${path}.classification`, 'is not recognized');
  requireNonEmptyString(metric.source, `${path}.source`);
  requireCanonicalTimestamp(metric.asOf, `${path}.asOf`);
  if (metric.formula !== undefined) requireNonEmptyString(metric.formula, `${path}.formula`);
  if (metric.assumptions !== undefined) requireStringArray(metric.assumptions, `${path}.assumptions`);
  if (metric.reason !== undefined) requireNonEmptyString(metric.reason, `${path}.reason`);
  if (metric.unavailablePools !== undefined) requireStringArray(metric.unavailablePools, `${path}.unavailablePools`);
  if (metric.rawValue !== undefined) {
    if (typeof metric.rawValue !== 'string' || !/^\d+(?:\.\d+)?$/.test(metric.rawValue)) fail(`${path}.rawValue`, 'must be a nonnegative decimal string');
    if (metric.availability !== 'available' || typeof metric.value !== 'number' || Number(metric.rawValue) !== metric.value) fail(`${path}.rawValue`, 'must numerically match the available value');
  }
  const hasDaoTax = metric.daoTaxExcluded !== undefined;
  const hasRawDaoTax = metric.daoTaxExcludedRawValue !== undefined;
  if (hasDaoTax !== hasRawDaoTax) fail(path, 'must pair daoTaxExcluded with daoTaxExcludedRawValue');
  if (hasDaoTax) {
    if (!path.endsWith('.pendingUnclaimedRewards')) fail(path, 'DAO-tax metadata is allowed only on pendingUnclaimedRewards');
    requireFinite(metric.daoTaxExcluded, `${path}.daoTaxExcluded`, true);
    if (typeof metric.daoTaxExcludedRawValue !== 'string' || !/^\d+(?:\.\d+)?$/.test(metric.daoTaxExcludedRawValue)) fail(`${path}.daoTaxExcludedRawValue`, 'must be a nonnegative decimal string');
    if (Number(metric.daoTaxExcludedRawValue) !== metric.daoTaxExcluded) fail(`${path}.daoTaxExcludedRawValue`, 'must numerically match daoTaxExcluded');
  }
}

function validateScalarMetric(value, path, { nonnegative = false } = {}) {
  const metric = requireObject(value, path);
  validateMetricMetadata(metric, path);
  if (metric.availability === 'available') {
    requireFinite(metric.value, `${path}.value`, nonnegative);
  } else if (metric.availability === 'unavailable') {
    if (metric.value !== null) fail(`${path}.value`, 'must be null when unavailable');
    requireNonEmptyString(metric.reason, `${path}.reason`);
  } else {
    fail(`${path}.availability`, 'must be available or unavailable for a numeric metric');
  }
}

function validatePoolMetric(value, path) {
  const metric = requireObject(value, path);
  validateMetricMetadata(metric, path);
  const pools = requireObject(metric.value, `${path}.value`);

  if (metric.availability === 'available') {
    for (const name of HISTORY_FIELDS) requireFinite(pools[name], `${path}.value.${name}`, true);
    const sum = POOL_NAMES.reduce((total, name) => total + pools[name], 0);
    if (!totalsMatch(pools.total, sum)) fail(`${path}.value.total`, 'must equal the sum of all pools');
    return;
  }

  if (metric.availability !== 'partial') fail(`${path}.availability`, 'must be available or partial for a configured pool metric');
  const missing = [];
  for (const name of POOL_NAMES) {
    if (pools[name] === null) missing.push(name);
    else requireFinite(pools[name], `${path}.value.${name}`, true);
  }
  if (missing.length === 0 || pools.total !== null) fail(path, 'partial configured pools require missing pool values and a null total');
  if (!Array.isArray(metric.unavailablePools) || metric.unavailablePools.length !== missing.length || missing.some((name, index) => metric.unavailablePools[index] !== name)) {
    fail(`${path}.unavailablePools`, 'must identify each unavailable pool in canonical order');
  }
}

/**
 * Deterministically retains bucket minima/maxima and the endpoints of each
 * bucket's largest step. The latter preserves abrupt reward-window changes.
 * @template T
 * @param {T[]} rows
 * @param {number} limit
 * @param {(row: T) => number} valueOf
 * @returns {T[]}
 */
export function sampleMinMax(rows, limit, valueOf) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  if (!Number.isInteger(limit) || limit < 2) throw new TypeError('limit must be an integer of at least 2');
  if (typeof valueOf !== 'function') throw new TypeError('valueOf must be a function');
  if (rows.length <= limit) return [...rows];

  if (limit === 2) return [rows[0], rows.at(-1)];

  if (limit < 6) {
    const selected = new Set([0, rows.length - 1]);
    const steps = rows.slice(1).map((row, offset) => ({
      index: offset + 1,
      magnitude: Math.abs(valueOf(row) - valueOf(rows[offset])),
    })).sort((left, right) => right.magnitude - left.magnitude || left.index - right.index);
    for (const step of steps) {
      for (const index of [step.index - 1, step.index]) {
        if (selected.size >= limit) break;
        if (index > 0 && index < rows.length - 1) selected.add(index);
      }
      if (selected.size >= limit) break;
    }
    return [...selected].sort((left, right) => left - right).map((index) => rows[index]);
  }

  const interiorCount = rows.length - 2;
  const bucketCount = Math.max(1, Math.floor((limit - 2) / 4));
  const selected = new Set([0, rows.length - 1]);

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = 1 + Math.floor((bucket * interiorCount) / bucketCount);
    const end = 1 + Math.floor(((bucket + 1) * interiorCount) / bucketCount);
    let minimumIndex = start;
    let maximumIndex = start;
    let largestStepIndex = start;
    let largestStep = -1;

    for (let index = start; index < end; index += 1) {
      const value = valueOf(rows[index]);
      if (!Number.isFinite(value)) throw new TypeError('sample values must be finite numbers');
      if (value < valueOf(rows[minimumIndex])) minimumIndex = index;
      if (value > valueOf(rows[maximumIndex])) maximumIndex = index;
      const priorIndex = Math.max(0, index - 1);
      const step = Math.abs(value - valueOf(rows[priorIndex]));
      if (step > largestStep) {
        largestStep = step;
        largestStepIndex = index;
      }
    }

    selected.add(minimumIndex);
    selected.add(maximumIndex);
    selected.add(Math.max(0, largestStepIndex - 1));
    selected.add(largestStepIndex);
  }

  const fillCount = limit - selected.size;
  for (let slot = 1; slot <= fillCount; slot += 1) {
    selected.add(Math.round((slot * (rows.length - 1)) / (fillCount + 1)));
  }
  for (let index = 1; selected.size < limit && index < rows.length - 1; index += 1) selected.add(index);

  return [...selected].sort((left, right) => left - right).slice(0, limit).map((index) => rows[index]);
}

export function validateBytesMetricsResponse(value) {
  const payload = requireObject(value, 'metrics');
  if (payload.schemaVersion !== 1) fail('metrics.schemaVersion', 'must equal 1');
  requireCanonicalTimestamp(payload.generatedAt, 'metrics.generatedAt');
  requirePositiveInteger(payload.sourceBlock, 'metrics.sourceBlock');
  if (payload.status !== 'fresh' && payload.status !== 'partial') fail('metrics.status', 'must be fresh or partial');
  const provenance = requireObject(payload.provenance, 'metrics.provenance');
  requireNonEmptyString(provenance.chain, 'metrics.provenance.chain');
  if (provenance.chainId !== 1) fail('metrics.provenance.chainId', 'must equal Ethereum mainnet chain ID 1');
  if (typeof provenance.sourceBlockHash !== 'string' || !/^0x[0-9a-f]{64}$/.test(provenance.sourceBlockHash)) fail('metrics.provenance.sourceBlockHash', 'must be a canonical block hash');
  if (typeof provenance.tokenIdentityVerified !== 'boolean') fail('metrics.provenance.tokenIdentityVerified', 'must be boolean');
  requireNonEmptyString(provenance.tokenIdentityVerification, 'metrics.provenance.tokenIdentityVerification');
  requirePositiveInteger(provenance.participantSnapshotBlock, 'metrics.provenance.participantSnapshotBlock');
  requirePositiveInteger(provenance.participantSnapshotCount, 'metrics.provenance.participantSnapshotCount');
  if (typeof provenance.participantSnapshotBlockHash !== 'string' || !/^0x[0-9a-f]{64}$/.test(provenance.participantSnapshotBlockHash)) fail('metrics.provenance.participantSnapshotBlockHash', 'must be a canonical block hash');
  if (typeof provenance.participantSnapshotDigest !== 'string' || !/^[0-9a-f]{64}$/.test(provenance.participantSnapshotDigest)) fail('metrics.provenance.participantSnapshotDigest', 'must be a SHA-256 digest');
  const snapshotEvidence = requireObject(provenance.participantSnapshotEvidence, 'metrics.provenance.participantSnapshotEvidence');
  requireNonEmptyString(snapshotEvidence.collectorVersion, 'metrics.provenance.participantSnapshotEvidence.collectorVersion');
  for (const name of ['stakeEventCount', 'claimEventCount', 'uniqueStakeParticipants', 'uniqueClaimRecipients', 'logQueryCalls', 'logQueryRetries']) {
    if (!Number.isInteger(snapshotEvidence[name]) || snapshotEvidence[name] < 0) fail(`metrics.provenance.participantSnapshotEvidence.${name}`, 'must be a nonnegative integer');
  }
  const pendingWorkLimits = requireObject(provenance.pendingWorkLimits, 'metrics.provenance.pendingWorkLimits');
  for (const name of ['maxDeltaBlocks', 'maxDeltaLogEvents', 'maxParticipants', 'maxChunks']) {
    requirePositiveInteger(pendingWorkLimits[name], `metrics.provenance.pendingWorkLimits.${name}`);
  }
  requireStringArray(payload.warnings, 'metrics.warnings');

  const policy = requireObject(payload.freshnessPolicy, 'metrics.freshnessPolicy');
  for (const name of ['freshForSeconds', 'staleWhileRevalidateSeconds', 'staleIfErrorSeconds']) {
    requirePositiveInteger(policy[name], `metrics.freshnessPolicy.${name}`);
  }

  const metrics = requireObject(payload.metrics, 'metrics.metrics');
  validatePoolMetric(metrics.currentConfiguredEmissions, 'metrics.metrics.currentConfiguredEmissions');
  validatePoolMetric(metrics.currentModeledRate, 'metrics.metrics.currentModeledRate');
  validateScalarMetric(metrics.annualizedConfiguredIssuance, 'metrics.metrics.annualizedConfiguredIssuance', { nonnegative: true });
  validateScalarMetric(metrics.configuredVsTheoretical, 'metrics.metrics.configuredVsTheoretical');
  validateScalarMetric(metrics.theoreticalWeek, 'metrics.metrics.theoreticalWeek', { nonnegative: true });
  validateScalarMetric(metrics.ethBytes2Supply, 'metrics.metrics.ethBytes2Supply', { nonnegative: true });
  validateScalarMetric(metrics.bytesHeldByStakingContract, 'metrics.metrics.bytesHeldByStakingContract', { nonnegative: true });
  validateScalarMetric(metrics.pendingUnclaimedRewards, 'metrics.metrics.pendingUnclaimedRewards', { nonnegative: true });
  const canonicalMetricsAvailable = metrics.ethBytes2Supply.availability === 'available'
    && metrics.bytesHeldByStakingContract.availability === 'available';
  if (provenance.tokenIdentityVerified !== canonicalMetricsAvailable) fail('metrics.provenance.tokenIdentityVerified', 'must match token-dependent metric availability');
  if (!provenance.tokenIdentityVerified && metrics.pendingUnclaimedRewards.availability !== 'unavailable') fail('metrics.metrics.pendingUnclaimedRewards', 'must be unavailable when canonical token identity is unverified');

  const projections = requireObject(payload.projections, 'metrics.projections');
  validateScalarMetric(projections.steadyParticipationRemainingIssuance, 'metrics.projections.steadyParticipationRemainingIssuance', { nonnegative: true });
  validateScalarMetric(projections.maximumParticipationRemainingIssuance, 'metrics.projections.maximumParticipationRemainingIssuance', { nonnegative: true });
  return payload;
}

export function validateEmissionsHistory(value) {
  const payload = requireObject(value, 'history');
  if (payload.schemaVersion !== 1) fail('history.schemaVersion', 'must equal 1');
  requireCanonicalTimestamp(payload.generatedAt, 'history.generatedAt');
  requireSourceBlock(payload.sourceBlock, 'history.sourceBlock');
  const methodology = requireObject(payload.methodology, 'history.methodology');
  if (methodology.classification !== undefined && !CLASSIFICATIONS.has(methodology.classification)) fail('history.methodology.classification', 'is not recognized');
  requireNonEmptyString(methodology.source, 'history.methodology.source');
  if (methodology.normalization !== undefined) requireNonEmptyString(methodology.normalization, 'history.methodology.normalization');
  if (payload.start !== undefined && !isStrictDate(payload.start)) fail('history.start', 'must be a valid YYYY-MM-DD date');
  if (payload.end !== undefined && !isStrictDate(payload.end)) fail('history.end', 'must be a valid YYYY-MM-DD date');
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) fail('history.rows', 'must be a nonempty array');

  let previousDate = '';
  let previousDateMs = null;
  payload.rows.forEach((rowValue, index) => {
    const path = `history.rows[${index}]`;
    const row = requireObject(rowValue, path);
    if (!isStrictDate(row.date)) fail(`${path}.date`, 'must be a valid YYYY-MM-DD date');
    const rowDateMs = Date.parse(`${row.date}T00:00:00.000Z`);
    if (previousDate && row.date <= previousDate) fail(`${path}.date`, 'must be strictly chronological');
    if (previousDateMs !== null && rowDateMs - previousDateMs !== DAY_MS) fail(`${path}.date`, 'must continue the daily series without gaps');
    previousDate = row.date;
    previousDateMs = rowDateMs;
    for (const name of HISTORY_FIELDS) requireFinite(row[name], `${path}.${name}`, true);
    const sum = POOL_NAMES.reduce((total, name) => total + row[name], 0);
    if (!totalsMatch(row.total, sum)) fail(`${path}.total`, 'must equal the sum of all pools');
  });

  if (payload.start !== undefined && payload.start !== payload.rows[0].date) fail('history.start', 'must match the first row date');
  if (payload.end !== undefined && payload.end !== payload.rows.at(-1).date) fail('history.end', 'must match the last row date');
  return payload;
}
