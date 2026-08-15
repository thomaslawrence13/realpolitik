import assert from 'node:assert/strict';
import test from 'node:test';
import type { CountryAssessment } from '../types';
import { buildComparisonMetrics, chooseComparisonPeer } from './inspector/comparison';

const country = (
  id: string,
  region: string,
  subregion: string,
  risk: number,
  gdpPerCapitaUsd: number,
  growth = 2,
): CountryAssessment => ({
  alignment: 'nonAligned', confidence: 80, risk, drivers: [],
  relationshipSummary: { cooperation: 0, hostility: 0, dependency: 0, deterrence: 0, tension: 0 },
  profile: {
    id, mapName: id, displayName: id, allianceNetwork: 'None', region, subregion, regimeType: 'democracy',
    baselineRisk: risk, sourceCoverage: 80, lastUpdated: '2026-01-01', assumptions: [], sourceIds: [],
    indicators: {
      tradeExposure: 'low', militaryTreatyLevel: 'low', conflictPressure: 'low', sanctionsExposure: 'low',
      ideology: 'low', borderDisputes: 'low', regimeStability: 'high', conflictHistory: 'low', tradeDependence: 'low', cohesion: 80,
    },
    economicStats: { gdpBillionUsd: 100, gdpGrowthPct: growth, gdpPerCapitaUsd, inflationPct: 2, tradeGdpPct: 50 },
    militaryStats: { militaryExpBillionUsd: 5, militaryExpGdpPct: 1.5, activePersonnelThousands: 10, nuclearArmed: false },
    sources: [], relationships: [],
  },
});

test('comparison peer selection prioritizes a structurally similar subregional country', () => {
  const selected = country('selected', 'Europe', 'Northern Europe', 30, 50_000);
  const closePeer = country('close', 'Europe', 'Northern Europe', 35, 45_000);
  const distantRegion = country('distant', 'Asia', 'Eastern Asia', 30, 50_000);
  const distantEconomy = country('economy', 'Europe', 'Northern Europe', 70, 5_000);
  assert.equal(chooseComparisonPeer(selected, [selected, distantRegion, distantEconomy, closePeer])?.profile.id, 'close');
});

test('comparison metrics describe differences from the selected country perspective', () => {
  const selected = country('selected', 'Europe', 'North', 20, 60_000, 4);
  const peer = country('peer', 'Europe', 'North', 40, 40_000, 1);
  const metrics = buildComparisonMetrics(selected, peer);
  assert.deepEqual(metrics.find((metric) => metric.id === 'risk'), {
    id: 'risk', label: 'Stress risk', selectedLabel: '20%', peerLabel: '40%', deltaLabel: '20pp lower', tone: 'positive',
  });
  assert.equal(metrics.find((metric) => metric.id === 'gdpGrowth')?.deltaLabel, '3.0pp higher');
});
