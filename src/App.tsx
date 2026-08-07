import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useMapStore } from './store/useMapStore';
import type { ChangeEvent, CSSProperties } from 'react';
import {
  allianceNetworks,
  countryProfiles,
  datasetVersion,
  enhancementReleaseTelemetry,
  ingestTelemetry,
  informationQualityContract,
  informationQualityTelemetry,
  methodologyNotes,
  scenarioTimeline,
} from './data/countryData';
import {
  defaultScenarioInputs,
  getActiveEventsForProfile,
  getScenarioInputsForProfile,
  getSimulationWeightSet,
  simulationWeightSets,
} from './simulation';
import type {
  Alignment,
  Filters,
  SavedScenario,
  ScenarioInputs,
  WeightSetKey,
} from './types';
import { buildInformationQualityTelemetry } from './data/quality/telemetry';
import { eventLibrary, eventById } from './data/eventLibrary';
import {
  downloadScenariosFile,
  parseScenariosFile,
} from './lib/persistence';
import { buildShareableUrl, clearHash, decodeStateFromHash } from './lib/urlState';
import { clampTimelineIndex } from './lib/timeline';
import { loadPersistedState } from './lib/persistence';
import { useSimulation } from './hooks/useSimulation';
import { usePersistedState } from './hooks/usePersistedState';
import { useLiveData } from './hooks/useLiveData';
import { useFilteredCountries } from './hooks/useFilteredCountries';
import { buildEventFeed } from './state/selectors';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { RightInspector } from './components/RightInspector';
import type { InspectorTab, SparklineSeries } from './components/RightInspector';
import { BottomDrawer } from './components/BottomDrawer';
import type { DrawerTab, EventFeedItem } from './components/BottomDrawer';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { UndoToast } from './components/UndoToast';
import { WelcomeGuide } from './components/WelcomeGuide';
import { UI_TIMING, STORAGE_KEYS } from './lib/constants';

// Lazy-load MapCanvas so the world-atlas TopoJSON ships in its own async chunk.
const MapCanvas = lazy(() => import('./components/MapCanvas').then((m) => ({ default: m.MapCanvas })));

const defaultFilters: Filters = {
  allianceNetwork: 'all',
  tradeExposure: 'all',
  militaryTreatyLevel: 'all',
  conflictPressure: 'all',
  sanctionsExposure: 'all',
  regimeType: 'all',
  riskLevel: 'all',
};

const baselineWeightSet = getSimulationWeightSet('baseline');
const weightSetOptions = Object.values(simulationWeightSets);
const TIMELINE_AUTO_PLAY_INTERVAL_MS = UI_TIMING.autoPlayIntervalMs;
const PERSIST_DEBOUNCE_MS = UI_TIMING.persistDebounceMs;
const MIN_DRAWER_HEIGHT = UI_TIMING.minDrawerHeight;
const MAX_DRAWER_HEIGHT_RATIO = UI_TIMING.maxDrawerHeightRatio;
const WELCOME_DISMISSED_KEY = STORAGE_KEYS.welcomeDismissed;
const INTERACTIVE_SHORTCUT_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);
const INTERACTIVE_SHORTCUT_ROLES = new Set(['button', 'textbox', 'link']);

const maxDrawerHeight = () => Math.floor(window.innerHeight * MAX_DRAWER_HEIGHT_RATIO);

const isInteractiveShortcutTarget = (target: EventTarget | null): target is HTMLElement => {
  if (!(target instanceof HTMLElement)) return false;
  if (INTERACTIVE_SHORTCUT_TAGS.has(target.tagName)) return true;
  const role = target.getAttribute('role');
  if (role && INTERACTIVE_SHORTCUT_ROLES.has(role)) return true;
  return target.isContentEditable;
};

/** Ordered list of all `ScenarioInputs` keys — single source of truth for iteration. */
export const scenarioInputKeys: (keyof ScenarioInputs)[] = [
  'sanctionShock',
  'treatyShift',
  'electionVolatility',
  'invasionPressure',
  'coupRisk',
];

