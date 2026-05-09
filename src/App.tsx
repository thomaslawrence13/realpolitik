import { useEffect, useMemo, useState } from 'react';
import {
  allianceNetworks,
  countryProfiles,
  datasetVersion,
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
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('United States of America');
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('cooperation');
  const [scenarioName, setScenarioName] = useState('Baseline+');
  const [scenarioInputs, setScenarioInputs] = useState<ScenarioInputs>({ ...defaultScenarioInputs });
  const [weightSetKey, setWeightSetKey] = useState<WeightSetKey>('baseline');
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);

  const [leftOpen, setLeftOpen] = useState<boolean>(() => !isMobile());
  const [rightOpen, setRightOpen] = useState<boolean>(() => !isMobile());
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('scenario');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === '[') setLeftOpen((value) => !value);
      if (event.key === ']') setRightOpen((value) => !value);
      if (event.key === '\\') setDrawerOpen((value) => !value);
      if (event.key === '/') {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>('.rail-search input');
        input?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeWeightSet = useMemo(() => getSimulationWeightSet(weightSetKey), [weightSetKey]);

  const baselineSimulated = useMemo(() => {
    return countryProfiles.map((profile) =>
      simulateCountry(profile, timelineIndex, {
        scenarioInputs: defaultScenarioInputs,
        weightSet: baselineWeightSet,
      }),
    );
  }, [timelineIndex]);

  const simulated = useMemo(() => {
    return countryProfiles.map((profile) =>
      simulateCountry(profile, timelineIndex, { scenarioInputs, weightSet: activeWeightSet }),
    );
  }, [activeWeightSet, scenarioInputs, timelineIndex]);

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
    if (!selected || overlayMode === 'none') return [];
    const sourceCentroid = countryCentroids.get(selected.profile.mapName);
    if (!sourceCentroid) return [];
    const [sourceX, sourceY] = sourceCentroid;

    return selected.profile.relationships
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
  }, [overlayMode, selected]);

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

  const resetScenario = () => {
    setScenarioName('Baseline+');
    setScenarioInputs({ ...defaultScenarioInputs });
    setWeightSetKey('baseline');
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
  };

  const handleSelectFromInspector = (mapName: string) => {
    if (byName.has(mapName)) setSelectedCountry(mapName);
  };

  const totalCountries = countryProfiles.length;

  return (
    <div
      className="shell"
      data-left-open={leftOpen}
      data-right-open={rightOpen}
      data-drawer-open={drawerOpen}
    >
      <TopBar
        timelineIndex={timelineIndex}
        timeline={scenarioTimeline}
        onTimelineChange={setTimelineIndex}
        scenarioName={scenarioName}
        datasetVersion={datasetVersion}
        countryCount={totalCountries}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        drawerOpen={drawerOpen}
        onToggleLeft={() => setLeftOpen((value) => !value)}
        onToggleRight={() => setRightOpen((value) => !value)}
        onToggleDrawer={() => setDrawerOpen((value) => !value)}
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
        hoveredName={hoveredCountry}
        onSelect={setSelectedCountry}
        onHover={setHoveredCountry}
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
        scenarioInputs={scenarioInputs}
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
      />
    </div>
  );
}
