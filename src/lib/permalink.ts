import type { ScenarioInputs, WeightSetKey, Filters, OverlayMode } from '../types';

/**
 * Compact URL state for sharing a scenario configuration. Stored as
 * base64url-encoded JSON in `?s=`. Loose typing on the way in, strict
 * normalization on the way out — never trust query strings.
 */
export interface PermalinkState {
  t?: number;            // timelineIndex
  c?: string;            // selectedCountry (mapName)
  w?: WeightSetKey;      // weightSetKey
  i?: ScenarioInputs;    // scenarioInputs
  e?: string[];          // activeEventIds
  o?: OverlayMode;       // overlayMode
  n?: string;            // scenarioName
  f?: Partial<Filters>;  // filters (only non-default keys to keep URL short)
}

const PARAM = 's';

const toB64Url = (raw: string) =>
  btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64Url = (raw: string) => {
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return atob(padded + padding);
};

export function encodePermalink(state: PermalinkState): string {
  return toB64Url(JSON.stringify(state));
}

export function decodePermalink(encoded: string): PermalinkState | null {
  try {
    const parsed = JSON.parse(fromB64Url(encoded));
    return typeof parsed === 'object' && parsed !== null ? (parsed as PermalinkState) : null;
  } catch {
    return null;
  }
}

export function readPermalinkFromLocation(): PermalinkState | null {
  if (typeof window === 'undefined') return null;
  const encoded = new URLSearchParams(window.location.search).get(PARAM);
  return encoded ? decodePermalink(encoded) : null;
}

/** Replace the `?s=` parameter without adding a history entry. */
export function writePermalinkToLocation(state: PermalinkState): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, encodePermalink(state));
  window.history.replaceState(null, '', url.toString());
}

export function clearPermalinkFromLocation(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  window.history.replaceState(null, '', url.toString());
}
