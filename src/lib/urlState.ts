import type { MapFillMode, OverlayMode } from '../types';

const HASH_PREFIX = '#state=';
const MAX_HASH_LENGTH = 2048;
const MAX_COUNTRY_NAME_LENGTH = 100;

export interface ShareableState {
  selectedCountry: string;
  overlayMode?: OverlayMode;
  mapFillMode?: MapFillMode;
}

const overlayModes: OverlayMode[] = ['none', 'cooperation', 'hostility', 'dependency', 'deterrence'];
const fillModes: MapFillMode[] = [
  'alignment', 'risk', 'confidence', 'gdpPerCapita', 'gdpGrowth', 'inflation', 'tradeOpenness',
  'nuclearArmed', 'militaryBurden', 'regime', 'conflictPressure', 'population', 'medianAge',
  'energyExports', 'demographicPressure', 'cyberCapability', 'internetFreedom', 'foodImportDependence',
  'waterStress', 'debtVulnerability', 'sovereignRating', 'unVotingBlocA', 'unVotingBlocB',
  'criticalMineralIntensity', 'softPower', 'defensePactDensity',
];

const isShareableState = (value: unknown): value is ShareableState => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.selectedCountry === 'string' &&
    v.selectedCountry.length > 0 &&
    v.selectedCountry.length <= MAX_COUNTRY_NAME_LENGTH &&
    (v.overlayMode === undefined || overlayModes.includes(v.overlayMode as OverlayMode)) &&
    (v.mapFillMode === undefined || fillModes.includes(v.mapFillMode as MapFillMode))
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
  // URL fragments are attacker-controlled input. Bound decoding and parsing so
  // a crafted link cannot force a large base64 allocation on page load.
  if (hash.length > MAX_HASH_LENGTH) return null;
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
