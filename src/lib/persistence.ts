import type { Filters, MapFillMode, OverlayMode } from '../types';
import type { DrawerTab } from '../components/BottomDrawer';
import type { InspectorTab } from '../components/RightInspector';
import { STORAGE_KEYS } from './constants';

const STORAGE_KEY = STORAGE_KEYS.persistedState;
const STORAGE_VERSION = 2;

export interface PersistedState {
  version: number;
  selectedCountry: string;
  filters: Filters;
  overlayMode?: OverlayMode;
  mapFillMode?: MapFillMode;
  inspectorTab: InspectorTab;
  drawerTab: DrawerTab;
  drawerOpen: boolean;
  drawerHeight: number;
}

export const loadPersistedState = (): Partial<PersistedState> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (parsed.version !== STORAGE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const savePersistedState = (state: Omit<PersistedState, 'version'>): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, ...state }),
    );
  } catch {
    // Quota exceeded or storage unavailable — fail silent so the app keeps working.
  }
};

export const clearPersistedState = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};