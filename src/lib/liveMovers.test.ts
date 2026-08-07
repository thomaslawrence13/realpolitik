import assert from 'node:assert/strict';
import test from 'node:test';
import { computeLiveMovers, sortLiveMovers } from './liveMovers';
import type { CountryProfile } from '../types';

const profile = (
  id: string,
  mapName: string,
  patch: Partial<CountryProfile> & {
    growth?: number;
    inflation?: number;
    trade?: number;
    mil?: number;
    coverage?: number;
  },
): CountryProfile =>
  ({
    id,
    mapName,
    displayName: mapName,
    region: 'Test',
    sourceCoverage: patch.coverage ?? 80,
    economicStats: {
      gdpBillionUsd: 100,
      gdpGrowthPct: patch.growth ?? 2,
      gdpPerCapitaUsd: 10000,
      inflationPct: patch.inflation ?? 3,
      tradeGdpPct: patch.trade ?? 50,
    },
    militaryStats: {
      militaryExpBillionUsd: 2,
      militaryExpGdpPct: patch.mil ?? 1.5,
      activePersonnelThousands: 100,
      nuclearArmed: false,
    },
  }) as CountryProfile;

test('computeLiveMovers ranks countries with observed series changes', () => {
  const staticProfiles = [
    profile('a', 'Alpha', { growth: 2, inflation: 3, mil: 1.5, coverage: 70 }),
    profile('b', 'Beta', { growth: 1, inflation: 2, mil: 2, coverage: 80 }),
  ];
  const liveProfiles = [
    profile('a', 'Alpha', { growth: 5, inflation: 3, mil: 1.5, coverage: 90 }),
    profile('b', 'Beta', { growth: 1, inflation: 8, mil: 2.5, coverage: 80 }),
  ];

  const movers = computeLiveMovers(staticProfiles, liveProfiles);
  assert.equal(movers.length, 2);
  const sorted = sortLiveMovers(movers, 'composite', 10);
  assert.ok(sorted[0]!.compositeScore >= sorted[1]!.compositeScore);

  const byGrowth = sortLiveMovers(movers, 'gdpGrowth', 10);
  assert.equal(byGrowth[0]!.mapName, 'Alpha');
  assert.equal(byGrowth[0]!.growthDelta, 3);
});

test('computeLiveMovers skips unchanged profiles', () => {
  const p = profile('a', 'Alpha', {});
  assert.equal(computeLiveMovers([p], [p]).length, 0);
});
