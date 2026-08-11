import assert from 'node:assert/strict';
import test from 'node:test';
import type { CountryProfile } from '../../types';
import { countryProfiles } from '../countryData';
import { emptyLiveData } from './index';
import { applyStatsCoverageEnrichment } from './statsEnrichment';
import type { ImfWeoSnapshot, IngestedSnapshot } from './externalProviders';

const profileWithStats = (): CountryProfile => {
  const profile = countryProfiles.find((entry) => entry.economicStats && entry.demographics);
  assert.ok(profile, 'expected at least one profile with economic and demographic stats');
  return profile;
};

const weoSnapshot = (countryId: string): ImfWeoSnapshot => ({
  version: 'test',
  timestamp: '2026-08-11T00:00:00.000Z',
  imf_gdp_growth: { [countryId]: { value: 3.75, year: '2025', projection: false } },
  imf_gdp_per_capita_usd: { [countryId]: { value: 51234.5, year: '2025', projection: false } },
});

const ingestSnapshot = (countryId: string): IngestedSnapshot => ({
  version: 'test',
  timestamp: '2026-08-11T00:00:00.000Z',
  world_bank_gdp_growth: { [countryId]: 1.1 },
  world_bank_population: { [countryId]: 51_000_000 },
});

test('IMF WEO takes precedence over the World Bank ingest for overlapping fields', () => {
  const profile = profileWithStats();
  const result = applyStatsCoverageEnrichment(
    profile,
    emptyLiveData(),
    ingestSnapshot(profile.id),
    weoSnapshot(profile.id),
  );

  assert.equal(result.economicStats?.gdpGrowthPct, 3.8);
  assert.equal(result.statsProvenance?.gdpGrowthPct?.sourceId, 'imf-weo');
  assert.equal(result.statsProvenance?.gdpGrowthPct?.vintage, '2025');
});

test('World Bank fills fields the WEO does not cover', () => {
  const profile = profileWithStats();
  const result = applyStatsCoverageEnrichment(
    profile,
    emptyLiveData(),
    ingestSnapshot(profile.id),
    weoSnapshot(profile.id),
  );

  // WDI reports headcount; the profile carries millions.
  assert.equal(result.demographics?.populationMillions, 51);
  assert.equal(result.statsProvenance?.populationMillions?.sourceId, 'world-bank-wdi');
});

test('the ingest year is only a vintage fallback when no observation date is known', () => {
  const profile = profileWithStats();
  const withoutAudit = applyStatsCoverageEnrichment(
    profile,
    emptyLiveData(),
    ingestSnapshot(profile.id),
    undefined,
  );
  assert.equal(withoutAudit.statsProvenance?.gdpGrowthPct?.vintage, '2026');

  const withAudit = applyStatsCoverageEnrichment(
    profile,
    emptyLiveData(),
    ingestSnapshot(profile.id),
    undefined,
    {
      world_bank_gdp_growth: { [profile.id]: '2024-12-31' },
    } as never,
  );
  assert.equal(withAudit.statsProvenance?.gdpGrowthPct?.vintage, '2024');
});

test('a projection flag is carried onto the stat it describes', () => {
  const profile = profileWithStats();
  const result = applyStatsCoverageEnrichment(profile, emptyLiveData(), undefined, {
    version: 'test',
    timestamp: '2026-08-11T00:00:00.000Z',
    imf_gdp_growth: { [profile.id]: { value: 2.5, year: '2026', projection: true } },
  });

  assert.equal(result.statsProvenance?.gdpGrowthPct?.projection, true);
  assert.equal(result.statsProvenance?.gdpGrowthPct?.vintage, '2026');
});

test('countries without a curated snapshot do not gain one from external data', () => {
  const bare: CountryProfile = {
    ...profileWithStats(),
    id: 'test-bare',
    economicStats: undefined,
    demographics: undefined,
    militaryStats: undefined,
  };

  const result = applyStatsCoverageEnrichment(
    bare,
    emptyLiveData(),
    ingestSnapshot('test-bare'),
    weoSnapshot('test-bare'),
  );

  assert.equal(result.economicStats, undefined);
  assert.equal(result.demographics, undefined);
  // Nothing was surfaced, so nothing should be cited.
  assert.equal(result.statsProvenance, undefined);
});
