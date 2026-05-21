import assert from 'node:assert/strict';
import test from 'node:test';
import { countryProfiles } from './data/countryData';
import type { EventTemplate } from './types';
import { defaultScenarioInputs, getScenarioInputsForProfile, simulateCountry, getRiskTier } from './simulation';

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

test('getRiskTier classifies risk correctly', () => {
  assert.equal(getRiskTier(70), 'high');
  assert.equal(getRiskTier(67), 'high');
  assert.equal(getRiskTier(66), 'medium');
  assert.equal(getRiskTier(50), 'medium');
  assert.equal(getRiskTier(34), 'medium');
  assert.equal(getRiskTier(33), 'low');
  assert.equal(getRiskTier(0), 'low');
});

test('simulateCountry with no relationships handles gracefully', () => {
  const isolated = countryProfiles.find((p) => !p.relationships || p.relationships.length === 0);
  if (!isolated) {
    // Skip if no isolated country exists
    return;
  }
  const simulated = simulateCountry(isolated, 0, { includeHistory: false });
  assert.ok(simulated.alignment !== undefined);
  assert.ok(simulated.risk >= 0 && simulated.risk <= 100);
});

test('simulateCountry with extreme timeline index remains stable', () => {
  const profile = countryProfiles[0]!;
  const simulated = simulateCountry(profile, 100, { includeHistory: false });

  assert.ok(simulated.risk >= 0 && simulated.risk <= 100);
  assert.ok(simulated.confidence >= 0 && simulated.confidence <= 100);
  const probabilitySum = simulated.probabilities.blocA + simulated.probabilities.blocB + simulated.probabilities.nonAligned;
  assert.ok(Math.abs(probabilitySum - 100) < 0.01);
});

test('simulateCountry with explanation option returns detailed breakdown', () => {
  const profile = countryProfiles[0]!;
  const simulated = simulateCountry(profile, 1, { includeExplanation: true });

  assert.ok(simulated.explanation !== null);
  assert.ok(simulated.explanation.risk.components.length > 0);
  assert.ok(simulated.explanation.confidence.components.length > 0);
});
