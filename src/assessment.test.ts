import assert from 'node:assert/strict';
import test from 'node:test';
import { assessCountry, getRiskTier } from './assessment';
import { getCountryByMapName } from './data/countryData';
import type { CountryProfile } from './types';

const stubProfile = (overrides: Partial<CountryProfile>): CountryProfile =>
  ({
    id: 'stub',
    mapName: 'Stub',
    displayName: 'Stub',
    allianceNetwork: 'Non-aligned',
    region: 'Asia',
    subregion: 'southern asia',
    regimeType: 'hybrid',
    baselineRisk: 30,
    sourceCoverage: 70,
    lastUpdated: '2026-05-01',
    assumptions: [],
    sourceIds: [],
    indicators: {
      tradeExposure: 'medium',
      militaryTreatyLevel: 'medium',
      conflictPressure: 'medium',
      sanctionsExposure: 'medium',
      ideology: 'medium',
      borderDisputes: 'medium',
      regimeStability: 'medium',
      conflictHistory: 'medium',
      tradeDependence: 'medium',
      cohesion: 50,
    },
    sources: [],
    relationships: [],
    ...overrides,
  }) as CountryProfile;

test('assessCountry keeps risk within stable bounds', () => {
  const profile = stubProfile({});
  const assessed = assessCountry(profile);
  assert.ok(assessed.risk >= 8 && assessed.risk <= 97, `risk ${assessed.risk} out of bounds`);
  assert.ok(assessed.confidence >= 0 && assessed.confidence <= 100);
  assert.ok(assessed.drivers.length > 0);
});

test('assessCountry classifies clear NATO alignment as bloc A without prediction', () => {
  const profile = stubProfile({
    diplomatic: {
      unVotingAlignmentBlocA: 90,
      unVotingAlignmentBlocB: 10,
      defensePacts: ['NATO'],
      igoMemberships: ['EU'],
    },
  });
  const assessed = assessCountry(profile);
  assert.equal(assessed.alignment, 'blocA');
});

test('assessCountry uses UN voting delta when no pacts are present', () => {
  const blocA = assessCountry(stubProfile({ diplomatic: { unVotingAlignmentBlocA: 85, unVotingAlignmentBlocB: 12, defensePacts: [], igoMemberships: [] } }));
  const blocB = assessCountry(stubProfile({ diplomatic: { unVotingAlignmentBlocA: 15, unVotingAlignmentBlocB: 88, defensePacts: [], igoMemberships: [] } }));
  const neutral = assessCountry(stubProfile({ diplomatic: { unVotingAlignmentBlocA: 52, unVotingAlignmentBlocB: 48, defensePacts: [], igoMemberships: [] } }));
  assert.equal(blocA.alignment, 'blocA');
  assert.equal(blocB.alignment, 'blocB');
  assert.equal(neutral.alignment, 'nonAligned');
});

test('assessCountry marks contested only under genuine instability', () => {
  const contested = assessCountry(
    stubProfile({
      indicators: {
        ...stubProfile({}).indicators,
        conflictPressure: 'high',
        regimeStability: 'low',
      },
      baselineRisk: 80,
      diplomatic: { unVotingAlignmentBlocA: 55, unVotingAlignmentBlocB: 52, defensePacts: [], igoMemberships: [] },
    }),
  );
  assert.equal(contested.alignment, 'unstable');
  assert.equal(getRiskTier(contested.risk), 'high');
});

test('assessCountry is deterministic and stable for real dataset countries', () => {
  const profile = getCountryByMapName('Ukraine');
  assert.ok(profile, 'Ukraine profile should exist');
  const first = assessCountry(profile);
  const second = assessCountry(profile);
  assert.deepEqual(first, second);
  assert.ok(first.confidence >= 0 && first.confidence <= 100);
});