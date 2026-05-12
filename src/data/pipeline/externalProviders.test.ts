import assert from 'node:assert/strict';
import test from 'node:test';
import { countryProfiles } from '../countryData';
import { countryIso2 } from '../worldBankClient';
import { buildIngestedObservations } from './externalProviders';

test('ingested observations preserve per-country observedAt from raw ingest audit data', () => {
  const profile = countryProfiles[0]!;
  const iso2 = countryIso2[profile.id]!;
  const snapshot = {
    version: '1.2.0-ingested',
    timestamp: '2026-05-10T22:21:04.787Z',
    world_bank_trade_pct: {
      [profile.id]: 72,
    },
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

  const observations = buildIngestedObservations([profile], snapshot, rawAudit);
  const tradeObservation = observations.find((row) => row.indicator === 'tradeExposure');
  assert.equal(tradeObservation?.observedAt, '2024-12-31');
});
