import assert from 'node:assert/strict';
import test from 'node:test';
import { countryProfiles } from './data/countryData';
import type { EventTemplate } from './types';
import { defaultScenarioInputs, getScenarioInputsForProfile, simulateCountry } from './simulation';

test('getScenarioInputsForProfile clamps accumulated event inputs to slider bounds', () => {
  const profile = countryProfiles[0]!;
  const events: EventTemplate[] = [
    {
      id: 'stress-event',
      name: 'Stress Event',
      category: 'compound',
      summary: 'Testing clamping',
      regionTags: ['Global'],
      inputs: {
        sanctionShock: 400,
        treatyShift: -400,
        electionVolatility: 400,
        invasionPressure: 400,
        coupRisk: 400,
      },
    },
  ];
  const next = getScenarioInputsForProfile(defaultScenarioInputs, events, profile);

  assert.equal(next.sanctionShock, 100);
  assert.equal(next.treatyShift, -60);
  assert.equal(next.electionVolatility, 100);
  assert.equal(next.invasionPressure, 100);
  assert.equal(next.coupRisk, 100);
});

test('simulateCountry keeps probabilities, risk, and confidence within stable bounds', () => {
  const profile = countryProfiles[0]!;
  const simulated = simulateCountry(profile, 1, { includeHistory: false });
  const probabilitySum = simulated.probabilities.blocA + simulated.probabilities.blocB + simulated.probabilities.nonAligned;

  assert.ok(simulated.risk >= 0 && simulated.risk <= 100, 'risk should be in [0,100]');
  assert.ok(simulated.confidence >= 0 && simulated.confidence <= 100, 'confidence should be in [0,100]');
  assert.ok(Math.abs(probabilitySum - 100) < 0.01, 'probability set should sum to 100');
});
