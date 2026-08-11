import assert from 'node:assert/strict';
import test from 'node:test';
import { countryProfiles } from '../countryData';
import { countryIso2 } from '../worldBankClient';
import { buildIngestedObservations, buildObservedAtIndex } from './externalProviders';

test('ingested observations take observedAt from the snapshot observation dates', () => {
  const profile = countryProfiles[0]!;
  const snapshot = {
    version: '1.6.0-ingested',
    timestamp: '2026-08-11T19:22:17.888Z',
    world_bank_trade_pct: { [profile.id]: 72 },
    observation_dates: {
      world_bank_trade_pct: { [profile.id]: '2024-12-31' },
    },
  };

  const observations = buildIngestedObservations([profile], snapshot);
  const tradeObservation = observations.find((row) => row.indicator === 'tradeExposure');

  assert.equal(tradeObservation?.observedAt, '2024-12-31');
  // The vintage is what the UI cites, and must be the observation year rather
  // than the year the ingest ran.
  assert.equal(tradeObservation?.vintage, '2024');
});

test('observation dates fall back to the raw audit for pre-v1.6 snapshots', () => {
  const profile = countryProfiles[0]!;
  const iso2 = countryIso2[profile.id]!;
  const snapshot = {
    version: '1.2.0-ingested',
    timestamp: '2026-05-10T22:21:04.787Z',
    world_bank_trade_pct: { [profile.id]: 72 },
  };
  const rawAudit = {
    fetchedAt: '2026-05-10T22:21:04.787Z',
    indicators: {
      'TG.VAL.TOTL.GD.ZS': [
        { country: { id: iso2, value: profile.displayName }, date: '2025', value: null },
        { country: { id: iso2, value: profile.displayName }, date: '2024', value: 72 },
      ],
    },
  };

  const index = buildObservedAtIndex(snapshot, rawAudit);
  assert.equal(index.world_bank_trade_pct[profile.id], '2024-12-31');

  const observations = buildIngestedObservations([profile], snapshot, index);
  const tradeObservation = observations.find((row) => row.indicator === 'tradeExposure');
  assert.equal(tradeObservation?.observedAt, '2024-12-31');
});

test('precomputed observation dates win over the raw audit when both are present', () => {
  const profile = countryProfiles[0]!;
  const iso2 = countryIso2[profile.id]!;
  const index = buildObservedAtIndex(
    {
      version: '1.6.0-ingested',
      timestamp: '2026-08-11T19:22:17.888Z',
      observation_dates: { world_bank_trade_pct: { [profile.id]: '2025-12-31' } },
    },
    {
      fetchedAt: '2026-08-11T19:22:17.888Z',
      indicators: {
        'TG.VAL.TOTL.GD.ZS': [
          { country: { id: iso2, value: profile.displayName }, date: '2019', value: 60 },
        ],
      },
    },
  );

  assert.equal(index.world_bank_trade_pct[profile.id], '2025-12-31');
});

test('the raw audit keeps the newest date per country, not the first row seen', () => {
  const profile = countryProfiles[0]!;
  const iso2 = countryIso2[profile.id]!;
  const index = buildObservedAtIndex(undefined, {
    fetchedAt: '2026-05-10T22:21:04.787Z',
    indicators: {
      'TG.VAL.TOTL.GD.ZS': [
        { country: { id: iso2, value: profile.displayName }, date: '2021', value: 65 },
        { country: { id: iso2, value: profile.displayName }, date: '2024', value: 72 },
        { country: { id: iso2, value: profile.displayName }, date: '2022', value: 68 },
      ],
    },
  });

  assert.equal(index.world_bank_trade_pct[profile.id], '2024-12-31');
});
