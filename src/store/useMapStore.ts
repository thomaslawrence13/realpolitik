import { useSyncExternalStore } from 'react';
import type { Filters, MapFillMode, OverlayMode } from '../types';

type MapState = {
  selectedCountry: string;
  hoveredCountry: string | null;
  activeFilters: Filters;
  overlayMode: OverlayMode;
  fillMode: MapFillMode;
};

type Actions = {
  setSelectedCountry: (country: string) => void;
  setHoveredCountry: (country: string | null) => void;
  setActiveFilters: (filters: Filters) => void;
  setOverlayMode: (mode: OverlayMode) => void;
  setFillMode: (mode: MapFillMode) => void;
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
  activeFilters: {
    allianceNetwork: 'all',
    tradeExposure: 'all',
    militaryTreatyLevel: 'all',
    conflictPressure: 'all',
    sanctionsExposure: 'all',
    regimeType: 'all',
    riskLevel: 'all',
  },
  overlayMode: 'none',
  fillMode: 'risk',
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
  setActiveFilters: (activeFilters) => setState({ activeFilters }),
  setOverlayMode: (overlayMode) => setState({ overlayMode }),
  setFillMode: (fillMode) => setState({ fillMode }),
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
  listeners.clear();
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
