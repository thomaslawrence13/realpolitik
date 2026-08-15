import assert from 'node:assert/strict';
import test from 'node:test';
import { backendPayloadToLiveData } from './backendClient';
import type { BackendStatePayload } from './backendClient';

const samplePayload = (overrides?: Partial<BackendStatePayload>): BackendStatePayload => ({
  schema: 1,
  refreshedAt: '2026-08-08T03:17:00.000Z',
  source: 'world-bank-open-data',
  indicators: {
    'NY.GDP.MKTP.KD.ZG': {
      latestYear: '2024',
      observedYears: { US: '2023', DE: '2024' },
      retrievedAt: '2026-08-08T03:17:00.000Z',
      values: { US: 2.5, DE: 0.9 },
    },
  },
  diagnostics: {
    totalIndicators: 10,
    succeededIndicators: 1,
    failedIndicators: 9,
    failedCodes: ['PV.EST', 'RL.EST'],
  },
  ...overrides,
});

test('backendPayloadToLiveData maps indicator buckets onto LiveData', () => {
  const live = backendPayloadToLiveData(samplePayload());
  assert.ok(live);
  assert.equal(live.gdpGrowth.US, 2.5);
  assert.deepEqual(live.tradePct, {});
  assert.equal(live.source, 'backend');
  assert.equal(live.refreshedAt, '2026-08-08T03:17:00.000Z');
  assert.equal(live.indicatorMetadata.gdpGrowth?.observedYears.US, '2023');
  assert.equal(live.indicatorMetadata.gdpGrowth?.retrievedAt, '2026-08-08T03:17:00.000Z');
  assert.deepEqual(live.diagnostics.failedCodes, ['PV.EST', 'RL.EST']);
});

test('cold-start payload with zero coverage yields null (fallback trigger)', () => {
  const live = backendPayloadToLiveData({ ...samplePayload(), indicators: {} });
  assert.equal(live, null);
});

test('legacy seven-indicator backend payload triggers direct catalog fallback', () => {
  const live = backendPayloadToLiveData({
    ...samplePayload(),
    diagnostics: { ...samplePayload().diagnostics, totalIndicators: 7 },
  });
  assert.equal(live, null);
});

test('schema mismatch is rejected', () => {
  const live = backendPayloadToLiveData({ ...samplePayload(), schema: 2 as 1 });
  assert.equal(live, null);
});

test('null payload is rejected', () => {
  assert.equal(backendPayloadToLiveData(null), null);
  assert.equal(backendPayloadToLiveData(undefined), null);
});
