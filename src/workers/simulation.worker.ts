/// <reference lib="webworker" />
import { defaultScenarioInputs, simulateCountry, simulationWeightSets } from '../simulation';
import type { CountryProfile, EventTemplate, ScenarioInputs, WeightSetKey } from '../types';

type SimulationWorkerRequest = {
  type: 'simulate';
  requestId: number;
  timelineIndex: number;
  profiles: CountryProfile[];
  scenarioInputs: ScenarioInputs;
  activeEvents: EventTemplate[];
  weightSetKey: WeightSetKey;
};

type SimulationWorkerResponse = {
  type: 'simulated';
  requestId: number;
  simulated: ReturnType<typeof simulateCountry>[];
  baselineSimulated: ReturnType<typeof simulateCountry>[];
};

self.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  const data = event.data;
  if (data.type !== 'simulate') return;

  const weightSet = simulationWeightSets[data.weightSetKey] ?? simulationWeightSets.baseline;
  // Bulk path: no history chains, no explanation trees — map/movers only need
  // risk/alignment/probabilities. Inspector enriches the selected country on main.
  const bulkOptions = {
    includeHistory: false as const,
    includeExplanation: false as const,
  };

  const simulated = data.profiles.map((profile) =>
    simulateCountry(profile, data.timelineIndex, {
      scenarioInputs: data.scenarioInputs,
      activeEvents: data.activeEvents,
      weightSet,
      ...bulkOptions,
    }),
  );
  const baselineSimulated = data.profiles.map((profile) =>
    simulateCountry(profile, data.timelineIndex, {
      scenarioInputs: defaultScenarioInputs,
      weightSet: simulationWeightSets.baseline,
      ...bulkOptions,
    }),
  );

  const response: SimulationWorkerResponse = {
    type: 'simulated',
    requestId: data.requestId,
    simulated,
    baselineSimulated,
  };
  self.postMessage(response);
};
