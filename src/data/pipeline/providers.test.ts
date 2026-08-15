import assert from 'node:assert/strict';
import test from 'node:test';
import { countryProfiles } from '../countryData';
import type { LiveData } from '../worldBankClient';
import { buildUcdpConflictObservations, buildWorldBankObservations } from './providers';

const liveFor = (observedYear?: string): LiveData => ({
  militaryExpPct: {},
  militaryExpUsd: {},
  tradePct: { US: 62 },
  gdpGrowth: {},
  gdpNominalUsd: {},
  gdpPerCapitaUsd: {},
  inflation: {},
  politicalStability: {},
  ruleOfLaw: {},
  unemployment: {},
  indicatorMetadata: observedYear
    ? {
        tradePct: {
          latestYear: observedYear,
          observedYears: { US: observedYear },
          retrievedAt: '2026-08-08T03:17:00.000Z',
        },
      }
    : {},
  diagnostics: {
    totalIndicators: 1,
    succeededIndicators: observedYear ? 1 : 0,
    failedIndicators: observedYear ? 0 : 1,
    failedCodes: [],
  },
});

test('World Bank observations keep the country-level observation year and retrieval timestamp', () => {
  const profile = countryProfiles.find((candidate) => candidate.id === 'united-states');
  assert.ok(profile);
  const [observation] = buildWorldBankObservations([profile], liveFor('2023'));
  assert.equal(observation?.observedAt, '2023-12-31');
  assert.equal(observation?.retrievedAt, '2026-08-08T03:17:00.000Z');
});

test('World Bank observations do not invent a current observation date without metadata', () => {
  const profile = countryProfiles.find((candidate) => candidate.id === 'united-states');
  assert.ok(profile);
  assert.deepEqual(buildWorldBankObservations([profile], liveFor()), []);
});

test('World Bank governance observations credit WGI rather than WDI', () => {
  const profile = countryProfiles.find((candidate) => candidate.id === 'united-states');
  assert.ok(profile);
  const live: LiveData = {
    ...liveFor(),
    tradePct: {},
    politicalStability: { US: 0.6 },
    ruleOfLaw: { US: 1.1 },
    indicatorMetadata: {
      politicalStability: {
        latestYear: '2024',
        observedYears: { US: '2024' },
        retrievedAt: '2026-08-15T12:00:00.000Z',
      },
      ruleOfLaw: {
        latestYear: '2024',
        observedYears: { US: '2024' },
        retrievedAt: '2026-08-15T12:00:00.000Z',
      },
    },
  };

  const governance = buildWorldBankObservations([profile], live).filter(
    (observation) => observation.indicator === 'regimeStability',
  );
  assert.equal(governance.length, 2);
  assert.deepEqual(new Set(governance.map((observation) => observation.sourceId)), new Set(['world-bank-wgi']));
});

test('final UCDP observations inform history without masquerading as current pressure', () => {
  const base = countryProfiles.find((candidate) => candidate.id === 'united-states');
  assert.ok(base);
  const profile = {
    ...base,
    conflict: {
      active: true,
      lastYear: 2025,
      lastYearStateBased: true,
      lastYearNonState: false,
      lastYearOneSided: true,
      deathsLastYear: 1_250,
      deathsPriorYear: 400,
      totalDeathsInWindow: 12_000,
      stateBased: true,
      nonState: true,
      oneSided: true,
      version: '26.1',
      sourceTitle: 'UCDP Country-Year Dataset',
      sourceUrl: 'https://ucdp.uu.se/downloads/',
      retrievedAt: '2026-08-15',
    },
  };

  const observations = buildUcdpConflictObservations([profile]);
  assert.deepEqual(
    observations.map(({ indicator, value, sourceId, observedAt }) => ({ indicator, value, sourceId, observedAt })),
    [
      { indicator: 'conflictHistory', value: 'high', sourceId: 'ucdp', observedAt: '2025-12-31' },
    ],
  );
});

test('UCDP absence does not overwrite broader curated conflict posture', () => {
  const base = countryProfiles.find((candidate) => candidate.id === 'united-states');
  assert.ok(base);
  const profile = {
    ...base,
    conflict: {
      active: false,
      lastYear: 2025,
      lastYearStateBased: false,
      lastYearNonState: false,
      lastYearOneSided: false,
      deathsLastYear: 0,
      deathsPriorYear: 0,
      totalDeathsInWindow: 0,
      stateBased: false,
      nonState: false,
      oneSided: false,
      version: '26.1',
      sourceTitle: 'UCDP Country-Year Dataset',
      sourceUrl: 'https://ucdp.uu.se/downloads/',
      retrievedAt: '2026-08-15',
    },
  };

  assert.deepEqual(buildUcdpConflictObservations([profile]), []);
});
