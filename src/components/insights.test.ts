import assert from 'node:assert/strict';
import test from 'node:test';
import type { CountryAssessment } from '../types';
import { buildCountryBrief } from './inspector/insights';

const assessment = (patch: Partial<CountryAssessment['profile']> = {}): CountryAssessment => ({
  alignment: 'nonAligned',
  confidence: 80,
  risk: 30,
  drivers: [{ label: 'Regime stability', value: 80, direction: 'data' }],
  relationshipSummary: { cooperation: 50, hostility: 20, dependency: 30, deterrence: 30, tension: 25 },
  profile: {
    id: 'test', mapName: 'Test', displayName: 'Test', allianceNetwork: 'None', region: 'Test', subregion: 'Test',
    regimeType: 'democracy', baselineRisk: 30, sourceCoverage: 80, lastUpdated: '2026-01-01', assumptions: [], sourceIds: [],
    indicators: {
      tradeExposure: 'low', militaryTreatyLevel: 'low', conflictPressure: 'low', sanctionsExposure: 'low',
      ideology: 'low', borderDisputes: 'low', regimeStability: 'high', conflictHistory: 'low', tradeDependence: 'low', cohesion: 80,
    },
    sources: [], relationships: [],
    ...patch,
  },
});

test('country brief promotes acute observed signals ahead of positive context', () => {
  const brief = buildCountryBrief(assessment({
    conflict: {
      active: true, lastYear: 2025, lastYearStateBased: true, lastYearNonState: false, lastYearOneSided: false,
      deathsLastYear: 120, deathsPriorYear: 80, totalDeathsInWindow: 500, stateBased: true, nonState: false,
      oneSided: false, version: '1', sourceTitle: 'UCDP', sourceUrl: 'https://example.com', retrievedAt: '2026-01-01',
    },
  }));
  assert.equal(brief.insights[0]?.label, 'Conflict');
  assert.equal(brief.insights[0]?.tone, 'critical');
});

test('country brief surfaces low-confidence evidence gaps', () => {
  const input = assessment();
  input.confidence = 55;
  const brief = buildCountryBrief(input);
  assert.ok(brief.insights.some((insight) => insight.label === 'Evidence gap'));
});
