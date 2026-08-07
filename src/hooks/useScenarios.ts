import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { datasetVersion } from '../data/countryData';
import {
  downloadScenariosFile,
  parseScenariosFile,
} from '../lib/persistence';
import { buildShareableUrl } from '../lib/urlState';
import { defaultScenarioInputs } from '../simulation';
import type { SavedScenario, ScenarioInputs, WeightSetKey } from '../types';

type Seed = {
  scenarioName?: string;
  scenarioInputs?: ScenarioInputs;
  weightSetKey?: WeightSetKey;
  savedScenarios?: SavedScenario[];
  activeEventIds?: string[];
  comparisonScenarioId?: string | null;
};

/**
 * What-if scenario lab state: shocks, events, saved scenarios, share/import/export.
 * Scenarios always apply to the present snapshot (no timeline scrubbing).
 */
export function useScenarios(seed: Seed, presentIndex: number, selectedCountry: string) {
  const [scenarioName, setScenarioName] = useState(seed.scenarioName ?? 'Baseline+');
  const [scenarioInputs, setScenarioInputs] = useState<ScenarioInputs>(
    seed.scenarioInputs ?? { ...defaultScenarioInputs },
  );
  const [weightSetKey, setWeightSetKey] = useState<WeightSetKey>(seed.weightSetKey ?? 'baseline');
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(seed.savedScenarios ?? []);
  const [activeEventIds, setActiveEventIds] = useState<string[]>(seed.activeEventIds ?? []);
  const [comparisonScenarioId, setComparisonScenarioId] = useState<string | null>(
    seed.comparisonScenarioId ?? null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [pendingDelete, setPendingDelete] = useState<SavedScenario | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shareResetRef = useRef<number | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);

  const handleScenarioInputChange = useCallback(<K extends keyof ScenarioInputs>(key: K, value: number) => {
    setScenarioInputs((current) => ({ ...current, [key]: value }));
  }, []);

  const applyEvent = useCallback((id: string) => {
    setActiveEventIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const removeEvent = useCallback((id: string) => {
    setActiveEventIds((current) => current.filter((activeId) => activeId !== id));
  }, []);

  const applyEvents = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setActiveEventIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));
      return [...next];
    });
  }, []);

  const clearAllEvents = useCallback(() => {
    setActiveEventIds([]);
  }, []);

  const resetScenario = useCallback(() => {
    setScenarioName('Baseline+');
    setScenarioInputs({ ...defaultScenarioInputs });
    setWeightSetKey('baseline');
    setActiveEventIds([]);
  }, []);

  const saveScenario = useCallback(() => {
    const name = scenarioName.trim() || `Scenario ${savedScenarios.length + 1}`;
    setSavedScenarios((current) =>
      [
        {
          id: `${Date.now()}`,
          name,
          timelineIndex: presentIndex,
          weightSetKey,
          inputs: { ...scenarioInputs },
          activeEventIds: [...activeEventIds],
          savedAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 12),
    );
  }, [activeEventIds, savedScenarios.length, scenarioInputs, scenarioName, presentIndex, weightSetKey]);

  const loadScenario = useCallback((scenario: SavedScenario) => {
    setScenarioName(scenario.name);
    setScenarioInputs({ ...scenario.inputs });
    setWeightSetKey(scenario.weightSetKey);
    setActiveEventIds(scenario.activeEventIds ?? []);
  }, []);

  const deleteScenario = useCallback((id: string) => {
    setSavedScenarios((current) => {
      const target = current.find((scenario) => scenario.id === id);
      if (target) {
        if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current);
        setPendingDelete(target);
      }
      return current.filter((scenario) => scenario.id !== id);
    });
    setComparisonScenarioId((current) => (current === id ? null : current));
  }, []);

  const restoreDeleted = useCallback(() => {
    setPendingDelete((current) => {
      if (!current) return null;
      setSavedScenarios((scenarios) =>
        scenarios.some((scenario) => scenario.id === current.id)
          ? scenarios
          : [current, ...scenarios].slice(0, 24),
      );
      return null;
    });
  }, []);

  const dismissPendingDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const renameScenario = useCallback((id: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    setSavedScenarios((current) =>
      current.map((scenario) => (scenario.id === id ? { ...scenario, name: trimmed } : scenario)),
    );
  }, []);

  const exportScenarios = useCallback(
    (id?: string) => {
      const target = id ? savedScenarios.filter((scenario) => scenario.id === id) : savedScenarios;
      if (target.length === 0) return;
      const filename = id
        ? `realpolitik-scenario-${target[0]!.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'scenario'}.json`
        : undefined;
      downloadScenariosFile(target, datasetVersion, filename);
    },
    [savedScenarios],
  );

  const handleImportClick = useCallback(() => {
    setImportError(null);
    fileInputRef.current?.click();
  }, []);

  const handleImportChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const incoming = await parseScenariosFile(file);
      setSavedScenarios((current) => {
        const existingIds = new Set(current.map((scenario) => scenario.id));
        const reidentified = incoming.map((scenario) =>
          existingIds.has(scenario.id)
            ? { ...scenario, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
            : scenario,
        );
        return [...reidentified, ...current].slice(0, 24);
      });
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read file');
    }
  }, []);

  const toggleComparison = useCallback((id: string) => {
    setComparisonScenarioId((current) => (current === id ? null : id));
  }, []);

  const clearComparison = useCallback(() => setComparisonScenarioId(null), []);

  const shareCurrentScenario = useCallback(async () => {
    const url = buildShareableUrl({
      scenarioName,
      scenarioInputs,
      weightSetKey,
      activeEventIds,
      timelineIndex: presentIndex,
      selectedCountry,
    });
    if (shareResetRef.current) window.clearTimeout(shareResetRef.current);
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('copied');
    } catch {
      setShareStatus('error');
    }
    shareResetRef.current = window.setTimeout(() => setShareStatus('idle'), 1800);
  }, [activeEventIds, scenarioInputs, scenarioName, selectedCountry, presentIndex, weightSetKey]);

  const disposeTimers = useCallback(() => {
    if (shareResetRef.current) window.clearTimeout(shareResetRef.current);
    if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current);
  }, []);

  return {
    scenarioName,
    setScenarioName,
    scenarioInputs,
    weightSetKey,
    setWeightSetKey,
    savedScenarios,
    activeEventIds,
    comparisonScenarioId,
    importError,
    shareStatus,
    pendingDelete,
    fileInputRef,
    handleScenarioInputChange,
    applyEvent,
    removeEvent,
    applyEvents,
    clearAllEvents,
    resetScenario,
    saveScenario,
    loadScenario,
    deleteScenario,
    restoreDeleted,
    dismissPendingDelete,
    renameScenario,
    exportScenarios,
    handleImportClick,
    handleImportChange,
    toggleComparison,
    clearComparison,
    shareCurrentScenario,
    disposeTimers,
  };
}
