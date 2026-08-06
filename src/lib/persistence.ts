import type {
  Filters,
  MapFillMode,
  OverlayMode,
  SavedScenario,
  ScenarioInputs,
  WeightSetKey,
} from '../types';
import type { DrawerTab } from '../components/BottomDrawer';
import type { InspectorTab } from '../components/RightInspector';
import { STORAGE_KEYS } from './constants';

const STORAGE_KEY = STORAGE_KEYS.persistedState;
const STORAGE_VERSION = 1;
const EXPORT_VERSION = 1;

export interface PersistedState {
  version: number;
  selectedCountry: string;
  scenarioName: string;
  scenarioInputs: ScenarioInputs;
  weightSetKey: WeightSetKey;
  activeEventIds: string[];
  savedScenarios: SavedScenario[];
  filters: Filters;
  timelineIndex: number;
  overlayMode?: OverlayMode;
  mapFillMode?: MapFillMode;
  inspectorTab: InspectorTab;
  drawerTab: DrawerTab;
  drawerOpen: boolean;
  drawerHeight: number;
  comparisonScenarioId: string | null;
}

export interface ScenarioExportFile {
  type: 'realpolitik-scenarios';
  version: number;
  exportedAt: string;
  datasetVersion: string;
  scenarios: SavedScenario[];
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

const isScenarioInputs = (value: unknown): value is ScenarioInputs => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sanctionShock === 'number' &&
    typeof v.treatyShift === 'number' &&
    typeof v.electionVolatility === 'number' &&
    typeof v.invasionPressure === 'number' &&
    typeof v.coupRisk === 'number'
  );
};

const isSavedScenario = (value: unknown): value is SavedScenario => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.timelineIndex === 'number' &&
    typeof v.weightSetKey === 'string' &&
    isScenarioInputs(v.inputs)
  );
};

export const downloadScenariosFile = (
  scenarios: SavedScenario[],
  datasetVersion: string,
  filename = `realpolitik-scenarios-${new Date().toISOString().slice(0, 10)}.json`,
): void => {
  const payload: ScenarioExportFile = {
    type: 'realpolitik-scenarios',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    datasetVersion,
    scenarios,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const parseScenariosFile = async (file: File): Promise<SavedScenario[]> => {
  // Validate file size before processing (1MB limit)
  const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File exceeds maximum size of 1MB');
  }

  // Validate file type - only allow JSON files
  if (file.type !== '' && !file.type.startsWith('application/json') && !file.name.toLowerCase().endsWith('.json')) {
    throw new Error('Only JSON files are allowed');
  }

  const text = await file.text();

  // Limit text content size before parsing
  if (text.length > MAX_FILE_SIZE) {
    throw new Error('File content exceeds maximum size of 1MB');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('File is not a scenario export');
  }
  const candidate = parsed as Partial<ScenarioExportFile> & { scenarios?: unknown };
  if (candidate.type !== 'realpolitik-scenarios') {
    throw new Error('File is not a Realpolitik scenario export');
  }
  if (!Array.isArray(candidate.scenarios)) {
    throw new Error('Export file is missing a scenarios array');
  }
  const valid = candidate.scenarios.filter(isSavedScenario);
  if (valid.length === 0) {
    throw new Error('No valid scenarios were found in the file');
  }
  return valid;
};
