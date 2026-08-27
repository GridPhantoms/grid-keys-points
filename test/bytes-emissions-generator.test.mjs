import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHistoryDocument,
  completedUtcBoundary,
  preserveStableRows,
  utcDayBoundaries,
} from '../scripts/generate-bytes-emissions-history.mjs';

test('completedUtcBoundary returns the start of the current UTC day', () => {
  assert.equal(
    completedUtcBoundary(Date.parse('2026-08-28T09:40:00Z') / 1_000),
    Date.parse('2026-08-28T00:00:00Z') / 1_000,
  );
});

test('utcDayBoundaries includes both ends of complete daily intervals', () => {
  assert.deepEqual(
    utcDayBoundaries(
      Date.parse('2026-08-25T00:00:00Z') / 1_000,
      Date.parse('2026-08-28T00:00:00Z') / 1_000,
    ),
    [
      Date.parse('2026-08-25T00:00:00Z') / 1_000,
      Date.parse('2026-08-26T00:00:00Z') / 1_000,
      Date.parse('2026-08-27T00:00:00Z') / 1_000,
      Date.parse('2026-08-28T00:00:00Z') / 1_000,
    ],
  );
});

test('buildHistoryDocument emits one row per complete UTC interval', () => {
  const boundaries = utcDayBoundaries(
    Date.parse('2026-08-25T00:00:00Z') / 1_000,
    Date.parse('2026-08-28T00:00:00Z') / 1_000,
  );
  const cumulative = {
    S1: [300, 200, 100, 0],
    S2: [30, 20, 10, 0],
    BYTES: [0, 0, 0, 0],
    LP: [0, 0, 0, 0],
  };
  const document = buildHistoryDocument({
    boundaries,
    cumulative,
    generatedAt: '2026-08-28T09:40:00.000Z',
    sourceBlock: 123,
  });

  assert.equal(document.start, '2026-08-25');
  assert.equal(document.end, '2026-08-27');
  assert.equal(document.rows.length, 3);
  assert.deepEqual(document.rows.at(-1), {
    date: '2026-08-27',
    S1: 100,
    S2: 10,
    BYTES: 0,
    LP: 0,
    total: 110,
  });
});

test('preserveStableRows keeps verified historical serialization while appending new dates', () => {
  const oldRow = { date: '2026-08-26', S1: 100.0000000001, S2: 10, BYTES: 0, LP: 0, total: 110.0000000001 };
  const regenerated = {
    rows: [
      { date: '2026-08-26', S1: 100, S2: 10, BYTES: 0, LP: 0, total: 110 },
      { date: '2026-08-27', S1: 90, S2: 9, BYTES: 0, LP: 0, total: 99 },
    ],
  };
  preserveStableRows(regenerated, { rows: [oldRow] });
  assert.equal(regenerated.rows[0], oldRow);
  assert.equal(regenerated.rows[1].date, '2026-08-27');
});
