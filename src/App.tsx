import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import {
  allianceNetworks,
  countryProfiles,
  datasetVersion,
  getCountryByMapName,
  methodologyNotes,
  scenarioTimeline,
} from './data/countryData';
import {
  defaultScenarioInputs,
  getRiskTier,
  getSimulationWeightSet,
  simulateCountry,
  simulationWeightSets,
} from './simulation';
import type {
  Alignment,
  Filters,
  OverlayMode,
  RelationshipDimension,
  SavedScenario,
  ScenarioInputs,
  SimulatedCountry,
  WeightSetKey,
} from './types';
import { countryCentroids } from './lib/map';
import { fetchLiveData } from './data/worldBankClient';
import { enrichProfiles } from './data/liveEnrichment';
import { eventLibrary, eventById } from './data/eventLibrary';
import {
  downloadScenariosFile,
  loadPersistedState,
  parseScenariosFile,
  savePersistedState,
} from './lib/persistence';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { MapCanvas } from './components/MapCanvas';
import { RightInspector } from './components/RightInspector';
import type { InspectorTab } from './components/RightInspector';
import { BottomDrawer } from './components/BottomDrawer';
import type { DrawerTab, EventFeedItem } from './components/BottomDrawer';
import type { OverlayConnection } from './components/MapCanvas';
import { ShortcutsHelp } from './components/ShortcutsHelp';

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
const TIMELINE_AUTO_PLAY_INTERVAL_MS = 1200;
const MIN_DRAWER_HEIGHT = 180;
const MAX_DRAWER_HEIGHT_RATIO = 0.65;
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

const clampInput = (key: keyof ScenarioInputs, value: number): number => {
  if (key === 'treatyShift') return Math.min(60, Math.max(-60, value));
  return Math.min(100, Math.max(0, value));
};

/** Ordered list of all `ScenarioInputs` keys — single source of truth for iteration. */
export const scenarioInputKeys: (keyof ScenarioInputs)[] = [
  'sanctionShock',
  'treatyShift',
  'electionVolatility',
  'invasionPressure',
  'coupRisk',
];

const computeEffectiveInputs = (
  manual: ScenarioInputs,
  activeIds: string[],
): ScenarioInputs => {
  const delta = scenarioInputKeys.reduce((acc, key) => {
    const sum = activeIds.reduce((total, id) => {
      const event = eventById.get(id);
      return total + (event?.inputs[key] ?? 0);
    }, 0);
    return { ...acc, [key]: sum };
  }, {} as ScenarioInputs);

  return scenarioInputKeys.reduce((acc, key) => {
    return { ...acc, [key]: clampInput(key, manual[key] + delta[key]) };
  }, {} as ScenarioInputs);
};

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

