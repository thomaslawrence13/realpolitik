import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotRowsToCsv, snapshotRowsToMarkdown, type SnapshotExportRow } from './exportSnapshot';

const rows: SnapshotExportRow[] = [
  {
    country: '=Formula',
    region: 'Europe | North',
    regime: 'democracy',
    freshCoveragePct: 88,
    confidencePct: 79,
    riskPct: 31,
    relationships: 4,
    trust: 'Observed data',
  },
];

test('CSV export escapes delimiters and spreadsheet formulas', () => {
  const csv = snapshotRowsToCsv(rows);
  assert.match(csv, /"'=Formula"/);
  assert.match(csv, /"Europe \| North"/);
});

test('Markdown export produces a dated observed-state table', () => {
  const markdown = snapshotRowsToMarkdown(rows, '2026-08-08');
  assert.match(markdown, /As of \*\*2026-08-08\*\*/);
  assert.match(markdown, /Europe \\| North/);
  assert.match(markdown, /\| Country \| Region \|/);
});
