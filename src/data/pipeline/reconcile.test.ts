import assert from 'node:assert/strict';
import test from 'node:test';
import { countryProfiles } from '../countryData';
import { enrichCountryWithObservations } from './reconcile';
import type { IndicatorObservation } from './types';

test('reconciliation respects source priority before confidence', () => {
  const profile = countryProfiles[0]!;
  const observations: IndicatorObservation[] = [
    {
      providerId: 'low-priority-high-confidence',
      sourceId: 'wto-profile',
      countryId: profile.id,
      indicator: 'tradeExposure',
      value: 'high',
      observedAt: '2026-01-01',
      method: 'api',
      confidence: 0.99,
    },
    {
      providerId: 'high-priority-lower-confidence',
      sourceId: 'world-bank-wdi',
      countryId: profile.id,
      indicator: 'tradeExposure',
      value: 'low',
      observedAt: '2024-01-01',
      method: 'api',
      confidence: 0.7,
    },
  ];

  const enriched = enrichCountryWithObservations(profile, observations);
  assert.equal(enriched.indicators.tradeExposure, 'low');
  const telemetry = enriched.dataQuality.indicators.find((entry) => entry.indicator === 'tradeExposure');
  assert.equal(telemetry?.sourceId, 'world-bank-wdi');
});

test('stale or low-confidence observations are marked as fallback evidence', () => {
  const profile = countryProfiles[1]!;
  const observations: IndicatorObservation[] = [
    {
      providerId: 'ancient-snapshot',
      sourceId: 'world-bank-wdi',
      countryId: profile.id,
      indicator: 'tradeExposure',
      value: 'medium',
      observedAt: '2000-01-01',
      method: 'api',
      confidence: 0.2,
    },
  ];

  const enriched = enrichCountryWithObservations(profile, observations);
  const telemetry = enriched.dataQuality.indicators.find((entry) => entry.indicator === 'tradeExposure');

  assert.equal(telemetry?.evidenceClass, 'fallback');
  assert.equal(telemetry?.stale, true);
  assert.ok(enriched.dataQuality.degradedReasons.length > 0);
});
