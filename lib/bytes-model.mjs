export const DECAY_WEEKS_PER_HALF = 52;
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_YEAR = 365;
export const GENESIS_MAX_DAILY_EMISSIONS = 11_000;

const CLASSIFICATIONS = new Set(['observed', 'calculated', 'projected', 'reference']);
const CANONICAL_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function assertFiniteNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a finite non-negative number`);
  }
}

export function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

export function assertCanonicalIsoTimestamp(value, name = 'timestamp') {
  if (typeof value !== 'string' || !CANONICAL_ISO_TIMESTAMP.test(value)) {
    throw new TypeError(`${name} must be a canonical ISO-8601 timestamp`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(`${name} must be a canonical ISO-8601 timestamp`);
  }
}

export function assertMetricMetadata(classification, source, asOf, formula, assumptions) {
  if (!CLASSIFICATIONS.has(classification)) {
    throw new TypeError(`classification must be one of: ${[...CLASSIFICATIONS].join(', ')}`);
  }
  assertNonEmptyString(source, 'source');
  assertCanonicalIsoTimestamp(asOf, 'asOf');
  if (formula !== undefined) assertNonEmptyString(formula, 'formula');
  if (assumptions !== undefined && (!Array.isArray(assumptions) || assumptions.some((item) => typeof item !== 'string' || item.trim() === ''))) {
    throw new TypeError('assumptions must be an array of non-empty strings');
  }
}

export function emissionAtWeek(reservoir, week) {
  assertFiniteNonNegative(reservoir, 'reservoir');
  assertFiniteNonNegative(week, 'week');
  return reservoir * 2 ** (-week / DECAY_WEEKS_PER_HALF);
}

export function theoreticalWeek(epochSeconds, atSeconds) {
  assertFiniteNonNegative(epochSeconds, 'epochSeconds');
  assertFiniteNonNegative(atSeconds, 'atSeconds');
  if (atSeconds < epochSeconds) {
    throw new RangeError('atSeconds must be on or after epochSeconds');
  }
  return Math.floor((atSeconds - epochSeconds) / (DAYS_PER_WEEK * 86_400));
}

export function fractionThroughWeek(epochSeconds, atSeconds) {
  assertFiniteNonNegative(epochSeconds, 'epochSeconds');
  assertFiniteNonNegative(atSeconds, 'atSeconds');
  if (atSeconds < epochSeconds) {
    throw new RangeError('atSeconds must be on or after epochSeconds');
  }
  const secondsPerWeek = DAYS_PER_WEEK * 86_400;
  return ((atSeconds - epochSeconds) % secondsPerWeek) / secondsPerWeek;
}

export function annualizedIssuance(daily) {
  assertFiniteNonNegative(daily, 'daily');
  return daily * DAYS_PER_YEAR;
}

export function remainingGeometricIssuance(dailyAtStartOfCurrentWeek, fractionOfCurrentWeekElapsed = 0) {
  assertFiniteNonNegative(dailyAtStartOfCurrentWeek, 'dailyAtStartOfCurrentWeek');
  if (!Number.isFinite(fractionOfCurrentWeekElapsed) || fractionOfCurrentWeekElapsed < 0 || fractionOfCurrentWeekElapsed >= 1) {
    throw new RangeError('fraction must be between 0 and 1 (0 inclusive, 1 exclusive)');
  }
  const weeklyDecayRatio = 2 ** (-1 / DECAY_WEEKS_PER_HALF);
  const remainingCurrentWeek = dailyAtStartOfCurrentWeek * DAYS_PER_WEEK * (1 - fractionOfCurrentWeekElapsed);
  const futureFullWeeks = (dailyAtStartOfCurrentWeek * weeklyDecayRatio * DAYS_PER_WEEK) / (1 - weeklyDecayRatio);
  return remainingCurrentWeek + futureFullWeeks;
}

export function progressTowardLowerMilestone(currentDaily, priorMilestone, nextMilestone) {
  assertFiniteNonNegative(currentDaily, 'currentDaily');
  assertFiniteNonNegative(priorMilestone, 'priorMilestone');
  assertFiniteNonNegative(nextMilestone, 'nextMilestone');
  if (priorMilestone <= nextMilestone) {
    throw new RangeError('priorMilestone must be greater than nextMilestone');
  }
  if (currentDaily < nextMilestone || currentDaily > priorMilestone) {
    throw new RangeError('currentDaily must be between nextMilestone and priorMilestone');
  }
  return (priorMilestone - currentDaily) / (priorMilestone - nextMilestone);
}

export function metricEnvelope(value, classification, source, asOf, formula, assumptions) {
  assertFiniteNonNegative(value, 'value');
  assertMetricMetadata(classification, source, asOf, formula, assumptions);

  return {
    value,
    classification,
    source,
    asOf,
    ...(formula === undefined ? {} : { formula }),
    ...(assumptions === undefined ? {} : { assumptions }),
  };
}
