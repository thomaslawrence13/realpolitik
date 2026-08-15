import assert from 'node:assert/strict';
import test from 'node:test';
import { countryProfiles } from '../countryData';
import { emptyLiveData } from './index';
import { applyStatsCoverageEnrichment } from './statsEnrichment';

test('economic and military fields carry metric-level World Bank provenance', () => {
  const profile = countryProfiles.find((candidate) => candidate.id === 'united-states');
  assert.ok(profile?.economicStats);
  assert.ok(profile?.militaryStats);

  const live = {
    ...emptyLiveData(),
    gdpGrowth: { US: 4.2 },
    gdpNominalUsd: { US: 29_000_000_000_000 },
    gdpPerCapitaUsd: { US: 87_000 },
    militaryExpPct: { US: 3.1 },
    indicatorMetadata: {
      gdpGrowth: {
        latestYear: '2023',
        observedYears: { US: '2023' },
        retrievedAt: '2026-08-08T03:17:00.000Z',
      },
      gdpNominalUsd: {
        latestYear: '2025',
        observedYears: { US: '2025' },
        retrievedAt: '2026-08-08T03:17:00.000Z',
      },
      gdpPerCapitaUsd: {
        latestYear: '2025',
        observedYears: { US: '2025' },
        retrievedAt: '2026-08-08T03:17:00.000Z',
      },
      militaryExpPct: {
        latestYear: '2024',
        observedYears: { US: '2024' },
        retrievedAt: '2026-08-08T03:17:00.000Z',
      },
    },
  };

  const enriched = applyStatsCoverageEnrichment(profile, live);
  assert.equal(enriched.economicStats?.gdpGrowthPct, 4.2);
  assert.equal(enriched.economicStats?.gdpBillionUsd, 29_000);
  assert.equal(enriched.economicStats?.gdpPerCapitaUsd, 87_000);
  assert.equal(enriched.economicStats?.provenance?.gdpBillionUsd?.observedAt, '2025-12-31');
  assert.equal(enriched.economicStats?.provenance?.gdpGrowthPct?.sourceId, 'world-bank-wdi');
  assert.equal(enriched.economicStats?.provenance?.gdpGrowthPct?.observedAt, '2023-12-31');
  assert.equal(enriched.economicStats?.provenance?.gdpGrowthPct?.retrievedAt, '2026-08-08T03:17:00.000Z');
  assert.equal(enriched.militaryStats?.provenance?.militaryExpGdpPct?.observedAt, '2024-12-31');
  assert.equal(enriched.militaryStats?.provenance?.militaryExpBillionUsd?.evidenceClass, 'derived');
});
