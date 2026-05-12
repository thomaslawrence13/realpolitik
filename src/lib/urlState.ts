import type { ScenarioInputs, WeightSetKey } from '../types';

const HASH_PREFIX = '#scenario=';

export interface ShareableState {
  scenarioName: string;
  scenarioInputs: ScenarioInputs;
  weightSetKey: WeightSetKey;
  activeEventIds: string[];
  timelineIndex: number;
  selectedCountry: string;
}

const isShareableState = (value: unknown): value is ShareableState => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.scenarioName !== 'string') return false;
  if (typeof v.weightSetKey !== 'string') return false;
  if (typeof v.timelineIndex !== 'number') return false;
  if (typeof v.selectedCountry !== 'string') return false;
  if (!Array.isArray(v.activeEventIds)) return false;
  if (!v.scenarioInputs || typeof v.scenarioInputs !== 'object') return false;
  const inputs = v.scenarioInputs as Record<string, unknown>;
  return (
    typeof inputs.sanctionShock === 'number' &&
    typeof inputs.treatyShift === 'number' &&
    typeof inputs.electionVolatility === 'number' &&
    typeof inputs.invasionPressure === 'number' &&
    typeof inputs.coupRisk === 'number'
  );
};

const toBase64 = (value: string): string => {
  if (typeof window === 'undefined') return '';
  const bytes = new TextEncoder().encode(value);
  // String.fromCharCode.apply is O(n) vs the O(n²) char-by-char concat.
  const binary = String.fromCharCode(...bytes);
  return window.btoa(binary).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const fromBase64 = (value: string): string => {
  if (typeof window === 'undefined') return '';
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeStateToHash = (state: ShareableState): string => {
  return `${HASH_PREFIX}${toBase64(JSON.stringify(state))}`;
};

export const decodeStateFromHash = (): ShareableState | null => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const raw = hash.slice(HASH_PREFIX.length);
  try {
    const json = fromBase64(decodeURIComponent(raw));
    const parsed = JSON.parse(json);
    return isShareableState(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const buildShareableUrl = (state: ShareableState): string => {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${base}${encodeStateToHash(state)}`;
};

export const clearHash = (): void => {
  if (typeof window === 'undefined') return;
  if (window.location.hash) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
};
