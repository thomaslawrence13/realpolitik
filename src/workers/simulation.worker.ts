/// <reference lib="webworker" />
import { defaultScenarioInputs, simulateCountry, simulationWeightSets } from '../simulation';
import type { CountryProfile, EventTemplate, ScenarioInputs, SimulatedCountry, WeightSetKey } from '../types';

type SimulationWorkerRequest = {
  type: 'simulate';
  requestId: number;
  timelineIndex: number;
  profiles: CountryProfile[];
  selectedCountry: string;
  scenarioInputs: ScenarioInputs;
  activeEvents: EventTemplate[];
  weightSetKey: WeightSetKey;
};

type SimulationWorkerResponse = {
  type: 'simulated';
  requestId: number;
  simulated: SimulatedCountry[];
  baselineSimulated: SimulatedCountry[];
};

self.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  const data = event.data;
  if (data.type !== 'simulate') return;
  const weightSet = simulationWeightSets[data.weightSetKey] ?? simulationWeightSets.baseline;
  const simulated = data.profiles.map((profile) =>
    simulateCountry(profile, data.timelineIndex, {
      scenarioInputs: data.scenarioInputs,
      activeEvents: data.activeEvents,
      weightSet,
      includeExplanation: profile.mapName === data.selectedCountry,
    }),
  );
  const baselineSimulated = data.profiles.map((profile) =>
    simulateCountry(profile, data.timelineIndex, {
      scenarioInputs: defaultScenarioInputs,
      weightSet: simulationWeightSets.baseline,
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

