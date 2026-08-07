import { useState, useCallback, useEffect, useRef } from 'react';
import { loadPersistedState, savePersistedState } from '../lib/persistence';
import type { SavedScenario, ScenarioInputs, WeightSetKey } from '../types';
import type { InspectorTab } from '../components/RightInspector';
import type { DrawerTab } from '../components/BottomDrawer';
import type { Filters } from '../types';

interface PersistedState {
  selectedCountry: string;
  scenarioName: string;
  scenarioInputs: ScenarioInputs;
  weightSetKey: WeightSetKey;
  activeEventIds: string[];
  savedScenarios: SavedScenario[];
  filters: Filters;
  timelineIndex: number;
  inspectorTab: InspectorTab;
  drawerTab: DrawerTab;
  drawerOpen: boolean;
  drawerHeight: number;
  comparisonScenarioId: string | null;
}

interface PersistedStateActions {
  setSelectedCountry: (country: string) => void;
  setScenarioName: (name: string) => void;
  setScenarioInputs: (inputs: ScenarioInputs | ((prev: ScenarioInputs) => ScenarioInputs)) => void;
  setWeightSetKey: (key: WeightSetKey) => void;
  setActiveEventIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setSavedScenarios: (scenarios: SavedScenario[] | ((prev: SavedScenario[]) => SavedScenario[])) => void;
  setFilters: (filters: Filters) => void;
  setTimelineIndex: (index: number) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setDrawerTab: (tab: DrawerTab) => void;
  setDrawerOpen: (open: boolean) => void;
  setDrawerHeight: (height: number | ((prev: number) => number)) => void;
  setComparisonScenarioId: (id: string | null) => void;
}

export function usePersistedState(
  initialState: Partial<PersistedState>,
): [PersistedState, PersistedStateActions] {
  const persistDebounceRef = useRef<number | null>(null);
  const [state, setState] = useState<PersistedState>(() => {
    const persisted = loadPersistedState();
    return {
      selectedCountry: initialState.selectedCountry ?? persisted?.selectedCountry ?? 'United States of America',
      scenarioName: initialState.scenarioName ?? persisted?.scenarioName ?? 'Baseline+',
      scenarioInputs: initialState.scenarioInputs ?? persisted?.scenarioInputs ?? {} as ScenarioInputs,
      weightSetKey: initialState.weightSetKey ?? persisted?.weightSetKey ?? 'baseline',
      activeEventIds: initialState.activeEventIds ?? persisted?.activeEventIds ?? [],
      savedScenarios: initialState.savedScenarios ?? persisted?.savedScenarios ?? [],
      filters: initialState.filters ?? persisted?.filters ?? {
        allianceNetwork: 'all',
        tradeExposure: 'all',
        militaryTreatyLevel: 'all',
        conflictPressure: 'all',
        sanctionsExposure: 'all',
        regimeType: 'all',
        riskLevel: 'all',
      },
      timelineIndex: initialState.timelineIndex ?? persisted?.timelineIndex ?? 0,
      inspectorTab: initialState.inspectorTab ?? persisted?.inspectorTab ?? 'stats',
      drawerTab: initialState.drawerTab ?? persisted?.drawerTab ?? 'index',
      drawerOpen: initialState.drawerOpen ?? persisted?.drawerOpen ?? false,
      drawerHeight: initialState.drawerHeight ?? persisted?.drawerHeight ?? 320,
      comparisonScenarioId: initialState.comparisonScenarioId ?? persisted?.comparisonScenarioId ?? null,
    };
  });

  // Persist to localStorage with debounce
  useEffect(() => {
    if (persistDebounceRef.current) window.clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = window.setTimeout(() => {
      savePersistedState({
        selectedCountry: state.selectedCountry,
        scenarioName: state.scenarioName,
        scenarioInputs: state.scenarioInputs,
        weightSetKey: state.weightSetKey,
        activeEventIds: state.activeEventIds,
        savedScenarios: state.savedScenarios,
        filters: state.filters,
        timelineIndex: state.timelineIndex,
        inspectorTab: state.inspectorTab,
        drawerTab: state.drawerTab,
        drawerOpen: state.drawerOpen,
        drawerHeight: state.drawerHeight,
        comparisonScenarioId: state.comparisonScenarioId,
      });
    }, 300);
  }, [state]);

  const updateState = useCallback(<K extends keyof PersistedState>(
    key: K,
    value: PersistedState[K] | ((prev: PersistedState[K]) => PersistedState[K]),
  ) => {
    setState((prev) => ({
      ...prev,
      [key]: typeof value === 'function' ? (value as (prev: PersistedState[K]) => PersistedState[K])(prev[key]) : value,
    }));
  }, []);

  const actions: PersistedStateActions = {
    setSelectedCountry: (country) => updateState('selectedCountry', country),
    setScenarioName: (name) => updateState('scenarioName', name),
    setScenarioInputs: (inputs) => updateState('scenarioInputs', inputs),
    setWeightSetKey: (key) => updateState('weightSetKey', key),
    setActiveEventIds: (ids) => updateState('activeEventIds', ids),
    setSavedScenarios: (scenarios) => updateState('savedScenarios', scenarios),
    setFilters: (filters) => updateState('filters', filters),
    setTimelineIndex: (index) => updateState('timelineIndex', index),
    setInspectorTab: (tab) => updateState('inspectorTab', tab),
    setDrawerTab: (tab) => updateState('drawerTab', tab),
    setDrawerOpen: (open) => updateState('drawerOpen', open),
    setDrawerHeight: (height) => updateState('drawerHeight', height),
    setComparisonScenarioId: (id) => updateState('comparisonScenarioId', id),
  };

  return [state, actions];
}
