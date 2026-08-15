/**
 * Backend runtime client (`/api/state`).
 *
 * The Cloudflare Worker serves a KV-backed World Bank state payload on the
 * same origin. Every call prefers the backend; on any failure (cold start,
 * 404 in dev, network error, timeout) the caller falls back to a direct World
 * Bank fetch. This module is DOM-free so it can also run in unit tests.
 */

import { WB_INDICATORS, type IndicatorValues, type WbIndicatorCode } from './worldBankFetch';
import type { LiveData, LiveIndicatorMetadata } from '../data/worldBankClient';

export interface BackendStateDiagnostics {
  totalIndicators: number;
  succeededIndicators: number;
  failedIndicators: number;
  failedCodes: WbIndicatorCode[];
}

export interface BackendStatePayload {
  schema: 1;
  refreshedAt: string | null;
  source: 'world-bank-open-data';
  indicators: Partial<Record<WbIndicatorCode, {
    latestYear: string | null;
    /** New payloads carry country-level years; older KV payloads may omit this. */
    observedYears?: Record<string, string>;
    retrievedAt?: string | null;
    values: IndicatorValues;
  }>>;
  diagnostics: BackendStateDiagnostics;
}

/**
 * Convert the backend payload into the frontend `LiveData` shape.
 * Returns null when the payload is unusable (cold start with zero coverage),
 * so callers can fall back to a direct fetch.
 */
export const backendPayloadToLiveData = (payload: BackendStatePayload | null | undefined): LiveData | null => {
  if (!payload || payload.schema !== 1) return null;

  // A pre-catalog KV payload is valid JSON but cannot provide the expanded
  // GDP fields. Force the browser down the direct API path until the Worker
  // has written a payload produced by the current indicator catalog.
  if (
    !payload.diagnostics ||
    typeof payload.diagnostics.totalIndicators !== 'number' ||
    payload.diagnostics.totalIndicators < WB_INDICATORS.length
  ) return null;

  const indicators = payload.indicators ?? {};
  const codeValues = (code: WbIndicatorCode): IndicatorValues => indicators[code]?.values ?? {};
  const hasAnyValues = Object.values(indicators).some(
    (bucket) =>
      bucket &&
      Object.values(bucket.values ?? {}).some(
        (value) => typeof value === 'number' && Number.isFinite(value),
      ),
  );
  if (!hasAnyValues) return null;

  const indicatorMetadata: Partial<Record<typeof WB_INDICATORS[number]['key'], LiveIndicatorMetadata>> = {};
  for (const def of WB_INDICATORS) {
    const bucket = indicators[def.code];
    if (!bucket) continue;
    const values = bucket.values ?? {};
    // Legacy payloads only exposed a global year. Keep them usable while new
    // worker payloads provide the country-level selection explicitly.
    const observedYears = bucket.observedYears ?? (
      bucket.latestYear
        ? Object.fromEntries(Object.keys(values).map((iso) => [iso, bucket.latestYear!]))
        : {}
    );
    indicatorMetadata[def.key] = {
      latestYear: bucket.latestYear ?? null,
      observedYears,
      retrievedAt: bucket.retrievedAt ?? payload.refreshedAt,
    };
  }

  const diagnostics = payload.diagnostics ?? {
    totalIndicators: WB_INDICATORS.length,
    succeededIndicators: 0,
    failedIndicators: WB_INDICATORS.length,
    failedCodes: [],
  };

  return {
    militaryExpPct: codeValues('MS.MIL.XPND.GD.ZS'),
    militaryExpUsd: codeValues('MS.MIL.XPND.CD'),
    tradePct: codeValues('TG.VAL.TOTL.GD.ZS'),
    gdpGrowth: codeValues('NY.GDP.MKTP.KD.ZG'),
    gdpNominalUsd: codeValues('NY.GDP.MKTP.CD'),
    gdpPerCapitaUsd: codeValues('NY.GDP.PCAP.CD'),
    inflation: codeValues('FP.CPI.TOTL.ZG'),
    politicalStability: codeValues('PV.EST'),
    ruleOfLaw: codeValues('RL.EST'),
    unemployment: codeValues('SL.UEM.TOTL.ZS'),
    source: 'backend',
    refreshedAt: payload.refreshedAt,
    indicatorMetadata,
    diagnostics: {
      totalIndicators: diagnostics.totalIndicators,
      succeededIndicators: diagnostics.succeededIndicators,
      failedIndicators: diagnostics.failedIndicators,
      failedCodes: diagnostics.failedCodes,
    },
  };
};

export const fetchBackendState = async ({
  signal,
  timeoutMs = 8000,
}: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<LiveData | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', forwardAbort);

  try {
    const response = await fetch('/api/state', {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as BackendStatePayload;
    return backendPayloadToLiveData(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
};
