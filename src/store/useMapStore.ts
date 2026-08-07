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

type SimulationPayload = {
  profiles: CountryProfile[];
  scenarioInputs: ScenarioInputs;
  activeEvents: EventTemplate[];
  weightSetKey: WeightSetKey;
};

type Actions = {
  setSelectedCountry: (country: string) => void;
  setHoveredCountry: (country: string | null) => void;
  setCurrentYear: (year: number) => void;
  setActiveFilters: (filters: Filters) => void;
  setSimulationPayload: (payload: SimulationPayload) => void;
};

type StoreShape = MapState & Actions;

type UseMapStore = {
  <T>(selector: (store: StoreShape) => T): T;
  setState: (partial: Partial<MapState>) => void;
  getState: () => StoreShape;
  destroy: () => void;
};

const listeners = new Set<() => void>();

let state: MapState = {
  selectedCountry: 'United States of America',
  hoveredCountry: null,
  currentYear: 0,
  activeFilters: {
    allianceNetwork: 'all',
    tradeExposure: 'all',
    militaryTreatyLevel: 'all',
    conflictPressure: 'all',
    sanctionsExposure: 'all',
    regimeType: 'all',
    riskLevel: 'all',
  },
  simulationSnapshot: null,
};

let simulationWorker: Worker | null = null;
let latestRequestId = 0;
let simulationPayload: SimulationPayload | null = null;
/** Coalesce bursts of setSimulationPayload into one worker post per microtask. */
let simulationFlushScheduled = false;

const ensureWorker = () => {
  if (simulationWorker || typeof window === 'undefined') return;
  simulationWorker = new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), {
    type: 'module',
  });
  simulationWorker.onmessage = (event: MessageEvent<MapState['simulationSnapshot'] & { type: string }>) => {
    if (!event.data || event.data.type !== 'simulated') return;
    if (event.data.requestId !== latestRequestId) return;
    setState({
      simulationSnapshot: {
        simulated: event.data.simulated,
        baselineSimulated: event.data.baselineSimulated,
        requestId: event.data.requestId,
      },
    });
  };
};

const postSimulation = () => {
  if (!simulationPayload) return;
  ensureWorker();
  if (!simulationWorker) return;
  latestRequestId += 1;
  simulationWorker.postMessage({
    type: 'simulate',
    requestId: latestRequestId,
    timelineIndex: state.currentYear,
    // Bulk map sims never need history or per-country explanation (inspector
    // re-sims the selected country on the main thread with explanation).
    ...simulationPayload,
  });
};

const scheduleSimulation = () => {
  if (simulationFlushScheduled) return;
  simulationFlushScheduled = true;
  queueMicrotask(() => {
    simulationFlushScheduled = false;
    postSimulation();
  });
};

const actions: Actions = {
  setSelectedCountry: (selectedCountry) => {
    if (state.selectedCountry === selectedCountry) return;
    setState({ selectedCountry });
  },
  setHoveredCountry: (hoveredCountry) => {
    if (state.hoveredCountry === hoveredCountry) return;
    setState({ hoveredCountry });
  },
  setCurrentYear: (currentYear) => {
    if (state.currentYear === currentYear) return;
    setState({ currentYear });
    scheduleSimulation();
  },
  setActiveFilters: (activeFilters) => setState({ activeFilters }),
  setSimulationPayload: (payload) => {
    simulationPayload = payload;
    scheduleSimulation();
  },
};

/** Stable snapshot for useSyncExternalStore — rebuilt only when state mutates. */
let storeSnapshot: StoreShape = { ...state, ...actions };

const getSnapshot = (): StoreShape => storeSnapshot;

const setState = (partial: Partial<MapState>) => {
  state = { ...state, ...partial };
  storeSnapshot = { ...state, ...actions };
  listeners.forEach((listener) => listener());
};

const destroy = (): void => {
  if (simulationWorker) {
    simulationWorker.terminate();
    simulationWorker = null;
  }
  simulationFlushScheduled = false;
  simulationPayload = null;
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
useMapStore.destroy = destroy;
