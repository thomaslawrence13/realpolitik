import assert from 'node:assert/strict';
import test from 'node:test';
import { countryProfiles } from '../countryData';
import { INFORMATION_QUALITY_CONTRACT } from './contract';
import { buildInformationQualityTelemetry, deriveQualityRemediationDrivers } from './telemetry';

test('buildInformationQualityTelemetry emits runtime telemetry with contract versioned scoring metadata', () => {
  const telemetry = buildInformationQualityTelemetry(countryProfiles, { layer: 'runtime-live' });
  assert.equal(telemetry.layer, 'runtime-live');
  assert.equal(telemetry.scoringVersion, INFORMATION_QUALITY_CONTRACT.scoringVersion);
  assert.equal(telemetry.topInformationCountries.length, 15);
  assert.equal(telemetry.weakestInformationCountries.length, 15);
  assert.ok(telemetry.averageInformationScore >= 0 && telemetry.averageInformationScore <= 100);
});

test('deriveQualityRemediationDrivers prioritizes coverage and stale/fallback issues', () => {
  const base = countryProfiles[0]!;
  const profile = {
    ...base,
    sourceCoverage: 45,
    lastUpdated: '2015-01-01',
    dataQuality: {
      computedSourceCoverage: 45,
      computedLastUpdated: '2015-01-01',
      degradedReasons: ['country snapshot is stale'],
      indicators: (base.dataQuality?.indicators ?? []).map((indicator) => ({
        ...indicator,
        stale: true,
        confidence: 0.2,
        evidenceClass: 'fallback' as const,
        observedAt: '2015-12-31',
      })),
    },
  };

  const drivers = deriveQualityRemediationDrivers(profile);
  assert.ok(drivers.length > 0);
  assert.ok(drivers.some((driver) => driver.includes('Raise source coverage')));
  assert.ok(drivers.some((driver) => driver.includes('stale indicator')));
});
