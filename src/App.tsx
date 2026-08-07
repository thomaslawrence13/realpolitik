import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { useMapStore } from './store/useMapStore';
import {
  allianceNetworks,
  datasetVersion,
  enhancementReleaseTelemetry,
  ingestTelemetry,
  informationQualityContract,
  informationQualityTelemetry,
  methodologyNotes,
  scenarioTimeline,
} from './data/countryData';
import {
  getActiveEventsForProfile,
  getScenarioInputsForProfile,
  getSimulationWeightSet,
  simulateCountry,
  simulationWeightSets,
} from './simulation';
import type { Alignment, Filters, ScenarioInputs, SimulatedCountry } from './types';
import { buildInformationQualityTelemetry } from './data/quality/telemetry';
import { eventLibrary, eventById } from './data/eventLibrary';
import { loadPersistedState, savePersistedState } from './lib/persistence';
import { clearHash, decodeStateFromHash } from './lib/urlState';
import { useSimulation } from './hooks/useSimulation';
import { useLiveSession } from './hooks/useLiveSession';
import { useAppChrome } from './hooks/useAppChrome';
import { useScenarios } from './hooks/useScenarios';
import {
  buildEventFeed,
  buildVisibleNames,
  filterCountries,
  searchCountries,
} from './state/selectors';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { RightInspector } from './components/RightInspector';
import { BottomDrawer } from './components/BottomDrawer';
import type { EventFeedItem } from './components/BottomDrawer';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { UndoToast } from './components/UndoToast';
import { WelcomeGuide } from './components/WelcomeGuide';
import { UI_TIMING } from './lib/constants';
import { buildGlobalLiveSummary } from './lib/globalStats';

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

const weightSetOptions = Object.values(simulationWeightSets);
const PERSIST_DEBOUNCE_MS = UI_TIMING.persistDebounceMs;

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
  blocA: '#5eb0ff',
  blocB: '#ff7a7a',
  nonAligned: '#ffd56a',
  unstable: '#d08cff',
};

const resolveEventIds = (eventIds: string[]) =>
  eventIds.flatMap((id) => {
    const event = eventById.get(id);
    return event ? [event] : [];
  });

const persisted = loadPersistedState();
const fromHash = decodeStateFromHash();
if (fromHash) clearHash();

