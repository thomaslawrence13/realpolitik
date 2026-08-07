import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countryProfiles } from '../data/countryData';
import { enrichProfiles } from '../data/liveEnrichment';
import { fetchLiveData } from '../data/worldBankClient';
import type { CountryProfile } from '../types';
import type { LiveDataStatus } from '../components/TopBar';

export type LiveDataDiagnostics = {
  totalIndicators: number;
  succeededIndicators: number;
  failedIndicators: number;
  failedCodes: string[];
};

/**
 * Owns World Bank live enrichment: status, diagnostics, and the active profile set
 * (starts as static/pipeline bootstrap, upgrades when the API returns).
 */
export function useLiveSession() {
  const [activeProfiles, setActiveProfiles] = useState<CountryProfile[]>(countryProfiles);
  const [liveDataStatus, setLiveDataStatus] = useState<LiveDataStatus>('loading');
  const [liveDataDiagnostics, setLiveDataDiagnostics] = useState<LiveDataDiagnostics | null>(null);
  const [liveFetchedAt, setLiveFetchedAt] = useState<string | null>(null);
  const liveFetchRef = useRef<AbortController | null>(null);

  const loadLiveData = useCallback(() => {
    liveFetchRef.current?.abort();
    const controller = new AbortController();
    liveFetchRef.current = controller;
    setLiveDataStatus('loading');
    setLiveDataDiagnostics(null);
    fetchLiveData(controller.signal)
      .then((live) => {
        setActiveProfiles(enrichProfiles(countryProfiles, live));
        setLiveDataDiagnostics(live.diagnostics);
        setLiveFetchedAt(new Date().toISOString());
        if (live.diagnostics.failedIndicators === 0) setLiveDataStatus('live');
        else if (live.diagnostics.succeededIndicators === 0) setLiveDataStatus('error');
        else setLiveDataStatus('partial');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLiveDataStatus('error');
      });
  }, []);

  useEffect(() => {
    loadLiveData();
    return () => liveFetchRef.current?.abort();
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
