import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHistoricalSeriesArtifact } from './historicalSeriesArtifact';

test('historical artifact compaction sorts, deduplicates, and drops unusable rows', () => {
  const artifact = buildHistoricalSeriesArtifact('2026-08-15T12:00:00.000Z', {
    'NY.GDP.MKTP.KD.ZG': [
      { country: { id: 'US', value: 'United States' }, date: '2024', value: 2.1 },
      { country: { id: 'US', value: 'United States' }, date: '2023', value: 1.9 },
      { country: { id: 'US', value: 'United States' }, date: '2024', value: 2.2 },
      { country: { id: 'US', value: 'United States' }, date: '2022', value: null },
      { country: { id: '', value: 'Taiwan, China' }, date: '2024', value: 4.3 },
    ],
  });

  assert.equal(artifact.schema, 2);
  assert.deepEqual(artifact.indicators['NY.GDP.MKTP.KD.ZG'], {
    TW: [['2024', 4.3]],
    US: [['2023', 1.9], ['2024', 2.2]],
  });
});