const alignmentLabel: Record<Alignment, string> = {
  blocA: 'Bloc A',
  blocB: 'Bloc B',
  nonAligned: 'Non-aligned',
  unstable: 'Contested',
};

const alignmentColor: Record<Alignment, string> = {
  blocA: '#5ea3ff',
  blocB: '#ff6b6b',
  nonAligned: '#ffd166',
  unstable: '#c77dff',
};

const resolveEventIds = (eventIds: string[]) =>
  eventIds.flatMap((id) => {
    const event = eventById.get(id);
    return event ? [event] : [];
  });

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 1080;
const isWelcomeDismissed = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(WELCOME_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

const markWelcomeDismissed = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
  } catch {
    // ignore
  }
};

const persisted = loadPersistedState();
// URL hash beats persistence so shared links always reflect the link payload.
const fromHash = decodeStateFromHash();
if (fromHash) clearHash();

export default function App() {
  const [search, setSearch] = useState('');
  const selectedCountry = useMapStore((state) => state.selectedCountry);
  const setSelectedCountry = useMapStore((state) => state.setSelectedCountry);
  const filters = useMapStore((state) => state.activeFilters);
  const setFilters = useMapStore((state) => state.setActiveFilters);
  
  // Use custom hooks for persisted state, live data, and filtered countries
  const [persistedState, persistedActions] = usePersistedState({});
  const { activeProfiles, liveDataStatus, liveDataDiagnostics, loadLiveData } = useLiveData(countryProfiles);
  
  // Extract timeline management
  const { timelineIndex, isPlaying, handleTimelineChange, handleTogglePlay } = useTimeline({
    totalPeriods: scenarioTimeline.length,
    initialIndex: persistedState.timelineIndex,
  });
  
  // Sync map store with persisted state on mount
  useEffect(() => {
    useMapStore.setState({
      currentYear: persistedState.timelineIndex,
      activeFilters: persistedState.filters,
      selectedCountry: persistedState.selectedCountry,
    });
  }, []);
  
  // Destructure persisted state and actions
  const {
    scenarioName,
    scenarioInputs,
    weightSetKey,
    activeEventIds,
    savedScenarios,
    comparisonScenarioId,
    inspectorTab,
    drawerTab,
    drawerOpen,
    drawerHeight,
  } = persistedState;
  
  const {
    setScenarioName,
    setScenarioInputs,
    setWeightSetKey,
    setActiveEventIds,
    setSavedScenarios,
    setComparisonScenarioId,
    setInspectorTab,
    setDrawerTab,
    setDrawerOpen,
    setDrawerHeight,
  } = persistedActions;
  
  const [helpOpen, setHelpOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() => !isWelcomeDismissed());
  const [importError, setImportError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [pendingDelete, setPendingDelete] = useState<SavedScenario | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shareResetRef = useRef<number | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);
  
  // Defer heavy simulation re-runs so UI (sliders, timeline) stays responsive while
  // the map catches up asynchronously via React's concurrent scheduler.
  const deferredScenarioInputs = useDeferredValue(scenarioInputs);
  const deferredWeightSetKey = useDeferredValue(weightSetKey);
  const deferredActiveEventIds = useDeferredValue(activeEventIds);

  // Merge manual slider values with the accumulated deltas from active events.
  const activeEvents = useMemo(() => resolveEventIds(deferredActiveEventIds), [deferredActiveEventIds]);

  const [leftOpen, setLeftOpen] = useState<boolean>(() => !isMobile());
  const [rightOpen, setRightOpen] = useState<boolean>(() => !isMobile());

  const runtimeInformationQuality = useMemo(
    () =>
      buildInformationQualityTelemetry(activeProfiles, {
        layer: 'runtime-live',
        staticReferenceAverageScore: informationQualityTelemetry.averageInformationScore,
      }),
    [activeProfiles],
  );

  // Dragging the top edge of the bottom drawer resizes it.
  const handleDrawerResizeStart = useCallback((startClientY: number) => {
    const startH = drawerHeight;
    const onMove = (event: MouseEvent) => {
      const delta = startClientY - event.clientY;
      setDrawerHeight(Math.max(MIN_DRAWER_HEIGHT, Math.min(maxDrawerHeight(), startH + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [drawerHeight]);

  const handleDrawerResizeStep = useCallback((delta: number) => {
    setDrawerHeight((h) => Math.max(MIN_DRAWER_HEIGHT, Math.min(maxDrawerHeight(), h + delta)));
  }, []);

  const handleDrawerResizeTo = useCallback((edge: 'min' | 'max') => {
    setDrawerHeight(edge === 'min' ? MIN_DRAWER_HEIGHT : maxDrawerHeight());
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isInteractiveShortcutTarget(event.target)) {
        return;
      }
      if (event.key === '[') setLeftOpen((value) => !value);
      if (event.key === ']') setRightOpen((value) => !value);
      if (event.key === '\\') setDrawerOpen((value) => !value);
      if (event.key === ' ') {
        event.preventDefault();
        handleTogglePlay();
      }
      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (event.key === '?') {
        event.preventDefault();
        setHelpOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeWeightSet = useMemo(() => getSimulationWeightSet(deferredWeightSetKey), [deferredWeightSetKey]);
  const setSimulationPayload = useMapStore((state) => state.setSimulationPayload);

  useEffect(() => {
    setSimulationPayload({
      profiles: activeProfiles,
      scenarioInputs: deferredScenarioInputs,
      activeEvents,
      weightSetKey: deferredWeightSetKey,
    });
  }, [activeEvents, activeProfiles, deferredScenarioInputs, deferredWeightSetKey, setSimulationPayload]);

  const {
    simulated,
    baselineSimulated,
    selected,
    baselineSelected,
    selectedRiskDelta,
    selectedConfidenceDelta,
    sparkline: selectedSparkline,
  } = useSimulation(
    activeProfiles,
    activeEvents,
    deferredScenarioInputs,
    deferredWeightSetKey,
    selectedCountry,
    timelineIndex,
    scenarioTimeline,
    alignmentColor,
    alignmentLabel,
  );

  const byName = useMemo(
    () => new Map(simulated.map((entry) => [entry.profile.mapName, entry])),
    [simulated],
  );
  const baselineByName = useMemo(
    () => new Map(baselineSimulated.map((entry) => [entry.profile.mapName, entry])),
    [baselineSimulated],
  );
  const selectedProfile = useMemo(
    () => activeProfiles.find((profile) => profile.mapName === selectedCountry) ?? activeProfiles[0] ?? null,
    [activeProfiles, selectedCountry],
  );

  const filtered = useMemo(() => filterCountries(simulated, filters), [filters, simulated]);

  const visibleNames = useMemo(() => buildVisibleNames(filtered), [filtered]);

  const railCountries = useMemo(() => searchCountries(filtered, search), [filtered, search]);

  if (!selected || !baselineSelected) {
    return <div className="app-shell" role="status" aria-live="polite" aria-busy="true" aria-label="Loading simulation data">Loading simulation...</div>;
  }

  const selectedActiveEvents = useMemo(
    () => getActiveEventsForProfile(selected.profile, activeEvents),
    [activeEvents, selected.profile],
  );
  const selectedScenarioInputs = useMemo(
    () => getScenarioInputsForProfile(deferredScenarioInputs, activeEvents, selected.profile),
    [activeEvents, deferredScenarioInputs, selected.profile],
  );

  const eventFeed = useMemo<EventFeedItem[]>(
    () =>
      buildEventFeed({
        filtered,
        baselineByName,
        scenarioTimeline,
        timelineIndex,
        alignmentLabel,
      }),
    [alignmentLabel, baselineByName, filtered, timelineIndex],
  );

  // Optional comparison track.
  const comparisonScenario = useMemo(
    () => savedScenarios.find((scenario) => scenario.id === comparisonScenarioId) ?? null,
    [comparisonScenarioId, savedScenarios],
  );

  // Cheap single-country comparison for the inspector — avoids simulating all 134 countries
  // just to display the selected country's delta in the inspector panels.
  const comparisonSelected = useMemo<SimulatedCountry | null>(() => {
    if (!comparisonScenario) return null;
    const profile = selectedProfile;
    if (!profile) return null;
    const comparisonEvents = resolveEventIds(comparisonScenario.activeEventIds ?? []);
    const compWeights = getSimulationWeightSet(comparisonScenario.weightSetKey);
    return simulateCountry(profile, comparisonScenario.timelineIndex, {
      scenarioInputs: comparisonScenario.inputs,
      activeEvents: comparisonEvents,
      weightSet: compWeights,
    });
  }, [comparisonScenario, selectedProfile]);

  // Full comparison map — only built when the movers tab is visible and a comparison
  // scenario is active. Simulating all 134 countries is deferred until actually needed.
  const comparisonSimulated = useMemo<SimulatedCountry[]>(() => {
    if (!comparisonScenario || drawerTab !== 'movers') return [];
    const comparisonEvents = resolveEventIds(comparisonScenario.activeEventIds ?? []);
    const compWeights = getSimulationWeightSet(comparisonScenario.weightSetKey);
    return activeProfiles.map((profile) =>
      simulateCountry(profile, comparisonScenario.timelineIndex, {
        scenarioInputs: comparisonScenario.inputs,
        activeEvents: comparisonEvents,
        weightSet: compWeights,
      }),
    );
  }, [activeProfiles, comparisonScenario, drawerTab]);

  const comparisonByName = useMemo(() => {
    if (comparisonSimulated.length === 0) return null;
    return new Map(comparisonSimulated.map((entry) => [entry.profile.mapName, entry]));
  }, [comparisonSimulated]);

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
          timelineIndex,
          weightSetKey,
          inputs: { ...scenarioInputs },
          activeEventIds: [...activeEventIds],
          savedAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 12),
    );
  }, [activeEventIds, savedScenarios.length, scenarioInputs, scenarioName, timelineIndex, weightSetKey]);

  const loadScenario = useCallback((scenario: SavedScenario) => {
    setScenarioName(scenario.name);
    setScenarioInputs({ ...scenario.inputs });
    setWeightSetKey(scenario.weightSetKey);
    persistedActions.setTimelineIndex(clampIndex(scenario.timelineIndex));
    setActiveEventIds(scenario.activeEventIds ?? []);
  }, [persistedActions]);

  const deleteScenario = useCallback((id: string) => {
    setSavedScenarios((current) => {
      const target = current.find((scenario) => scenario.id === id);
      if (target) {
        if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current);
        // The undo toast itself dismisses after 6s and clears pendingDelete.
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

  const exportScenarios = useCallback((id?: string) => {
    const target = id
      ? savedScenarios.filter((scenario) => scenario.id === id)
      : savedScenarios;
    if (target.length === 0) return;
    const filename = id
      ? `realpolitik-scenario-${target[0].name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'scenario'}.json`
      : undefined;
    downloadScenariosFile(target, datasetVersion, filename);
  }, [savedScenarios]);

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

  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false);
    markWelcomeDismissed();
  }, []);

  const handleWelcomeFocusSearch = useCallback(() => {
    setLeftOpen(true);
    closeWelcome();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [closeWelcome]);

  const handleWelcomeOpenScenario = useCallback(() => {
    setDrawerOpen(true);
    setDrawerTab('analysis');
    closeWelcome();
  }, [closeWelcome]);

  const handleWelcomeOpenShortcuts = useCallback(() => {
    setHelpOpen(true);
    closeWelcome();
  }, [closeWelcome]);

  const shareCurrentScenario = useCallback(async () => {
    const url = buildShareableUrl({
      scenarioName,
      scenarioInputs,
      weightSetKey,
      activeEventIds,
      timelineIndex,
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
  }, [activeEventIds, scenarioInputs, scenarioName, selectedCountry, timelineIndex, weightSetKey]);

  const handleSelectCountryFromMovers = useCallback(
    (mapName: string) => {
      if (byName.has(mapName)) setSelectedCountry(mapName);
    },
    [byName],
  );

  const handleSelectFromInspector = useCallback((mapName: string) => {
    if (byName.has(mapName)) setSelectedCountry(mapName);
  }, [byName, setSelectedCountry]);

  /** Selecting a country from the map also ensures the right panel is open and shows the overview. */
  const handleSelectFromMap = useCallback(
    (mapName: string) => {
      setSelectedCountry(mapName);
      setRightOpen(true);
      setInspectorTab('stats');
    },
    [],
  );

  const totalCountries = activeProfiles.length;
  const shellStyle = useMemo(() => ({ '--drawer-h': `${drawerHeight}px` } as CSSProperties), [drawerHeight]);
  const handleTimelineChange = useCallback((index: number) => {
    setIsPlaying(false);
    setTimelineIndex(clampIndex(index));
  }, []);
  const handleToggleLeft = useCallback(() => setLeftOpen((value) => !value), []);
  const handleToggleRight = useCallback(() => setRightOpen((value) => !value), []);
  const handleToggleDrawer = useCallback(() => setDrawerOpen((value) => !value), []);
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);
  const handleToggleHelp = useCallback(() => setHelpOpen((value) => !value), []);
  const handleCloseHelp = useCallback(() => setHelpOpen(false), []);
  const handleClearSearch = useCallback(() => setSearch(''), []);
  const handleResetFilters = useCallback(() => setFilters(defaultFilters), [setFilters]);
  const selectedActiveEventNames = useMemo(
    () => selectedActiveEvents.map((event) => event.name),
    [selectedActiveEvents],
  );
  const moversProps = useMemo(
    () => ({
      active: simulated,
      baselineByName,
      comparisonByName,
      comparisonScenarioName: comparisonScenario?.name ?? null,
      onSelectCountry: handleSelectCountryFromMovers,
      alignmentColor,
      alignmentLabel,
    }),
    [baselineByName, comparisonByName, comparisonScenario?.name, handleSelectCountryFromMovers, simulated],
  );

  // Persist UI + scenarios to localStorage with a 300 ms debounce so rapid
  // slider drags or typing do not hammer the storage layer on every frame.
  useEffect(() => {
    const snapshot = {
      selectedCountry,
      scenarioName,
      scenarioInputs,
      weightSetKey,
      activeEventIds,
      savedScenarios,
      filters,
      timelineIndex,
      inspectorTab,
      drawerTab,
      drawerOpen,
      drawerHeight,
      comparisonScenarioId,
    };
    if (persistDebounceRef.current) window.clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = window.setTimeout(() => savePersistedState(snapshot), PERSIST_DEBOUNCE_MS);
  }, [
    selectedCountry,
    scenarioName,
    scenarioInputs,
    weightSetKey,
    activeEventIds,
    savedScenarios,
    filters,
    timelineIndex,
    inspectorTab,
    drawerTab,
    drawerOpen,
    drawerHeight,
    comparisonScenarioId,
  ]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (shareResetRef.current) window.clearTimeout(shareResetRef.current);
      if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current);
      if (persistDebounceRef.current) window.clearTimeout(persistDebounceRef.current);
      useMapStore.destroy();
    };
  }, []);

  return (
    <ErrorBoundary>
      <div
        className="shell"
        data-left-open={leftOpen}
        data-right-open={rightOpen}
        data-drawer-open={drawerOpen}
        style={shellStyle}
      >
      <TopBar
        timelineIndex={timelineIndex}
        timeline={scenarioTimeline}
        onTimelineChange={handleTimelineChange}
        scenarioName={scenarioName}
        datasetVersion={datasetVersion}
        countryCount={totalCountries}
        liveDataStatus={liveDataStatus}
        liveDataDiagnostics={liveDataDiagnostics}
        onRetryLiveData={loadLiveData}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        drawerOpen={drawerOpen}
        helpOpen={helpOpen}
        onToggleLeft={handleToggleLeft}
        onToggleRight={handleToggleRight}
        onToggleDrawer={handleToggleDrawer}
        onToggleHelp={handleToggleHelp}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        activeEventCount={activeEventIds.length}
      />

      <LeftRail
        open={leftOpen}
        search={search}
        onSearchChange={setSearch}
        countries={railCountries}
        totalCount={totalCountries}
        selectedName={selectedCountry}
        onSelect={setSelectedCountry}
        filters={filters}
        onFiltersChange={setFilters}
        onClearSearch={handleClearSearch}
        onResetFilters={handleResetFilters}
        alliances={allianceNetworks}
        alignmentColor={alignmentColor}
        alignmentLabel={alignmentLabel}
        searchInputRef={searchInputRef}
      />

      <Suspense fallback={<div className="map map-fallback" aria-busy>Loading map…</div>}>
        <MapCanvas
          byName={byName}
          baselineByName={baselineByName}
          visibleNames={visibleNames}
          selectedName={selectedCountry}
          onSelect={handleSelectFromMap}
          initialOverlayMode={persisted?.overlayMode}
          initialFillMode={persisted?.mapFillMode}
          alignmentColor={alignmentColor}
          alignmentLabel={alignmentLabel}
        />
      </Suspense>

      <RightInspector
        open={rightOpen}
        selected={selected}
        baselineSelected={baselineSelected}
        riskDelta={selectedRiskDelta}
        confidenceDelta={selectedConfidenceDelta}
        scenarioName={scenarioName}
        scenarioInputs={selectedScenarioInputs}
        activeWeightSet={activeWeightSet}
        activeEventNames={selectedActiveEventNames}
        alignmentColor={alignmentColor}
        alignmentLabel={alignmentLabel}
        tab={inspectorTab}
        onTabChange={setInspectorTab}
        onSelectRelated={handleSelectFromInspector}
        comparisonSelected={comparisonSelected}
        comparisonScenarioName={comparisonScenario?.name ?? null}
        onClearComparison={clearComparison}
        sparkline={selectedSparkline}
        allCountries={simulated}
      />

      <BottomDrawer
        open={drawerOpen}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={handleCloseDrawer}
        scenarioName={scenarioName}
        onScenarioNameChange={setScenarioName}
        scenarioInputs={scenarioInputs}
        onScenarioInputChange={handleScenarioInputChange}
        activeWeightSet={activeWeightSet}
        weightSetKey={weightSetKey}
        onWeightSetChange={setWeightSetKey}
        weightSets={weightSetOptions}
        savedScenarios={savedScenarios}
        onSaveScenario={saveScenario}
        onResetScenario={resetScenario}
        onShareScenario={shareCurrentScenario}
        shareStatus={shareStatus}
        onLoadScenario={loadScenario}
        onDeleteScenario={deleteScenario}
        onRenameScenario={renameScenario}
        onExportScenarios={exportScenarios}
        onImportScenarios={handleImportClick}
        importError={importError}
        comparisonScenarioId={comparisonScenarioId}
        onToggleComparison={toggleComparison}
        eventFeed={eventFeed}
        methodologyNotes={methodologyNotes}
        informationQuality={runtimeInformationQuality}
        baselineInformationQuality={informationQualityTelemetry}
        informationQualityContract={informationQualityContract}
        ingestTelemetry={ingestTelemetry}
        enhancementReleaseTelemetry={enhancementReleaseTelemetry}
        liveDataDiagnostics={liveDataDiagnostics}
        scenarioTimeline={scenarioTimeline}
        events={eventLibrary}
        activeEventIds={activeEventIds}
        onApplyEvent={applyEvent}
        onRemoveEvent={removeEvent}
        onApplyEvents={applyEvents}
        onClearAllEvents={clearAllEvents}
        onResizeStart={handleDrawerResizeStart}
        onResizeStep={handleDrawerResizeStep}
        onResizeTo={handleDrawerResizeTo}
        movers={moversProps}
        indexCountries={railCountries}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleImportChange}
      />

      <ShortcutsHelp open={helpOpen} onClose={handleCloseHelp} />
      <WelcomeGuide
        open={welcomeOpen}
        onClose={closeWelcome}
        onFocusSearch={handleWelcomeFocusSearch}
        onOpenScenarioLab={handleWelcomeOpenScenario}
        onOpenShortcuts={handleWelcomeOpenShortcuts}
      />

      {pendingDelete && (
        <UndoToast
          message={`Deleted “${pendingDelete.name}”`}
          durationMs={6000}
          onUndo={restoreDeleted}
          onDismiss={dismissPendingDelete}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}