export default function App() {
  const selectedCountry = useMapStore((state) => state.selectedCountry);
  const setSelectedCountry = useMapStore((state) => state.setSelectedCountry);
  const filters = useMapStore((state) => state.activeFilters);
  const setFilters = useMapStore((state) => state.setActiveFilters);
  const setSimulationPayload = useMapStore((state) => state.setSimulationPayload);

  const presentIndex = Math.max(0, scenarioTimeline.length - 1);
  const asOfLabel = scenarioTimeline[presentIndex] ?? 'Present';

  useEffect(() => {
    useMapStore.setState({
      currentYear: presentIndex,
      activeFilters: persisted?.filters ?? defaultFilters,
      selectedCountry:
        fromHash?.selectedCountry ?? persisted?.selectedCountry ?? 'United States of America',
    });
    // one-time hydration from persisted/hash state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = useLiveSession();
  const chrome = useAppChrome(persisted);
  const scenarios = useScenarios(
    {
      scenarioName: fromHash?.scenarioName ?? persisted?.scenarioName,
      scenarioInputs: fromHash?.scenarioInputs ?? persisted?.scenarioInputs,
      weightSetKey: fromHash?.weightSetKey ?? persisted?.weightSetKey,
      savedScenarios: persisted?.savedScenarios,
      activeEventIds: fromHash?.activeEventIds ?? persisted?.activeEventIds,
      comparisonScenarioId: persisted?.comparisonScenarioId,
    },
    presentIndex,
    selectedCountry,
  );

  const deferredScenarioInputs = useDeferredValue(scenarios.scenarioInputs);
  const deferredWeightSetKey = useDeferredValue(scenarios.weightSetKey);
  const deferredActiveEventIds = useDeferredValue(scenarios.activeEventIds);
  const activeEvents = useMemo(() => resolveEventIds(deferredActiveEventIds), [deferredActiveEventIds]);
  const activeWeightSet = useMemo(
    () => getSimulationWeightSet(deferredWeightSetKey),
    [deferredWeightSetKey],
  );

  useEffect(() => {
    setSimulationPayload({
      profiles: live.activeProfiles,
      scenarioInputs: deferredScenarioInputs,
      activeEvents,
      weightSetKey: deferredWeightSetKey,
    });
  }, [
    activeEvents,
    live.activeProfiles,
    deferredScenarioInputs,
    deferredWeightSetKey,
    setSimulationPayload,
  ]);

  const {
    simulated,
    baselineSimulated,
    selected,
    baselineSelected,
    selectedRiskDelta,
    selectedConfidenceDelta,
    sparkline: selectedSparkline,
  } = useSimulation(
    live.activeProfiles,
    activeEvents,
    deferredScenarioInputs,
    deferredWeightSetKey,
    selectedCountry,
    presentIndex,
    scenarioTimeline,
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
    () =>
      live.activeProfiles.find((profile) => profile.mapName === selectedCountry) ??
      live.activeProfiles[0] ??
      null,
    [live.activeProfiles, selectedCountry],
  );

  const filtered = useMemo(() => filterCountries(simulated, filters), [filters, simulated]);
  const visibleNames = useMemo(() => buildVisibleNames(filtered), [filtered]);
  const railCountries = useMemo(
    () => searchCountries(filtered, chrome.search),
    [filtered, chrome.search],
  );

  const selectedActiveEvents = useMemo(
    () => (selected ? getActiveEventsForProfile(selected.profile, activeEvents) : []),
    [activeEvents, selected],
  );
  const selectedScenarioInputs = useMemo(
    () =>
      selected
        ? getScenarioInputsForProfile(deferredScenarioInputs, activeEvents, selected.profile)
        : deferredScenarioInputs,
    [activeEvents, deferredScenarioInputs, selected],
  );
  const selectedActiveEventNames = useMemo(
    () => selectedActiveEvents.map((event) => event.name),
    [selectedActiveEvents],
  );

  const eventFeed = useMemo<EventFeedItem[]>(
    () =>
      buildEventFeed({
        filtered,
        baselineByName,
        scenarioTimeline,
        timelineIndex: presentIndex,
        alignmentLabel,
      }),
    [baselineByName, filtered, presentIndex],
  );

  const comparisonScenario = useMemo(
    () => scenarios.savedScenarios.find((s) => s.id === scenarios.comparisonScenarioId) ?? null,
    [scenarios.comparisonScenarioId, scenarios.savedScenarios],
  );

  const comparisonSelected = useMemo<SimulatedCountry | null>(() => {
    if (!comparisonScenario || !selectedProfile) return null;
    const comparisonEvents = resolveEventIds(comparisonScenario.activeEventIds ?? []);
    const compWeights = getSimulationWeightSet(comparisonScenario.weightSetKey);
    return simulateCountry(selectedProfile, comparisonScenario.timelineIndex, {
      scenarioInputs: comparisonScenario.inputs,
      activeEvents: comparisonEvents,
      weightSet: compWeights,
      includeHistory: false,
    });
  }, [comparisonScenario, selectedProfile]);

  const comparisonSimulated = useMemo<SimulatedCountry[]>(() => {
    if (!comparisonScenario || chrome.drawerTab !== 'movers') return [];
    const comparisonEvents = resolveEventIds(comparisonScenario.activeEventIds ?? []);
    const compWeights = getSimulationWeightSet(comparisonScenario.weightSetKey);
    return live.activeProfiles.map((profile) =>
      simulateCountry(profile, comparisonScenario.timelineIndex, {
        scenarioInputs: comparisonScenario.inputs,
        activeEvents: comparisonEvents,
        weightSet: compWeights,
        includeHistory: false,
      }),
    );
  }, [live.activeProfiles, comparisonScenario, chrome.drawerTab]);

  const comparisonByName = useMemo(() => {
    if (comparisonSimulated.length === 0) return null;
    return new Map(comparisonSimulated.map((entry) => [entry.profile.mapName, entry]));
  }, [comparisonSimulated]);

  const runtimeInformationQuality = useMemo(
    () =>
      buildInformationQualityTelemetry(live.activeProfiles, {
        layer: 'runtime-live',
        staticReferenceAverageScore: informationQualityTelemetry.averageInformationScore,
      }),
    [live.activeProfiles],
  );

  const globalSummary = useMemo(() => buildGlobalLiveSummary(simulated), [simulated]);

  const handleSelectFromMap = useCallback(
    (mapName: string) => {
      setSelectedCountry(mapName);
      chrome.setRightOpen(true);
      chrome.setInspectorTab('snapshot');
    },
    [chrome, setSelectedCountry],
  );

  const handleSelectCountry = useCallback(
    (mapName: string) => {
      if (byName.has(mapName)) setSelectedCountry(mapName);
    },
    [byName, setSelectedCountry],
  );

  const handleResetFilters = useCallback(() => setFilters(defaultFilters), [setFilters]);

  const moversProps = useMemo(
    () => ({
      active: simulated,
      baselineByName,
      comparisonByName,
      comparisonScenarioName: comparisonScenario?.name ?? null,
      onSelectCountry: handleSelectCountry,
      alignmentColor,
      alignmentLabel,
      staticProfiles: live.staticProfiles,
      liveProfiles: live.activeProfiles,
      liveDataStatus: live.liveDataStatus,
    }),
    [
      baselineByName,
      comparisonByName,
      comparisonScenario?.name,
      handleSelectCountry,
      live.activeProfiles,
      live.liveDataStatus,
      live.staticProfiles,
      simulated,
    ],
  );

  const persistDebounceRef = useRef<number | null>(null);
  useEffect(() => {
    const snapshot = {
      selectedCountry,
      scenarioName: scenarios.scenarioName,
      scenarioInputs: scenarios.scenarioInputs,
      weightSetKey: scenarios.weightSetKey,
      activeEventIds: scenarios.activeEventIds,
      savedScenarios: scenarios.savedScenarios,
      filters,
      timelineIndex: presentIndex,
      inspectorTab: chrome.inspectorTab,
      drawerTab: chrome.drawerTab,
      drawerOpen: chrome.drawerOpen,
      drawerHeight: chrome.drawerHeight,
      comparisonScenarioId: scenarios.comparisonScenarioId,
    };
    if (persistDebounceRef.current) window.clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = window.setTimeout(
      () => savePersistedState(snapshot),
      PERSIST_DEBOUNCE_MS,
    );
  }, [
    selectedCountry,
    scenarios.scenarioName,
    scenarios.scenarioInputs,
    scenarios.weightSetKey,
    scenarios.activeEventIds,
    scenarios.savedScenarios,
    scenarios.comparisonScenarioId,
    filters,
    presentIndex,
    chrome.inspectorTab,
    chrome.drawerTab,
    chrome.drawerOpen,
    chrome.drawerHeight,
  ]);

  useEffect(() => {
    return () => {
      if (persistDebounceRef.current) window.clearTimeout(persistDebounceRef.current);
      scenarios.disposeTimers();
      useMapStore.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!selected || !baselineSelected) {
    return (
      <div
        className="app-shell"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading simulation data"
      >
        Loading simulation...
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        className="shell"
        data-left-open={chrome.leftOpen}
        data-right-open={chrome.rightOpen}
        data-drawer-open={chrome.drawerOpen}
        style={chrome.shellStyle}
      >
        <TopBar
          asOfLabel={asOfLabel}
          scenarioName={scenarios.scenarioName}
          datasetVersion={datasetVersion}
          countryCount={live.activeProfiles.length}
          elevatedRiskCount={globalSummary.elevatedRiskCount}
          medianRisk={globalSummary.medianRisk}
          meanCoverage={globalSummary.meanCoverage}
          liveIndicatorCoveragePct={live.liveIndicatorCoveragePct}
          liveFetchedAt={live.liveFetchedAt}
          liveDataStatus={live.liveDataStatus}
          liveDataDiagnostics={live.liveDataDiagnostics}
          onRetryLiveData={live.loadLiveData}
          leftOpen={chrome.leftOpen}
          rightOpen={chrome.rightOpen}
          drawerOpen={chrome.drawerOpen}
          helpOpen={chrome.helpOpen}
          onToggleLeft={chrome.handleToggleLeft}
          onToggleRight={chrome.handleToggleRight}
          onToggleDrawer={chrome.handleToggleDrawer}
          onToggleHelp={chrome.handleToggleHelp}
          activeEventCount={scenarios.activeEventIds.length}
        />

        <LeftRail
          open={chrome.leftOpen}
          search={chrome.search}
          onSearchChange={chrome.setSearch}
          countries={railCountries}
          totalCount={live.activeProfiles.length}
          selectedName={selectedCountry}
          onSelect={setSelectedCountry}
          filters={filters}
          onFiltersChange={setFilters}
          onClearSearch={chrome.handleClearSearch}
          onResetFilters={handleResetFilters}
          alliances={allianceNetworks}
          alignmentColor={alignmentColor}
          alignmentLabel={alignmentLabel}
          searchInputRef={chrome.searchInputRef}
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
          open={chrome.rightOpen}
          selected={selected}
          baselineSelected={baselineSelected}
          riskDelta={selectedRiskDelta}
          confidenceDelta={selectedConfidenceDelta}
          scenarioName={scenarios.scenarioName}
          scenarioInputs={selectedScenarioInputs}
          activeWeightSet={activeWeightSet}
          activeEventNames={selectedActiveEventNames}
          alignmentColor={alignmentColor}
          alignmentLabel={alignmentLabel}
          tab={chrome.inspectorTab}
          onTabChange={chrome.setInspectorTab}
          onSelectRelated={handleSelectCountry}
          comparisonSelected={comparisonSelected}
          comparisonScenarioName={comparisonScenario?.name ?? null}
          onClearComparison={scenarios.clearComparison}
          sparkline={selectedSparkline}
          allCountries={simulated}
        />

        <BottomDrawer
          open={chrome.drawerOpen}
          tab={chrome.drawerTab}
          onTabChange={chrome.setDrawerTab}
          onClose={chrome.handleCloseDrawer}
          scenarioName={scenarios.scenarioName}
          onScenarioNameChange={scenarios.setScenarioName}
          scenarioInputs={scenarios.scenarioInputs}
          onScenarioInputChange={scenarios.handleScenarioInputChange}
          activeWeightSet={activeWeightSet}
          weightSetKey={scenarios.weightSetKey}
          onWeightSetChange={scenarios.setWeightSetKey}
          weightSets={weightSetOptions}
          savedScenarios={scenarios.savedScenarios}
          onSaveScenario={scenarios.saveScenario}
          onResetScenario={scenarios.resetScenario}
          onShareScenario={scenarios.shareCurrentScenario}
          shareStatus={scenarios.shareStatus}
          onLoadScenario={scenarios.loadScenario}
          onDeleteScenario={scenarios.deleteScenario}
          onRenameScenario={scenarios.renameScenario}
          onExportScenarios={scenarios.exportScenarios}
          onImportScenarios={scenarios.handleImportClick}
          importError={scenarios.importError}
          comparisonScenarioId={scenarios.comparisonScenarioId}
          onToggleComparison={scenarios.toggleComparison}
          eventFeed={eventFeed}
          methodologyNotes={methodologyNotes}
          informationQuality={runtimeInformationQuality}
          baselineInformationQuality={informationQualityTelemetry}
          informationQualityContract={informationQualityContract}
          ingestTelemetry={ingestTelemetry}
          enhancementReleaseTelemetry={enhancementReleaseTelemetry}
          liveDataDiagnostics={live.liveDataDiagnostics}
          scenarioTimeline={scenarioTimeline}
          events={eventLibrary}
          activeEventIds={scenarios.activeEventIds}
          onApplyEvent={scenarios.applyEvent}
          onRemoveEvent={scenarios.removeEvent}
          onApplyEvents={scenarios.applyEvents}
          onClearAllEvents={scenarios.clearAllEvents}
          onResizeStart={chrome.handleDrawerResizeStart}
          onResizeStep={chrome.handleDrawerResizeStep}
          onResizeTo={chrome.handleDrawerResizeTo}
          movers={moversProps}
          indexCountries={railCountries}
        />

        <input
          ref={scenarios.fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={scenarios.handleImportChange}
        />

        <ShortcutsHelp open={chrome.helpOpen} onClose={chrome.handleCloseHelp} />
        <WelcomeGuide
          open={chrome.welcomeOpen}
          onClose={chrome.closeWelcome}
          onFocusSearch={chrome.handleWelcomeFocusSearch}
          onOpenScenarioLab={chrome.handleWelcomeOpenScenario}
          onOpenShortcuts={chrome.handleWelcomeOpenShortcuts}
        />

        {scenarios.pendingDelete && (
          <UndoToast
            message={`Deleted “${scenarios.pendingDelete.name}”`}
            durationMs={6000}
            onUndo={scenarios.restoreDeleted}
            onDismiss={scenarios.dismissPendingDelete}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
