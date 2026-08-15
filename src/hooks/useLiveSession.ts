import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countryProfiles } from '../data/countryData';
import { enrichProfiles } from '../data/liveEnrichment';
import { fetchLiveData } from '../data/worldBankClient';
import type { LiveData } from '../data/worldBankClient';
import { fetchBackendState } from '../lib/backendClient';
import type { CountryProfile } from '../types';
import type { LiveDataStatus } from '../components/TopBar';

export type LiveDataDiagnostics = {
  totalIndicators: number;
  succeededIndicators: number;
  failedIndicators: number;
  failedCodes: string[];
  /** Which path produced the values (backend runtime or direct API). */
  source?: 'backend' | 'direct';
  /** Server-side refresh timestamp when the backend path was used. */
  refreshedAt?: string | null;
  /** Newest published observation year across the returned country-level maps. */
  latestObservedYear?: string | null;
};

/** How often to re-poll the backend runtime state. */
const POLL_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Owns live World Bank enrichment: status, diagnostics, and the active profile set
 * (starts as static/pipeline bootstrap, upgrades when a live source returns).
 *
 * Prefers the backend `/api/state` payload; falls back to a direct World Bank
 * fetch when the backend is unavailable (dev server, cold start, outage).
 */
export function useLiveSession() {
  const [activeProfiles, setActiveProfiles] = useState<CountryProfile[]>(countryProfiles);
  const [liveDataStatus, setLiveDataStatus] = useState<LiveDataStatus>('loading');
  const [liveDataDiagnostics, setLiveDataDiagnostics] = useState<LiveDataDiagnostics | null>(null);
  const [liveFetchedAt, setLiveFetchedAt] = useState<string | null>(null);
  const liveFetchRef = useRef<AbortController | null>(null);
  const loadGenerationRef = useRef(0);

  const resolveLiveData = useCallback(
    async (signal: AbortSignal): Promise<LiveData | null> => {
      const fromBackend = await fetchBackendState({ signal });
      if (fromBackend) return fromBackend;
      return fetchLiveData(signal);
    },
    [],
  );

  const loadLiveData = useCallback(() => {
    liveFetchRef.current?.abort();
    const controller = new AbortController();
    liveFetchRef.current = controller;
    const generation = ++loadGenerationRef.current;
    setLiveDataStatus('loading');
    setLiveDataDiagnostics(null);
    resolveLiveData(controller.signal)
      .then((live) => {
        if (generation !== loadGenerationRef.current || controller.signal.aborted) return;
        if (!live) {
          setLiveDataStatus('error');
          return;
        }
        setActiveProfiles(enrichProfiles(countryProfiles, live));
        setLiveDataDiagnostics({
          ...live.diagnostics,
          source: live.source ?? 'direct',
          refreshedAt: live.refreshedAt ?? null,
          latestObservedYear: Object.values(live.indicatorMetadata ?? {})
            .flatMap((metadata) => Object.values(metadata?.observedYears ?? {}))
            .filter((year): year is string => /^\d{4}$/.test(year))
            .sort()
            .at(-1) ?? null,
        });
        setLiveFetchedAt(live.source === 'backend' && live.refreshedAt ? live.refreshedAt : new Date().toISOString());
        if (live.diagnostics.failedIndicators === 0) setLiveDataStatus('live');
        else if (live.diagnostics.succeededIndicators === 0) setLiveDataStatus('error');
        else setLiveDataStatus('partial');
      })
      .catch(() => {
        if (!controller.signal.aborted && generation === loadGenerationRef.current) {
          setLiveDataStatus('error');
        }
      });
  }, [resolveLiveData]);

  useEffect(() => {
    loadLiveData();
    const interval = window.setInterval(loadLiveData, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      liveFetchRef.current?.abort();
      loadGenerationRef.current += 1;
    };
  }, [loadLiveData]);

  const liveIndicatorCoveragePct = useMemo(() => {
    if (!liveDataDiagnostics || liveDataDiagnostics.totalIndicators === 0) return null;
    return Math.round(
      (liveDataDiagnostics.succeededIndicators / liveDataDiagnostics.totalIndicators) * 100,
    );
  }, [liveDataDiagnostics]);

  return {
    activeProfiles,
    /** Static pipeline bootstrap — used as the live-delta reference. */
    staticProfiles: countryProfiles,
    liveDataStatus,
    liveDataDiagnostics,
    liveFetchedAt,
    liveIndicatorCoveragePct,
    loadLiveData,
  };
}
