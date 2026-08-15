import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGlobalLiveSummary, formatHudAge, formatHudClock } from './globalStats';
import type { CountryAssessment } from '../types';

const stub = (risk: number, coverage: number): CountryAssessment =>
  ({
    risk,
    profile: { sourceCoverage: coverage },
  }) as CountryAssessment;

test('buildGlobalLiveSummary computes median, means, and risk tiers', () => {
  const summary = buildGlobalLiveSummary([
    stub(10, 80),
    stub(50, 90),
    stub(90, 100),
    stub(70, 70),
  ]);
  assert.equal(summary.countryCount, 4);
  assert.equal(summary.medianRisk, 60);
  assert.equal(summary.meanCoverage, 85);
  assert.equal(summary.elevatedRiskCount, 2);
  assert.equal(summary.highRiskCount, 2);
});

test('buildGlobalLiveSummary handles empty input', () => {
  const summary = buildGlobalLiveSummary([]);
  assert.equal(summary.medianRisk, 0);
  assert.equal(summary.countryCount, 0);
});

test('formatHudAge and formatHudClock handle missing and recent times', () => {
  assert.equal(formatHudClock(null), '—');
  assert.equal(formatHudAge(null), 'not yet fetched');
  const now = Date.parse('2026-08-07T12:00:00.000Z');
  assert.equal(formatHudAge('2026-08-07T11:59:30.000Z', now), 'just now');
  assert.equal(formatHudAge('2026-08-07T11:30:00.000Z', now), '30m ago');
});