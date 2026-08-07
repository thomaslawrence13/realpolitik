import assert from 'node:assert/strict';
import test from 'node:test';
import { countryProfiles } from '../countryData';
import {
  buildCuratedStatsFallbackObservations,
  buildConflictSnapshotObservations,
} from './providers';

test('curated stats fallbacks cover trade and military for every profile with stats', () => {
  const observations = buildCuratedStatsFallbackObservations(countryProfiles);
  const trade = new Set(
    observations.filter((row) => row.indicator === 'tradeExposure').map((row) => row.countryId),
  );
  const military = new Set(
    observations.filter((row) => row.indicator === 'militaryTreatyLevel').map((row) => row.countryId),
  );

  for (const profile of countryProfiles) {
    if (profile.economicStats) {
      assert.ok(trade.has(profile.id), `missing trade fallback for ${profile.id}`);
    }
    if (profile.militaryStats) {
      assert.ok(military.has(profile.id), `missing military fallback for ${profile.id}`);
    }
  }
});

test('conflict snapshot reaffirmations use a fresh observedAt', () => {
  const observations = buildConflictSnapshotObservations(countryProfiles.slice(0, 3));
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(observations.length >= 6);
  for (const row of observations) {
    assert.equal(row.observedAt, today);
    assert.equal(row.method, 'expert-curated');
  }
});
