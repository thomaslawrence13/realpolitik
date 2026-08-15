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
  assert.ok(enriched.dataQuality);
  assert.equal(enriched.indicators.tradeExposure, 'low');
  const telemetry = enriched.dataQuality.indicators.find((entry) => entry.indicator === 'tradeExposure');
  assert.equal(telemetry?.sourceId, 'world-bank-wdi');
});

test('the freshest reference period wins between equally-ranked sources', () => {
  const profile = countryProfiles[0]!;
  // Same source and confidence, re-affirmed on the same day — only the period
  // each figure describes separates them.
  const observations: IndicatorObservation[] = [
    {
      providerId: 'older-vintage',
      sourceId: 'world-bank-wdi',
      countryId: profile.id,
      indicator: 'tradeExposure',
      value: 'low',
      observedAt: '2026-01-01',
      vintage: '2022',
      method: 'snapshot',
      confidence: 0.8,
    },
    {
      providerId: 'newer-vintage',
      sourceId: 'world-bank-wdi',
      countryId: profile.id,
      indicator: 'tradeExposure',
      value: 'high',
      observedAt: '2026-01-01',
      vintage: '2025',
      method: 'snapshot',
      confidence: 0.8,
    },
  ];

  const enriched = enrichCountryWithObservations(profile, observations);
  assert.equal(enriched.indicators.tradeExposure, 'high');
  const telemetry = enriched.dataQuality?.indicators.find((entry) => entry.indicator === 'tradeExposure');
  assert.equal(telemetry?.vintage, '2025');
});

test('vintage and projection provenance survive onto telemetry', () => {
  const profile = countryProfiles[0]!;
  const observations: IndicatorObservation[] = [
    {
      providerId: 'imf-weo-ingest',
      sourceId: 'imf-weo',
      countryId: profile.id,
      indicator: 'cohesion',
      value: 61,
      observedAt: '2026-06-30',
      vintage: '2026',
      seriesUpdatedAt: '2026-08-11',
      projection: true,
      method: 'snapshot',
      confidence: 0.78,
    },
  ];

  const enriched = enrichCountryWithObservations(profile, observations);
  const telemetry = enriched.dataQuality?.indicators.find((entry) => entry.indicator === 'cohesion');

  assert.equal(telemetry?.sourceId, 'imf-weo');
  assert.equal(telemetry?.vintage, '2026');
  assert.equal(telemetry?.seriesUpdatedAt, '2026-08-11');
  assert.equal(telemetry?.projection, true);
});

test('IMF WEO outranks the World Bank for cohesion', () => {
  const profile = countryProfiles[0]!;
  const observations: IndicatorObservation[] = [
    {
      providerId: 'wb-cohesion-ingest',
      sourceId: 'world-bank-wdi',
      countryId: profile.id,
      indicator: 'cohesion',
      value: 40,
      observedAt: '2026-01-01',
      vintage: '2025',
      method: 'snapshot',
      // Higher confidence than the WEO provider, to prove rank is applied first.
      confidence: 0.95,
    },
    {
      providerId: 'imf-weo-ingest',
      sourceId: 'imf-weo',
      countryId: profile.id,
      indicator: 'cohesion',
      value: 70,
      observedAt: '2026-01-01',
      vintage: '2025',
      method: 'snapshot',
      confidence: 0.78,
    },
  ];

  const enriched = enrichCountryWithObservations(profile, observations);
  assert.equal(enriched.indicators.cohesion, 70);
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
  assert.ok(enriched.dataQuality);
  const telemetry = enriched.dataQuality.indicators.find((entry) => entry.indicator === 'tradeExposure');

  assert.equal(telemetry?.evidenceClass, 'fallback');
  assert.equal(telemetry?.stale, true);
  assert.ok(enriched.dataQuality.degradedReasons.length > 0);
  assert.equal(enriched.dataQuality.coverage.valuePct, 13);
  assert.equal(enriched.dataQuality.coverage.freshPct, 0);
  assert.equal(enriched.dataQuality.coverage.fallbackPct, 13);
  assert.equal(enriched.dataQuality.coverage.stalePct, 13);
});
