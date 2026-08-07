import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchLiveData } from '../data/worldBankClient';
import { enrichProfiles } from '../data/liveEnrichment';
import type { CountryProfile } from '../types';

type LiveDataStatus = 'loading' | 'live' | 'partial' | 'error';

interface LiveDataDiagnostics {
  totalIndicators: number;
  succeededIndicators: number;
  failedIndicators: number;
  failedCodes: string[];
}

interface UseLiveDataReturn {
  activeProfiles: CountryProfile[];
  liveDataStatus: LiveDataStatus;
  liveDataDiagnostics: LiveDataDiagnostics | null;
  loadLiveData: () => void;
}

export function useLiveData(staticProfiles: CountryProfile[]): UseLiveDataReturn {
  const [activeProfiles, setActiveProfiles] = useState<CountryProfile[]>(staticProfiles);
  const [liveDataStatus, setLiveDataStatus] = useState<LiveDataStatus>('loading');
  const [liveDataDiagnostics, setLiveDataDiagnostics] = useState<LiveDataDiagnostics | null>(null);
  const liveFetchRef = useRef<AbortController | null>(null);

  const loadLiveData = useCallback(() => {
    liveFetchRef.current?.abort();
    const controller = new AbortController();
    liveFetchRef.current = controller;
    setLiveDataStatus('loading');
    setLiveDataDiagnostics(null);
    
    fetchLiveData(controller.signal)
      .then((live) => {
        setActiveProfiles(enrichProfiles(staticProfiles, live));
        setLiveDataDiagnostics(live.diagnostics);
        if (live.diagnostics.failedIndicators === 0) {
          setLiveDataStatus('live');
        } else if (live.diagnostics.succeededIndicators === 0) {
          setLiveDataStatus('error');
        } else {
          setLiveDataStatus('partial');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLiveDataStatus('error');
        }
      });
  }, [staticProfiles]);

  useEffect(() => {
    loadLiveData();
    return () => liveFetchRef.current?.abort();
  }, [loadLiveData]);

  return {
    activeProfiles,
    liveDataStatus,
    liveDataDiagnostics,
    loadLiveData,
  };
}