const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${value}%`;

const getRelationshipMetric = (
  mode: RelationshipDimension,
  relationship: { cooperation: number; hostility: number; dependency: number; deterrence: number },
) => relationship[mode];

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 1080;

const persisted = loadPersistedState();

export default function App() {
  const [timelineIndex, setTimelineIndex] = useState(persisted?.timelineIndex ?? 0);
  const [filters, setFilters] = useState<Filters>(persisted?.filters ?? defaultFilters);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>(
    persisted?.selectedCountry ?? 'United States of America',
  );
  const [overlayMode, setOverlayMode] = useState<OverlayMode>(persisted?.overlayMode ?? 'cooperation');
  const [scenarioName, setScenarioName] = useState(persisted?.scenarioName ?? 'Baseline+');
  const [scenarioInputs, setScenarioInputs] = useState<ScenarioInputs>(
    persisted?.scenarioInputs ?? { ...defaultScenarioInputs },
  );
  const [weightSetKey, setWeightSetKey] = useState<WeightSetKey>(persisted?.weightSetKey ?? 'baseline');
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(persisted?.savedScenarios ?? []);
  const [activeEventIds, setActiveEventIds] = useState<string[]>(persisted?.activeEventIds ?? []);
  const [comparisonScenarioId, setComparisonScenarioId] = useState<string | null>(
    persisted?.comparisonScenarioId ?? null,
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live World Bank data enrichment — starts with static profiles and upgrades
  // in the background. Failures fall back silently to the static dataset.
  const [activeProfiles, setActiveProfiles] = useState(countryProfiles);
  const [liveDataStatus, setLiveDataStatus] = useState<'loading' | 'live' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    fetchLiveData(controller.signal)
      .then((live) => {
        setActiveProfiles(enrichProfiles(countryProfiles, live));
        setLiveDataStatus('live');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLiveDataStatus('error');
      });
    return () => controller.abort();
  }, []);

  // Defer heavy simulation re-runs so UI (sliders, timeline) stays responsive while
  // the map catches up asynchronously via React's concurrent scheduler.
  const deferredScenarioInputs = useDeferredValue(scenarioInputs);
  const deferredWeightSetKey = useDeferredValue(weightSetKey);
  const deferredActiveEventIds = useDeferredValue(activeEventIds);

  // Merge manual slider values with the accumulated deltas from active events.
  const effectiveInputs = useMemo(
    () => computeEffectiveInputs(deferredScenarioInputs, deferredActiveEventIds),
    [deferredScenarioInputs, deferredActiveEventIds],
  );

  const [leftOpen, setLeftOpen] = useState<boolean>(() => !isMobile());
  const [rightOpen, setRightOpen] = useState<boolean>(() => !isMobile());
  const [drawerOpen, setDrawerOpen] = useState<boolean>(persisted?.drawerOpen ?? false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(persisted?.drawerTab ?? 'scenario');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>(persisted?.inspectorTab ?? 'overview');

  // Resizable bottom drawer — height is applied as a CSS custom property on the shell.
  const [drawerHeight, setDrawerHeight] = useState(persisted?.drawerHeight ?? 320);

  // Timeline auto-play — steps through scenario years at a fixed interval.
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const lastIndex = scenarioTimeline.length - 1;
    const id = setInterval(() => {
      setTimelineIndex((current) => {
        if (current >= lastIndex) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, TIMELINE_AUTO_PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, scenarioTimeline.length]);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => {
      if (!prev && timelineIndex >= scenarioTimeline.length - 1) {
        // Restart from the beginning when pressing play at the last year.
        setTimelineIndex(0);
      }
      return !prev;
    });
  };

  // Dragging the top edge of the bottom drawer resizes it.
  const handleDrawerResizeStart = (startClientY: number) => {
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
  };

  const handleDrawerResizeStep = (delta: number) => {
    setDrawerHeight((h) => Math.max(MIN_DRAWER_HEIGHT, Math.min(maxDrawerHeight(), h + delta)));
  };

  const handleDrawerResizeTo = (edge: 'min' | 'max') => {
    setDrawerHeight(edge === 'min' ? MIN_DRAWER_HEIGHT : maxDrawerHeight());
  };

  // Keep a ref so the keydown handler always closes over the latest toggle function
  // without needing to be re-registered on every render.
  const handleTogglePlayRef = useRef(handleTogglePlay);
  handleTogglePlayRef.current = handleTogglePlay;

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
        handleTogglePlayRef.current();
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

  const baselineSimulated = useMemo(() => {
    return activeProfiles.map((profile) =>
      simulateCountry(profile, timelineIndex, {
        scenarioInputs: defaultScenarioInputs,
        weightSet: baselineWeightSet,
      }),
    );
  }, [activeProfiles, timelineIndex]);

  const simulated = useMemo(() => {
    return activeProfiles.map((profile) =>
      simulateCountry(profile, timelineIndex, { scenarioInputs: effectiveInputs, weightSet: activeWeightSet }),
    );
  }, [activeProfiles, activeWeightSet, effectiveInputs, timelineIndex]);

  const baselineByName = useMemo(
    () => new Map(baselineSimulated.map((entry) => [entry.profile.mapName, entry])),
    [baselineSimulated],
  );

  const byName = useMemo(
    () => new Map(simulated.map((entry) => [entry.profile.mapName, entry])),
    [simulated],
  );

  const filtered = useMemo(() => {
    return simulated.filter((entry) => {
      const riskTier = getRiskTier(entry.risk);
      return (
        (filters.allianceNetwork === 'all' || entry.profile.allianceNetwork === filters.allianceNetwork) &&
        (filters.tradeExposure === 'all' || entry.profile.indicators.tradeExposure === filters.tradeExposure) &&
        (filters.militaryTreatyLevel === 'all' ||
          entry.profile.indicators.militaryTreatyLevel === filters.militaryTreatyLevel) &&
        (filters.conflictPressure === 'all' ||
          entry.profile.indicators.conflictPressure === filters.conflictPressure) &&
        (filters.sanctionsExposure === 'all' ||
          entry.profile.indicators.sanctionsExposure === filters.sanctionsExposure) &&
        (filters.regimeType === 'all' || entry.profile.regimeType === filters.regimeType) &&
        (filters.riskLevel === 'all' || riskTier === filters.riskLevel)
      );
    });
  }, [filters, simulated]);

  const visibleNames = useMemo(
    () => new Set(filtered.map((entry) => entry.profile.mapName)),
    [filtered],
  );

  const railCountries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return filtered;
    return filtered.filter((entry) => {
      const profile = entry.profile;
      return (
        profile.displayName.toLowerCase().includes(query) ||
        profile.region.toLowerCase().includes(query) ||
        profile.subregion.toLowerCase().includes(query) ||
        profile.mapName.toLowerCase().includes(query)
      );
    });
  }, [filtered, search]);

  const selected = byName.get(selectedCountry) ?? simulated[0];
  const baselineSelected = baselineByName.get(selectedCountry) ?? baselineSimulated[0];
  const selectedRiskDelta = Math.round(selected.risk - baselineSelected.risk);
  const selectedConfidenceDelta = Math.round(selected.confidence - baselineSelected.confidence);

  const overlayConnections = useMemo<OverlayConnection[]>(() => {
    if (overlayMode === 'none') return [];
    // Use the static profile (not the simulated result) so this only recomputes when the
    // selected country or overlay mode changes — not on every scenario-slider adjustment.
    const profile = getCountryByMapName(selectedCountry);
    if (!profile) return [];
    const sourceCentroid = countryCentroids.get(selectedCountry);
    if (!sourceCentroid) return [];
    const [sourceX, sourceY] = sourceCentroid;

    return profile.relationships
      .map((relationship) => {
        const targetCentroid = countryCentroids.get(relationship.mapName);
        if (!targetCentroid) return null;
        return {
          countryId: relationship.countryId,
          mapName: relationship.mapName,
          displayName: relationship.displayName,
          score: getRelationshipMetric(overlayMode, relationship),
          x1: sourceX,
          y1: sourceY,
          x2: targetCentroid[0],
          y2: targetCentroid[1],
        };
      })
      .filter((connection): connection is OverlayConnection => Boolean(connection))
      .filter((connection) => connection.score >= 40)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);
  }, [overlayMode, selectedCountry]);

  const relatedNames = useMemo(
    () => new Set(overlayConnections.map((connection) => connection.mapName)),
    [overlayConnections],
  );

  const eventFeed = useMemo<EventFeedItem[]>(() => {
    return filtered
      .slice()
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 5)
      .map((entry) => {
        const topPressure = entry.profile.relationships[0];
        const baselineEntry = baselineByName.get(entry.profile.mapName);
        const riskDelta = baselineEntry ? Math.round(entry.risk - baselineEntry.risk) : 0;
        const tone = getRiskTier(entry.risk);
        return {
          title: `${scenarioTimeline[timelineIndex]} · ${entry.profile.displayName}`,
          detail: `${alignmentLabel[entry.alignment]} at ${entry.confidence}% confidence and ${entry.risk}% modeled escalation risk (${formatSignedPercent(
            riskDelta,
          )} vs baseline)${topPressure ? `. Top pressure: ${topPressure.displayName}.` : '.'}`,
          tone,
        };
      });
  }, [baselineByName, filtered, timelineIndex]);

  // Optional comparison track — recomputes only the selected country (cheap).
  const comparisonScenario = useMemo(
    () => savedScenarios.find((scenario) => scenario.id === comparisonScenarioId) ?? null,
    [comparisonScenarioId, savedScenarios],
  );

  const comparisonSelected = useMemo<SimulatedCountry | null>(() => {
    if (!comparisonScenario) return null;
    const profile = activeProfiles.find((entry) => entry.mapName === selectedCountry);
    if (!profile) return null;
    const compEffective = computeEffectiveInputs(
      comparisonScenario.inputs,
      comparisonScenario.activeEventIds ?? [],
    );
    return simulateCountry(profile, comparisonScenario.timelineIndex, {
      scenarioInputs: compEffective,
      weightSet: getSimulationWeightSet(comparisonScenario.weightSetKey),
    });
  }, [activeProfiles, comparisonScenario, selectedCountry]);

  const handleScenarioInputChange = <K extends keyof ScenarioInputs>(key: K, value: number) => {
    setScenarioInputs((current) => ({ ...current, [key]: value }));
  };

  const applyEvent = (id: string) => {
    setActiveEventIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const removeEvent = (id: string) => {
    setActiveEventIds((current) => current.filter((activeId) => activeId !== id));
  };

  const resetScenario = () => {
    setScenarioName('Baseline+');
    setScenarioInputs({ ...defaultScenarioInputs });
    setWeightSetKey('baseline');
    setActiveEventIds([]);
  };

  const saveScenario = () => {
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
        },
        ...current,
      ].slice(0, 12),
    );
  };

  const loadScenario = (scenario: SavedScenario) => {
    setScenarioName(scenario.name);
    setScenarioInputs({ ...scenario.inputs });
    setWeightSetKey(scenario.weightSetKey);
    setTimelineIndex(scenario.timelineIndex);
    setActiveEventIds(scenario.activeEventIds ?? []);
  };

  const deleteScenario = (id: string) => {
    setSavedScenarios((current) => current.filter((scenario) => scenario.id !== id));
    setComparisonScenarioId((current) => (current === id ? null : current));
  };

  const renameScenario = (id: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    setSavedScenarios((current) =>
      current.map((scenario) => (scenario.id === id ? { ...scenario, name: trimmed } : scenario)),
    );
  };

  const exportScenarios = (id?: string) => {
    const target = id
      ? savedScenarios.filter((scenario) => scenario.id === id)
      : savedScenarios;
    if (target.length === 0) return;
    const filename = id
      ? `realpolitik-scenario-${target[0].name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'scenario'}.json`
      : undefined;
    downloadScenariosFile(target, datasetVersion, filename);
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
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
  };

  const toggleComparison = (id: string) => {
    setComparisonScenarioId((current) => (current === id ? null : id));
  };

  const clearComparison = () => setComparisonScenarioId(null);

  const handleSelectFromInspector = (mapName: string) => {
    if (byName.has(mapName)) setSelectedCountry(mapName);
  };

  const totalCountries = activeProfiles.length;
  const shellStyle = { '--drawer-h': `${drawerHeight}px` } as CSSProperties;
  const handleTimelineChange = (index: number) => {
    setIsPlaying(false);
    setTimelineIndex(index);
  };

  // Persist UI + scenarios to localStorage. Each change writes synchronously — the payload is
  // small enough that we don't need throttling, and saves are guarded behind a try/catch.
  useEffect(() => {
    savePersistedState({
      selectedCountry,
      scenarioName,
      scenarioInputs,
      weightSetKey,
      activeEventIds,
      savedScenarios,
      filters,
      timelineIndex,
      overlayMode,
      inspectorTab,
      drawerTab,
      drawerOpen,
      drawerHeight,
      comparisonScenarioId,
    });
  }, [
    selectedCountry,
    scenarioName,
    scenarioInputs,
    weightSetKey,
    activeEventIds,
    savedScenarios,
    filters,
    timelineIndex,
    overlayMode,
    inspectorTab,
    drawerTab,
    drawerOpen,
    drawerHeight,
    comparisonScenarioId,
  ]);

  return (
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
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        drawerOpen={drawerOpen}
        onToggleLeft={() => setLeftOpen((value) => !value)}
        onToggleRight={() => setRightOpen((value) => !value)}
        onToggleDrawer={() => setDrawerOpen((value) => !value)}
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
        alliances={allianceNetworks}
        alignmentColor={alignmentColor}
        alignmentLabel={alignmentLabel}
        searchInputRef={searchInputRef}
      />

      <MapCanvas
        byName={byName}
        visibleNames={visibleNames}
        selectedName={selectedCountry}
        onSelect={setSelectedCountry}
        overlayMode={overlayMode}
        onOverlayModeChange={setOverlayMode}
        overlayConnections={overlayConnections}
        relatedNames={relatedNames}
        alignmentColor={alignmentColor}
        alignmentLabel={alignmentLabel}
      />

      <RightInspector
        open={rightOpen}
        selected={selected}
        baselineSelected={baselineSelected}
        riskDelta={selectedRiskDelta}
        confidenceDelta={selectedConfidenceDelta}
        scenarioName={scenarioName}
        scenarioInputs={effectiveInputs}
        activeWeightSet={activeWeightSet}
        alignmentColor={alignmentColor}
        alignmentLabel={alignmentLabel}
        tab={inspectorTab}
        onTabChange={setInspectorTab}
        onSelectRelated={handleSelectFromInspector}
        comparisonSelected={comparisonSelected}
        comparisonScenarioName={comparisonScenario?.name ?? null}
        onClearComparison={clearComparison}
      />

      <BottomDrawer
        open={drawerOpen}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
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
        scenarioTimeline={scenarioTimeline}
        events={eventLibrary}
        activeEventIds={activeEventIds}
        onApplyEvent={applyEvent}
        onRemoveEvent={removeEvent}
        onResizeStart={handleDrawerResizeStart}
        onResizeStep={handleDrawerResizeStep}
        onResizeTo={handleDrawerResizeTo}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleImportChange}
      />

      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
