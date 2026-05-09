import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import type { CSSProperties } from 'react';
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
  WeightSetKey,
} from './types';
import { countryCentroids } from './lib/map';
import { fetchLiveData } from './data/worldBankClient';
import { enrichProfiles } from './data/liveEnrichment';
import { eventLibrary, eventById } from './data/eventLibrary';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { MapCanvas } from './components/MapCanvas';
import { RightInspector } from './components/RightInspector';
import type { InspectorTab } from './components/RightInspector';
import { BottomDrawer } from './components/BottomDrawer';
import type { DrawerTab, EventFeedItem } from './components/BottomDrawer';
import type { OverlayConnection } from './components/MapCanvas';

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

export default function App() {
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('United States of America');
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('cooperation');
  const [scenarioName, setScenarioName] = useState('Baseline+');
  const [scenarioInputs, setScenarioInputs] = useState<ScenarioInputs>({ ...defaultScenarioInputs });
  const [weightSetKey, setWeightSetKey] = useState<WeightSetKey>('baseline');
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [activeEventIds, setActiveEventIds] = useState<string[]>([]);

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
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('scenario');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');

  // Resizable bottom drawer — height is applied as a CSS custom property on the shell.
  const [drawerHeight, setDrawerHeight] = useState(320);

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
    }, 1200);
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
      setDrawerHeight(Math.max(180, Math.min(Math.floor(window.innerHeight * 0.65), startH + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleDrawerResizeStep = (delta: number) => {
    setDrawerHeight((h) => Math.max(180, Math.min(Math.floor(window.innerHeight * 0.65), h + delta)));
  };

  const handleDrawerResizeTo = (edge: 'min' | 'max') => {
    setDrawerHeight(edge === 'min' ? 180 : Math.floor(window.innerHeight * 0.65));
  };

  // Keep a ref so the keydown handler always closes over the latest toggle function
  // without needing to be re-registered on every render.
  const handleTogglePlayRef = useRef(handleTogglePlay);
  handleTogglePlayRef.current = handleTogglePlay;

  useEffect(() => {
    const INTERACTIVE_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      if (target.isContentEditable || target.getAttribute('role') === 'textbox') {
        return;
      }
      if (event.key === '[') setLeftOpen((value) => !value);
      if (event.key === ']') setRightOpen((value) => !value);
      if (event.key === '\\') setDrawerOpen((value) => !value);
      if (event.key === ' ' && !INTERACTIVE_TAGS.has(target.tagName)) {
        event.preventDefault();
        handleTogglePlayRef.current();
      }
      if (event.key === '/') {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>('.rail-search input');
        input?.focus();
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
      ].slice(0, 8),
    );
  };

  const loadScenario = (scenario: SavedScenario) => {
    setScenarioName(scenario.name);
    setScenarioInputs({ ...scenario.inputs });
    setWeightSetKey(scenario.weightSetKey);
    setTimelineIndex(scenario.timelineIndex);
    setActiveEventIds(scenario.activeEventIds ?? []);
  };

  const handleSelectFromInspector = (mapName: string) => {
    if (byName.has(mapName)) setSelectedCountry(mapName);
  };

  const totalCountries = activeProfiles.length;
  const shellStyle: CSSProperties & { '--drawer-h': string } = {
    '--drawer-h': `${drawerHeight}px`,
  };

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
        onTimelineChange={(index) => { setIsPlaying(false); setTimelineIndex(index); }}
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
    </div>
  );
}
