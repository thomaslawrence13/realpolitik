import assert from 'node:assert/strict';
import test from 'node:test';
import { countryProfiles } from './data/countryData';
import type { EventTemplate } from './types';
import { defaultScenarioInputs, getScenarioInputsForProfile, simulateCountry, getRiskTier, simulationWeightSets } from './simulation';

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

test('probabilities always sum to exactly 100 and are non-negative across all countries and weight sets', () => {
  for (const profile of countryProfiles) {
    for (const weightSet of Object.values(simulationWeightSets)) {
      const simulated = simulateCountry(profile, 5, {
        includeHistory: false,
        weightSet,
      });
      const { blocA, blocB, nonAligned } = simulated.probabilities;
      assert.ok(blocA >= 0, `blocA negative for ${profile.id}`);
      assert.ok(blocB >= 0, `blocB negative for ${profile.id}`);
      assert.ok(nonAligned >= 0, `nonAligned negative for ${profile.id}`);
      const sum = blocA + blocB + nonAligned;
      assert.ok(
        Math.abs(sum - 100) < 0.01,
        `probabilities sum to ${sum} for ${profile.id} with ${weightSet.key}`,
      );
    }
  }
});

test('simulateCountry caches results for identical inputs', () => {
  const profile = countryProfiles[0]!;
  const first = simulateCountry(profile, 3, { includeHistory: false });
  const second = simulateCountry(profile, 3, { includeHistory: false });
  assert.equal(first, second, 'identical inputs should return cached result');
});

test('simulateCountry cache key includes weightSet', () => {
  const profile = countryProfiles[0]!;
  const baseline = simulateCountry(profile, 3, {
    includeHistory: false,
    weightSet: simulationWeightSets.baseline,
  });
  const hardPower = simulateCountry(profile, 3, {
    includeHistory: false,
    weightSet: simulationWeightSets.hardPower,
  });
  // Different weight sets should produce different cache entries — verify
  // by checking that the second call with baseline returns the cached
  // baseline result (same object reference), not the hardPower result.
  const baselineAgain = simulateCountry(profile, 3, {
    includeHistory: false,
    weightSet: simulationWeightSets.baseline,
  });
  assert.equal(baseline, baselineAgain, 'same weight set should return cached result');
  assert.notEqual(baseline, hardPower, 'different weight sets should produce different results');
});

test('simulateCountry with all extreme scenario inputs stays within bounds', () => {
  const profile = countryProfiles[0]!;
  const extremeInputs = { sanctionShock: 100, treatyShift: 60, electionVolatility: 100, invasionPressure: 100, coupRisk: 100 };
  const simulated = simulateCountry(profile, 5, {
    includeHistory: false,
    scenarioInputs: extremeInputs,
  });
  assert.ok(simulated.risk >= 0 && simulated.risk <= 100);
  assert.ok(simulated.confidence >= 0 && simulated.confidence <= 100);
  const sum = simulated.probabilities.blocA + simulated.probabilities.blocB + simulated.probabilities.nonAligned;
  assert.ok(Math.abs(sum - 100) < 0.01);
});

test('getScenarioInputsForProfile accumulates multiple matching events', () => {
  const profile = countryProfiles[0]!;
  const events: EventTemplate[] = [
    {
      id: 'event-1',
      name: 'Event 1',
      category: 'military',
      summary: 'Test',
      inputs: { sanctionShock: 10, treatyShift: 5, electionVolatility: 0, invasionPressure: 0, coupRisk: 0 },
      regionTags: ['Global'],
    },
    {
      id: 'event-2',
      name: 'Event 2',
      category: 'military',
      summary: 'Test',
      inputs: { sanctionShock: 20, treatyShift: -5, electionVolatility: 0, invasionPressure: 0, coupRisk: 0 },
      regionTags: ['Global'],
    },
  ];
  const next = getScenarioInputsForProfile(defaultScenarioInputs, events, profile);
  assert.equal(next.sanctionShock, 30);
  assert.equal(next.treatyShift, 0);
});

test('simulateCountry with includeHistory false returns empty history array', () => {
  const profile = countryProfiles[0]!;
  const simulated = simulateCountry(profile, 5, { includeHistory: false });
  assert.equal(simulated.history.length, 0);
});

test('simulateCountry with includeHistory true returns past snapshots', () => {
  const profile = countryProfiles[0]!;
  const simulated = simulateCountry(profile, 5, { includeHistory: true });
  assert.ok(simulated.history.length > 0);
  for (const snapshot of simulated.history) {
    assert.ok(snapshot.alignment !== undefined);
    assert.ok(snapshot.confidence >= 0 && snapshot.confidence <= 100);
  }
});
