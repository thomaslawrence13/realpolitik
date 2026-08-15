import assert from 'node:assert/strict';
import test from 'node:test';
import type { CountryAssessment } from '../types';
import { buildCountryBenchmarks } from './inspector/benchmarks';

const country = (id: string, region: string, risk: number, confidence: number, gdpPerCapitaUsd?: number): CountryAssessment => ({
  alignment: 'nonAligned', confidence, risk, drivers: [],
  relationshipSummary: { cooperation: 0, hostility: 0, dependency: 0, deterrence: 0, tension: 0 },
  profile: {
    id, mapName: id, displayName: id, allianceNetwork: 'None', region, subregion: region,
    regimeType: 'democracy', baselineRisk: risk, sourceCoverage: confidence, lastUpdated: '2026-01-01', assumptions: [], sourceIds: [],
    indicators: {
      tradeExposure: 'low', militaryTreatyLevel: 'low', conflictPressure: 'low', sanctionsExposure: 'low',
      ideology: 'low', borderDisputes: 'low', regimeStability: 'high', conflictHistory: 'low', tradeDependence: 'low', cohesion: 80,
    },
    economicStats: gdpPerCapitaUsd === undefined ? undefined : {
      gdpBillionUsd: 100, gdpGrowthPct: 2, gdpPerCapitaUsd, inflationPct: 2, tradeGdpPct: 50,
    },
    sources: [], relationships: [],
  },
});

test('country benchmarks calculate regional medians and global risk rank', () => {
  const selected = country('selected', 'Europe', 40, 80, 30_000);
  const summary = buildCountryBenchmarks(selected, [
    selected,
    country('regional-high', 'Europe', 60, 70, 20_000),
    country('regional-low', 'Europe', 20, 90, 40_000),
    country('global-high', 'Asia', 80, 60, 10_000),
  ]);
  assert.equal(summary.riskRank, 3);
  assert.equal(summary.regionalPeerCount, 3);
  assert.equal(summary.metrics.find((metric) => metric.id === 'risk')?.regionalMedian, 40);
  assert.equal(summary.metrics.find((metric) => metric.id === 'gdpPerCapita')?.regionalMedian, 30_000);
});

test('country benchmarks omit unavailable optional metrics', () => {
  const selected = country('selected', 'Europe', 30, 75);
  const summary = buildCountryBenchmarks(selected, [selected]);
  assert.deepEqual(summary.metrics.map((metric) => metric.id), ['risk', 'confidence']);
});

test('global position includes ties and reaches 100 for the highest value', () => {
  const selected = country('selected', 'Europe', 80, 75);
  const summary = buildCountryBenchmarks(selected, [
    selected,
    country('same-risk', 'Europe', 80, 75),
    country('lower-risk', 'Asia', 20, 75),
  ]);
  assert.equal(summary.metrics.find((metric) => metric.id === 'risk')?.percentile, 100);
});
