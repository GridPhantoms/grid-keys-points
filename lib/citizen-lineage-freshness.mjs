export const LINEAGE_MAX_AGE_MS = 36 * 60 * 60 * 1_000;

export function isLineageSnapshotCurrent(generatedAt, now = Date.now()) {
  const generatedAtMs = Date.parse(generatedAt);
  const age = now - generatedAtMs;
  return Number.isFinite(age) && age >= 0 && age <= LINEAGE_MAX_AGE_MS;
}
