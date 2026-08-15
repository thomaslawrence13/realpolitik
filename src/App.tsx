import { lazy, Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMapStore } from './store/useMapStore';
import {
  allianceNetworks,
  datasetAsOf,
  datasetVersion,
  enhancementReleaseTelemetry,
  ingestTelemetry,
  informationQualityContract,
  informationQualityTelemetry,
  methodologyNotes,
} from './data/countryData';
import { assessCountry } from './assessment';
import type { Alignment, CountryAssessment, Filters } from './types';
import { buildInformationQualityTelemetry } from './data/quality/telemetry';
import { loadPersistedState, savePersistedState } from './lib/persistence';
import { buildShareableUrl, clearHash, decodeStateFromHash } from './lib/urlState';
import { useLiveSession } from './hooks/useLiveSession';
import { useAppChrome } from './hooks/useAppChrome';
import { useFilteredCountries } from './hooks/useFilteredCountries';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { RightInspector } from './components/RightInspector';
import { BottomDrawer } from './components/BottomDrawer';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { WelcomeGuide } from './components/WelcomeGuide';
import { UI_TIMING } from './lib/constants';
import { buildGlobalLiveSummary } from './lib/globalStats';

const loadMapCanvas = () => import('./components/MapCanvas').then((module) => ({ default: module.MapCanvas }));
const MapCanvas = lazy(loadMapCanvas);

// The map is the primary visual surface. Start its split-chunk request while
// the application module is evaluating instead of waiting for React's first
// render to discover the lazy boundary.
void loadMapCanvas();

const defaultFilters: Filters = {
  allianceNetwork: 'all',
  tradeExposure: 'all',
  militaryTreatyLevel: 'all',
  conflictPressure: 'all',
  sanctionsExposure: 'all',
  regimeType: 'all',
  riskLevel: 'all',
};

const PERSIST_DEBOUNCE_MS = UI_TIMING.persistDebounceMs;

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

const persisted = loadPersistedState();
const fromHash = decodeStateFromHash();
if (fromHash) clearHash();

export default function App() {
  const selectedCountry = useMapStore((state) => state.selectedCountry);
  const setSelectedCountry = useMapStore((state) => state.setSelectedCountry);
  const filters = useMapStore((state) => state.activeFilters);
  const setFilters = useMapStore((state) => state.setActiveFilters);
  const overlayMode = useMapStore((state) => state.overlayMode);
  const fillMode = useMapStore((state) => state.fillMode);

  useEffect(() => {
    useMapStore.setState({
      activeFilters: persisted?.filters ?? defaultFilters,
      selectedCountry: fromHash?.selectedCountry ?? persisted?.selectedCountry ?? 'United States of America',
      overlayMode: fromHash?.overlayMode ?? persisted?.overlayMode ?? 'none',
      fillMode: fromHash?.mapFillMode ?? persisted?.mapFillMode ?? 'risk',
    });
    // one-time hydration from persisted/hash state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = useLiveSession();
  const chrome = useAppChrome(persisted);

  const simulated = useMemo<CountryAssessment[]>(
    () => live.activeProfiles.map((profile) => assessCountry(profile)),
    [live.activeProfiles],
  );

  const byName = useMemo(
    () => new Map(simulated.map((entry) => [entry.profile.mapName, entry])),
    [simulated],
  );
  const selected = useMemo(
    () => byName.get(selectedCountry) ?? byName.values().next().value ?? null,
    [byName, selectedCountry],
  );

  const { filtered, visibleNames, railCountries } = useFilteredCountries(
    simulated,
    filters,
    chrome.search,
  );

  const runtimeInformationQuality = useMemo(
    () =>
      buildInformationQualityTelemetry(live.activeProfiles, {
        layer: 'runtime-live',
        staticReferenceAverageScore: informationQualityTelemetry.averageInformationScore,
      }),
    [live.activeProfiles],
  );

  const globalSummary = useMemo(() => buildGlobalLiveSummary(simulated), [simulated]);
  const shareUrl = useMemo(
    () => buildShareableUrl({ selectedCountry, overlayMode, mapFillMode: fillMode }),
    [fillMode, overlayMode, selectedCountry],
  );

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

  const persistDebounceRef = useRef<number | null>(null);
  useEffect(() => {
    const snapshot = {
      selectedCountry,
      filters,
      overlayMode,
      mapFillMode: fillMode,
      inspectorTab: chrome.inspectorTab,
      drawerTab: chrome.drawerTab,
      drawerOpen: chrome.drawerOpen,
      drawerHeight: chrome.drawerHeight,
    };
    if (persistDebounceRef.current) window.clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = window.setTimeout(
      () => savePersistedState(snapshot),
      PERSIST_DEBOUNCE_MS,
    );
  }, [
    selectedCountry,
    filters,
    overlayMode,
    fillMode,
    chrome.inspectorTab,
    chrome.drawerTab,
    chrome.drawerOpen,
    chrome.drawerHeight,
  ]);

  useEffect(() => {
    return () => {
      if (persistDebounceRef.current) window.clearTimeout(persistDebounceRef.current);
      useMapStore.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!selected) {
    return (
      <div
        className="app-shell"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading country data"
      >
        Loading data...
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
          asOfLabel={datasetAsOf}
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
          shareUrl={shareUrl}
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
            visibleNames={visibleNames}
            selectedName={selectedCountry}
            onSelect={handleSelectFromMap}
            alignmentColor={alignmentColor}
            alignmentLabel={alignmentLabel}
          />
        </Suspense>

        <RightInspector
          open={chrome.rightOpen}
          selected={selected}
          allCountries={simulated}
          alignmentColor={alignmentColor}
          alignmentLabel={alignmentLabel}
          tab={chrome.inspectorTab}
          onTabChange={chrome.setInspectorTab}
          onSelectRelated={handleSelectCountry}
        />

        <BottomDrawer
          open={chrome.drawerOpen}
          tab={chrome.drawerTab}
          onTabChange={chrome.setDrawerTab}
          onClose={chrome.handleCloseDrawer}
          methodologyNotes={methodologyNotes}
          informationQuality={runtimeInformationQuality}
          baselineInformationQuality={informationQualityTelemetry}
          informationQualityContract={informationQualityContract}
          ingestTelemetry={ingestTelemetry}
          enhancementReleaseTelemetry={enhancementReleaseTelemetry}
          liveDataDiagnostics={live.liveDataDiagnostics}
          onResizeStart={chrome.handleDrawerResizeStart}
          onResizeStep={chrome.handleDrawerResizeStep}
          onResizeTo={chrome.handleDrawerResizeTo}
          movers={{
            onSelectCountry: handleSelectCountry,
            staticProfiles: live.staticProfiles,
            liveProfiles: live.activeProfiles,
            liveDataStatus: live.liveDataStatus,
          }}
          indexCountries={railCountries}
        />

        <ShortcutsHelp open={chrome.helpOpen} onClose={chrome.handleCloseHelp} />
        <WelcomeGuide open={chrome.welcomeOpen} onClose={chrome.closeWelcome} onFocusSearch={chrome.handleWelcomeFocusSearch} onOpenMethodology={chrome.handleWelcomeOpenMethodology} onOpenShortcuts={chrome.handleWelcomeOpenShortcuts} />
      </div>
    </ErrorBoundary>
  );
}
