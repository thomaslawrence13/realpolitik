import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendQualitySnapshot,
  emptyQualityHistory,
  QUALITY_HISTORY_LIMIT,
  readQualityHistory,
  summarizeQualityTrend,
  type QualitySnapshot,
} from './qualityHistory.js';

const snapshotFor = (day: string, overrides: Partial<QualitySnapshot> = {}): QualitySnapshot => ({
  generatedAt: `${day}T12:00:00.000Z`,
  day,
  averageInformationScore: 90,
  lowQualityCount: 0,
  staleCountryCount: 5,
  highQualityCount: 134,
  ingestAverageCoveragePct: 95,
  artifactsWithinBudget: 6,
  artifactCount: 6,
  releaseAccepted: true,
  ...overrides,
});

test('a same-day rerun replaces that day rather than appending', () => {
  let history = appendQualitySnapshot(emptyQualityHistory(), snapshotFor('2026-08-15'));
  history = appendQualitySnapshot(history, snapshotFor('2026-08-15', { averageInformationScore: 94 }));

  // Six CI runs in one day must not read as six days of progress.
  assert.equal(history.entries.length, 1);
  assert.equal(history.entries[0]?.averageInformationScore, 94);
});

test('entries stay sorted even when a run arrives out of order', () => {
  let history = appendQualitySnapshot(emptyQualityHistory(), snapshotFor('2026-08-15'));
  history = appendQualitySnapshot(history, snapshotFor('2026-08-10'));

  assert.deepEqual(
    history.entries.map((entry) => entry.day),
    ['2026-08-10', '2026-08-15'],
  );
});

test('history is trimmed to the retention limit, keeping the newest', () => {
  let history = emptyQualityHistory();
  for (let index = 0; index < QUALITY_HISTORY_LIMIT + 10; index++) {
    const day = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
    history = appendQualitySnapshot(history, snapshotFor(day));
  }

  assert.equal(history.entries.length, QUALITY_HISTORY_LIMIT);
  assert.equal(
    history.entries[history.entries.length - 1]?.day,
    new Date(Date.UTC(2026, 0, QUALITY_HISTORY_LIMIT + 10)).toISOString().slice(0, 10),
  );
});

test('a malformed or future-schema payload starts a fresh series', () => {
  assert.deepEqual(readQualityHistory(null), emptyQualityHistory());
  assert.deepEqual(readQualityHistory({ schema: 2, entries: [snapshotFor('2026-08-15')] }), emptyQualityHistory());
  assert.deepEqual(readQualityHistory({ schema: 1, entries: 'nope' }), emptyQualityHistory());
  assert.equal(readQualityHistory({ schema: 1, entries: [snapshotFor('2026-08-15')] }).entries.length, 1);
});

test('the first run reports no trend rather than a row of zeroes', () => {
  const trend = summarizeQualityTrend(appendQualitySnapshot(emptyQualityHistory(), snapshotFor('2026-08-15')));

  assert.equal(trend.entryCount, 1);
  assert.equal(trend.previousDay, null);
  // Null, not zero: "no history yet" must not be displayed as "no change".
  assert.equal(trend.sincePrevious, null);
  assert.equal(trend.sinceFirst, null);
});

test('trend reports movement against the previous and the oldest entry', () => {
  let history = appendQualitySnapshot(
    emptyQualityHistory(),
    snapshotFor('2026-06-01', { averageInformationScore: 88, staleCountryCount: 12, ingestAverageCoveragePct: 90 }),
  );
  history = appendQualitySnapshot(
    history,
    snapshotFor('2026-07-01', { averageInformationScore: 91, staleCountryCount: 9, ingestAverageCoveragePct: 93 }),
  );
  history = appendQualitySnapshot(
    history,
    snapshotFor('2026-08-01', { averageInformationScore: 94, staleCountryCount: 5, ingestAverageCoveragePct: 95.7 }),
  );

  const trend = summarizeQualityTrend(history);
  assert.equal(trend.previousDay, '2026-07-01');
  assert.equal(trend.firstDay, '2026-06-01');
  assert.equal(trend.sincePrevious?.averageInformationScore, 3);
  assert.equal(trend.sincePrevious?.staleCountryCount, -4);
  assert.equal(trend.sinceFirst?.averageInformationScore, 6);
  assert.equal(trend.sinceFirst?.staleCountryCount, -7);
  // Float arithmetic must not leak 5.699999999999996 into a committed report.
  assert.equal(trend.sinceFirst?.ingestAverageCoveragePct, 5.7);
});
