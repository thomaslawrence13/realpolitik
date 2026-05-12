import { useSyncExternalStore } from 'react';
import type { CountryProfile, EventTemplate, Filters, ScenarioInputs, SimulatedCountry, WeightSetKey } from '../types';

type MapState = {
  selectedCountry: string;
  hoveredCountry: string | null;
  currentYear: number;
  activeFilters: Filters;
  simulationSnapshot: {
    simulated: SimulatedCountry[];
    baselineSimulated: SimulatedCountry[];
    requestId: number;
  } | null;
};

type Actions = {
  setSelectedCountry: (country: string) => void;
  setHoveredCountry: (country: string | null) => void;
  setCurrentYear: (year: number) => void;
  setActiveFilters: (filters: Filters) => void;
  setSimulationPayload: (payload: {
    profiles: CountryProfile[];
    scenarioInputs: ScenarioInputs;
    activeEvents: EventTemplate[];
    weightSetKey: WeightSetKey;
  }) => void;
};

type StoreShape = MapState & Actions;

type UseMapStore = {
  <T>(selector: (store: StoreShape) => T): T;
  setState: (partial: Partial<MapState>) => void;
  getState: () => StoreShape;
};

const listeners = new Set<() => void>();
let state: MapState = {
  selectedCountry: 'United States of America', hoveredCountry: null, currentYear: 0,
  activeFilters: { allianceNetwork: 'all', tradeExposure: 'all', militaryTreatyLevel: 'all', conflictPressure: 'all', sanctionsExposure: 'all', regimeType: 'all', riskLevel: 'all' },
  simulationSnapshot: null,
};
let simulationWorker: Worker | null = null;
let latestRequestId = 0;
let simulationPayload: {
  profiles: CountryProfile[];
  scenarioInputs: ScenarioInputs;
  activeEvents: EventTemplate[];
  weightSetKey: WeightSetKey;
} | null = null;

const ensureWorker = () => {
  if (simulationWorker || typeof window === 'undefined') return;
  simulationWorker = new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), { type: 'module' });
  simulationWorker.onmessage = (event: MessageEvent<MapState['simulationSnapshot'] & { type: string }>) => {
    if (!event.data || event.data.type !== 'simulated') return;
    if (event.data.requestId !== latestRequestId) return;
    setState({ simulationSnapshot: { simulated: event.data.simulated, baselineSimulated: event.data.baselineSimulated, requestId: event.data.requestId } });
  };
};
const requestSimulation = () => {
  if (!simulationPayload) return;
  ensureWorker();
  if (!simulationWorker) return;
  latestRequestId += 1;
  simulationWorker.postMessage({
    type: 'simulate',
    requestId: latestRequestId,
    timelineIndex: state.currentYear,
    selectedCountry: state.selectedCountry,
    ...simulationPayload,
  });
};

const actions: Actions = {
  setSelectedCountry: (selectedCountry) => setState({ selectedCountry }),
  setHoveredCountry: (hoveredCountry) => setState({ hoveredCountry }),
  setCurrentYear: (currentYear) => {
    setState({ currentYear });
    requestSimulation();
  },
  setActiveFilters: (activeFilters) => setState({ activeFilters }),
  setSimulationPayload: (payload) => {
    simulationPayload = payload;
    requestSimulation();
  },
};

const getSnapshot = (): StoreShape => ({ ...state, ...actions });
const setState = (partial: Partial<MapState>) => {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
};

export const useMapStore = ((selector) =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selector(getSnapshot()),
  )) as UseMapStore;

useMapStore.setState = setState;
useMapStore.getState = getSnapshot;
