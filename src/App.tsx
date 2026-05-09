import { useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldTopology from 'world-atlas/countries-110m.json';
import { allianceNetworks, countryProfiles, datasetVersion, methodologyNotes, scenarioTimeline } from './data/countryData';
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
  Tier,
  WeightSetKey,
} from './types';

const width = 980;
const height = 520;
const topology = worldTopology as { objects: { countries: unknown } };
const worldFeatures = feature(topology as never, topology.objects.countries as never) as unknown as FeatureCollection<
  Geometry,
  { name: string }
>;
const projection = geoMercator().fitSize([width, height], worldFeatures);
const path = geoPath(projection);

const countries = worldFeatures.features as Array<{
  id?: string;
  properties: { name: string };
  geometry: Geometry;
}>;

const countryCentroids = new Map(
  countries.map((country) => [country.properties.name, path.centroid(country as never) as [number, number]]),
);

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
  blocA: 'Bloc A leaning',
  blocB: 'Bloc B leaning',
  nonAligned: 'Non-aligned',
  unstable: 'Contested / unstable',
};

const alignmentColor: Record<Alignment, string> = {
  blocA: '#5ea3ff',
  blocB: '#ff6b6b',
  nonAligned: '#ffd166',
  unstable: '#c77dff',
};

const overlayLabel: Record<RelationshipDimension, string> = {
  cooperation: 'Cooperation overlay',
  hostility: 'Hostility overlay',
  dependency: 'Dependency overlay',
  deterrence: 'Deterrence overlay',
};

const overlayColor: Record<RelationshipDimension, string> = {
  cooperation: '#38bdf8',
  hostility: '#fb7185',
  dependency: '#f59e0b',
  deterrence: '#a78bfa',
};

const tierOptions: Array<'all' | Tier> = ['all', 'low', 'medium', 'high'];
const regimeOptions = ['all', 'democracy', 'hybrid', 'authoritarian'] as const;

const formatPercent = (value: number) => `${value}%`;
const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${value}%`;
const formatSignedValue = (value: number) => `${value > 0 ? '+' : ''}${value}`;
const formatTitle = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const getRelationshipMetric = (
  mode: RelationshipDimension,
  relationship: { cooperation: number; hostility: number; dependency: number; deterrence: number },
) => relationship[mode];

const summarizeScenarioInputs = (inputs: ScenarioInputs) => {
  return [
    `Sanctions ${inputs.sanctionShock}`,
    `Treaties ${formatSignedValue(inputs.treatyShift)}`,
    `Elections ${inputs.electionVolatility}`,
    `Invasions ${inputs.invasionPressure}`,
    `Coups ${inputs.coupRisk}`,
  ].join(' · ');
};

export default function App() {
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('United States of America');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('cooperation');
  const [scenarioName, setScenarioName] = useState('Baseline+');
  const [scenarioInputs, setScenarioInputs] = useState<ScenarioInputs>({ ...defaultScenarioInputs });
  const [weightSetKey, setWeightSetKey] = useState<WeightSetKey>('baseline');
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);

  const activeWeightSet = useMemo(() => getSimulationWeightSet(weightSetKey), [weightSetKey]);

  const baselineSimulated = useMemo(() => {
    return countryProfiles.map((profile) =>
      simulateCountry(profile, timelineIndex, { scenarioInputs: defaultScenarioInputs, weightSet: baselineWeightSet }),
    );
  }, [timelineIndex]);

  const simulated = useMemo(() => {
    return countryProfiles.map((profile) => simulateCountry(profile, timelineIndex, { scenarioInputs, weightSet: activeWeightSet }));
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
        (filters.militaryTreatyLevel === 'all' || entry.profile.indicators.militaryTreatyLevel === filters.militaryTreatyLevel) &&
        (filters.conflictPressure === 'all' || entry.profile.indicators.conflictPressure === filters.conflictPressure) &&
        (filters.sanctionsExposure === 'all' || entry.profile.indicators.sanctionsExposure === filters.sanctionsExposure) &&
        (filters.regimeType === 'all' || entry.profile.regimeType === filters.regimeType) &&
        (filters.riskLevel === 'all' || riskTier === filters.riskLevel)
      );
    });
  }, [filters, simulated]);

  const visibleNames = useMemo(() => new Set(filtered.map((entry) => entry.profile.mapName)), [filtered]);
  const selected = byName.get(selectedCountry) ?? simulated[0];
  const baselineSelected = baselineByName.get(selectedCountry) ?? baselineSimulated[0];
  const selectedRiskDelta = Math.round(selected.risk - baselineSelected.risk);
  const selectedConfidenceDelta = Math.round(selected.confidence - baselineSelected.confidence);

  const overlayConnections = useMemo(() => {
    if (!selected || overlayMode === 'none') {
      return [];
    }

    const [sourceX, sourceY] = countryCentroids.get(selected.profile.mapName) ?? [];

    if (typeof sourceX !== 'number' || typeof sourceY !== 'number') {
      return [];
    }

    return selected.profile.relationships
      .map((relationship) => {
        const targetCentroid = countryCentroids.get(relationship.mapName);

        if (!targetCentroid) {
          return null;
        }

        return {
          ...relationship,
          score: getRelationshipMetric(overlayMode, relationship),
          x1: sourceX,
          y1: sourceY,
          x2: targetCentroid[0],
          y2: targetCentroid[1],
        };
      })
      .filter((connection): connection is NonNullable<typeof connection> => Boolean(connection))
      .filter((connection) => connection.score >= 40)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);
  }, [overlayMode, selected]);

  const relatedCountries = useMemo(() => new Set(overlayConnections.map((connection) => connection.mapName)), [overlayConnections]);

  const eventFeed = useMemo(() => {
    return filtered
      .slice()
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 4)
      .map((entry) => {
        const topPressure = entry.profile.relationships[0];
        const baselineEntry = baselineByName.get(entry.profile.mapName);
        const riskDelta = baselineEntry ? Math.round(entry.risk - baselineEntry.risk) : 0;

        return {
          title: `${scenarioTimeline[timelineIndex]}: ${entry.profile.displayName}`,
          detail: `${alignmentLabel[entry.alignment]} with ${entry.confidence}% confidence and ${entry.risk}% modeled escalation risk (${formatSignedPercent(
            riskDelta,
          )} vs baseline).${topPressure ? ` Top relationship pressure: ${topPressure.displayName}.` : ''}`,
        };
      });
  }, [baselineByName, filtered, timelineIndex]);

  const handleFilterChange = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleScenarioInputChange = <K extends keyof ScenarioInputs>(key: K, value: number) => {
    setScenarioInputs((current) => ({ ...current, [key]: value }));
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragStart) return;

    setOffset((current) => ({
      x: current.x + (event.clientX - dragStart.x) / zoom,
      y: current.y + (event.clientY - dragStart.y) / zoom,
    }));
    setDragStart({ x: event.clientX, y: event.clientY });
  };

  const resetScenario = () => {
    setScenarioName('Baseline+');
    setScenarioInputs({ ...defaultScenarioInputs });
    setWeightSetKey('baseline');
  };

  const saveScenario = () => {
    const name = scenarioName.trim() || `Scenario ${savedScenarios.length + 1}`;

    setSavedScenarios((current) => [
      {
        id: `${Date.now()}`,
        name,
        timelineIndex,
        weightSetKey,
        inputs: { ...scenarioInputs },
      },
      ...current,
    ].slice(0, 6));
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Realpolitik prototype</p>
          <h1>Interactive world alignment map</h1>
          <p className="hero-copy">
            A browser-based 2D geopolitical simulation that now reads from a versioned country-and-relationship dataset,
            exposes source attribution, and lets users compare baseline outcomes against editable scenario shocks.
          </p>
        </div>
        <div className="hero-card">
          <span>Active dataset</span>
          <strong>{datasetVersion}</strong>
          <p>{countryProfiles.length} parameterized countries with relationship edges feeding the current scenario model.</p>
        </div>
      </header>

      <section className="control-bar">
        <label>
          <span>Scenario year</span>
          <input
            type="range"
            min={0}
            max={scenarioTimeline.length - 1}
            value={timelineIndex}
            onChange={(event) => setTimelineIndex(Number(event.target.value))}
          />
          <strong>{scenarioTimeline[timelineIndex]}</strong>
        </label>
        <div className="zoom-controls">
          <button type="button" onClick={() => setZoom((current) => Math.max(0.8, current - 0.15))}>
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((current) => Math.min(2.4, current + 0.15))}>
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            Reset view
          </button>
        </div>
      </section>

      <section className="scenario-panel">
        <div className="panel-header compact">
          <div>
            <h2>Scenario lab</h2>
            <p>Adjust shocks, swap model weight sets, and compare the edited outcome against the baseline run.</p>
          </div>
          <div className="scenario-actions">
            <button type="button" onClick={resetScenario}>Reset scenario</button>
            <button type="button" onClick={saveScenario}>Save to history</button>
          </div>
        </div>

        <div className="scenario-top-row">
          <label className="filter-field">
            <span>Scenario label</span>
            <input value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>Weight set</span>
            <select value={weightSetKey} onChange={(event) => setWeightSetKey(event.target.value as WeightSetKey)}>
              {weightSetOptions.map((weightSet) => (
                <option key={weightSet.key} value={weightSet.key}>
                  {weightSet.label}
                </option>
              ))}
            </select>
          </label>
          <div className="scenario-weight-card">
            <span>Weight profile</span>
            <strong>{activeWeightSet.label}</strong>
            <p>{activeWeightSet.description}</p>
          </div>
        </div>

        <div className="scenario-grid">
          <ScenarioSlider
            label="Sanctions shock"
            value={scenarioInputs.sanctionShock}
            min={0}
            max={100}
            onChange={(value) => handleScenarioInputChange('sanctionShock', value)}
          />
          <ScenarioSlider
            label="Treaty change"
            value={scenarioInputs.treatyShift}
            min={-60}
            max={60}
            onChange={(value) => handleScenarioInputChange('treatyShift', value)}
          />
          <ScenarioSlider
            label="Election volatility"
            value={scenarioInputs.electionVolatility}
            min={0}
            max={100}
            onChange={(value) => handleScenarioInputChange('electionVolatility', value)}
          />
          <ScenarioSlider
            label="Invasion pressure"
            value={scenarioInputs.invasionPressure}
            min={0}
            max={100}
            onChange={(value) => handleScenarioInputChange('invasionPressure', value)}
          />
          <ScenarioSlider
            label="Coup risk"
            value={scenarioInputs.coupRisk}
            min={0}
            max={100}
            onChange={(value) => handleScenarioInputChange('coupRisk', value)}
          />
        </div>

        <div className="scenario-summary-row">
          <div className="scenario-summary-card">
            <span>Active scenario</span>
            <strong>{scenarioName}</strong>
            <p>{summarizeScenarioInputs(scenarioInputs)}</p>
          </div>
          <div className="scenario-summary-card">
            <span>Selected country delta</span>
            <strong>{selected.profile.displayName}</strong>
            <p>
              {selected.alignment === baselineSelected.alignment ? 'Alignment unchanged' : `${alignmentLabel[baselineSelected.alignment]} → ${alignmentLabel[selected.alignment]}`}
              {' · '}Risk {formatSignedPercent(selectedRiskDelta)}{' · '}Confidence {formatSignedPercent(selectedConfidenceDelta)}
            </p>
          </div>
        </div>
      </section>

      <section className="filters-panel">
        <FilterSelect
          label="Alliance network"
          value={filters.allianceNetwork}
          options={['all', ...allianceNetworks]}
          onChange={(value) => handleFilterChange('allianceNetwork', value)}
        />
        <FilterSelect
          label="Trade exposure"
          value={filters.tradeExposure}
          options={tierOptions}
          onChange={(value) => handleFilterChange('tradeExposure', value as Filters['tradeExposure'])}
        />
        <FilterSelect
          label="Military treaties"
          value={filters.militaryTreatyLevel}
          options={tierOptions}
          onChange={(value) => handleFilterChange('militaryTreatyLevel', value as Filters['militaryTreatyLevel'])}
        />
        <FilterSelect
          label="Conflict pressure"
          value={filters.conflictPressure}
          options={tierOptions}
          onChange={(value) => handleFilterChange('conflictPressure', value as Filters['conflictPressure'])}
        />
        <FilterSelect
          label="Sanctions exposure"
          value={filters.sanctionsExposure}
          options={tierOptions}
          onChange={(value) => handleFilterChange('sanctionsExposure', value as Filters['sanctionsExposure'])}
        />
        <FilterSelect
          label="Regime type"
          value={filters.regimeType}
          options={regimeOptions}
          onChange={(value) => handleFilterChange('regimeType', value as Filters['regimeType'])}
        />
        <FilterSelect
          label="Risk level"
          value={filters.riskLevel}
          options={tierOptions}
          onChange={(value) => handleFilterChange('riskLevel', value as Filters['riskLevel'])}
        />
      </section>

      <main className="workspace">
        <section className="map-panel">
          <div className="panel-header">
            <div>
              <h2>2D world map</h2>
              <p>Drag to pan, use controls to zoom, and inspect relationship overlays sourced from the active dataset.</p>
            </div>
            <div className="legend">
              {Object.entries(alignmentLabel).map(([key, label]) => (
                <span key={key}>
                  <i style={{ backgroundColor: alignmentColor[key as Alignment] }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="overlay-controls">
            <span>Selected-country overlay</span>
            <div className="overlay-button-row">
              <button
                type="button"
                className={overlayMode === 'none' ? 'active' : ''}
                onClick={() => setOverlayMode('none')}
              >
                None
              </button>
              {(Object.keys(overlayLabel) as RelationshipDimension[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={overlayMode === mode ? 'active' : ''}
                  onClick={() => setOverlayMode(mode)}
                >
                  {formatTitle(mode)}
                </button>
              ))}
            </div>
          </div>

          <div className="map-frame">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="world-map"
              onPointerDown={(event) => setDragStart({ x: event.clientX, y: event.clientY })}
              onPointerMove={handlePointerMove}
              onPointerUp={() => setDragStart(null)}
              onPointerLeave={() => {
                setDragStart(null);
                setHoveredCountry(null);
              }}
            >
              <rect width={width} height={height} fill="#08111f" rx="24" />
              <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
                {countries.map((country) => {
                  const simulatedCountry = byName.get(country.properties.name);
                  const isVisible = simulatedCountry ? visibleNames.has(country.properties.name) : false;
                  const isSelected = selected?.profile.mapName === country.properties.name;
                  const isHovered = hoveredCountry === country.properties.name;
                  const isRelated = relatedCountries.has(country.properties.name);

                  return (
                    <path
                      key={`${country.id ?? country.properties.name}-${country.properties.name}`}
                      d={path(country as never) ?? undefined}
                      fill={simulatedCountry ? alignmentColor[simulatedCountry.alignment] : '#1b2538'}
                      opacity={simulatedCountry ? (isVisible ? 0.95 : 0.18) : 0.38}
                      stroke={
                        isSelected
                          ? '#f8fafc'
                          : isRelated && overlayMode !== 'none'
                            ? overlayColor[overlayMode]
                            : isHovered
                              ? '#a5b4fc'
                              : '#334155'
                      }
                      strokeWidth={isSelected ? 1.8 : isRelated && overlayMode !== 'none' ? 1.4 : 0.65}
                      onPointerEnter={() => setHoveredCountry(country.properties.name)}
                      onPointerLeave={() => setHoveredCountry(null)}
                      onClick={() => {
                        if (simulatedCountry) {
                          setSelectedCountry(country.properties.name);
                        }
                      }}
                    />
                  );
                })}

                {overlayMode !== 'none' &&
                  overlayConnections.map((connection) => (
                    <g key={`${selected.profile.id}-${connection.countryId}-${overlayMode}`} className="relationship-overlay">
                      <line
                        x1={connection.x1}
                        y1={connection.y1}
                        x2={connection.x2}
                        y2={connection.y2}
                        stroke={overlayColor[overlayMode]}
                        strokeWidth={1 + connection.score / 50}
                        strokeOpacity={0.7}
                        strokeDasharray={overlayMode === 'dependency' ? '8 6' : undefined}
                      />
                      <circle cx={connection.x2} cy={connection.y2} r={3.5} fill={overlayColor[overlayMode]} />
                    </g>
                  ))}
              </g>
            </svg>
            {hoveredCountry && (
              <div className="hover-card">
                <strong>{hoveredCountry}</strong>
                <span>
                  {byName.get(hoveredCountry)
                    ? alignmentLabel[byName.get(hoveredCountry)!.alignment]
                    : 'Visible but not yet parameterized'}
                </span>
              </div>
            )}
          </div>
        </section>

        <aside className="details-panel">
          {selected && (
            <>
              <div className="panel-header compact">
                <div>
                  <h2>{selected.profile.displayName}</h2>
                  <p>{selected.profile.allianceNetwork}</p>
                </div>
                <span className={`pill ${selected.alignment}`}>{alignmentLabel[selected.alignment]}</span>
              </div>

              <div className="metric-grid">
                <MetricCard label="Confidence" value={formatPercent(selected.confidence)} />
                <MetricCard label="Escalation risk" value={formatPercent(selected.risk)} tone={getRiskTier(selected.risk)} />
                <MetricCard label="Source coverage" value={formatPercent(selected.profile.sourceCoverage)} />
                <MetricCard label="Last updated" value={selected.profile.lastUpdated} />
              </div>

              <div className="comparison-grid">
                <MetricCard label="Baseline alignment" value={alignmentLabel[baselineSelected.alignment]} />
                <MetricCard label="Risk delta" value={formatSignedPercent(selectedRiskDelta)} tone={getRiskTier(Math.abs(selectedRiskDelta))} />
                <MetricCard label="Confidence delta" value={formatSignedPercent(selectedConfidenceDelta)} />
                <MetricCard label="Weight set" value={activeWeightSet.label} />
              </div>

              <div className="probability-block">
                <h3>Alignment likelihoods</h3>
                {Object.entries(selected.probabilities).map(([key, value]) => {
                  const baselineValue = baselineSelected.probabilities[key as keyof typeof baselineSelected.probabilities];

                  return (
                    <div key={key} className="bar-row">
                      <span>{alignmentLabel[key as Alignment]}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${value}%`, backgroundColor: alignmentColor[key as Alignment] }} />
                      </div>
                      <strong>
                        {value}% <em>{formatSignedPercent(value - baselineValue)}</em>
                      </strong>
                    </div>
                  );
                })}
              </div>

              <div className="relationship-summary-grid">
                <MetricCard label="Cooperation" value={formatPercent(selected.relationshipSummary.cooperation)} />
                <MetricCard label="Hostility" value={formatPercent(selected.relationshipSummary.hostility)} tone={getRiskTier(selected.relationshipSummary.hostility)} />
                <MetricCard label="Dependency" value={formatPercent(selected.relationshipSummary.dependency)} />
                <MetricCard label="Deterrence" value={formatPercent(selected.relationshipSummary.deterrence)} />
              </div>

              <div className="details-stack">
                <section>
                  <h3>Key drivers</h3>
                  <ul>
                    {selected.drivers.map((driver) => (
                      <li key={driver.label}>
                        <span>{driver.label}</span>
                        <strong>{driver.value}</strong>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3>Scenario assumptions</h3>
                  <ul>
                    <li><span>Label</span><strong>{scenarioName}</strong></li>
                    <li><span>Weight set</span><strong>{activeWeightSet.label}</strong></li>
                    <li><span>Sanctions shock</span><strong>{scenarioInputs.sanctionShock}</strong></li>
                    <li><span>Treaty change</span><strong>{formatSignedValue(scenarioInputs.treatyShift)}</strong></li>
                    <li><span>Election volatility</span><strong>{scenarioInputs.electionVolatility}</strong></li>
                    <li><span>Invasion pressure</span><strong>{scenarioInputs.invasionPressure}</strong></li>
                    <li><span>Coup risk</span><strong>{scenarioInputs.coupRisk}</strong></li>
                  </ul>
                </section>

                <section>
                  <h3>Country context</h3>
                  <ul>
                    <li><span>Region</span><strong>{selected.profile.region}</strong></li>
                    <li><span>Subregion</span><strong>{selected.profile.subregion}</strong></li>
                    <li><span>Regime type</span><strong>{selected.profile.regimeType}</strong></li>
                    <li><span>Trade exposure</span><strong>{selected.profile.indicators.tradeExposure}</strong></li>
                    <li><span>Military treaties</span><strong>{selected.profile.indicators.militaryTreatyLevel}</strong></li>
                    <li><span>Border disputes</span><strong>{selected.profile.indicators.borderDisputes}</strong></li>
                    <li><span>Trade dependence</span><strong>{selected.profile.indicators.tradeDependence}</strong></li>
                    <li><span>Regime stability</span><strong>{selected.profile.indicators.regimeStability}</strong></li>
                  </ul>
                </section>

                <section>
                  <h3>Relationship graph</h3>
                  <div className="relationship-list">
                    {selected.profile.relationships.slice(0, 5).map((relationship) => (
                      <article key={relationship.countryId} className="relationship-card">
                        <div className="relationship-card-header">
                          <strong>{relationship.displayName}</strong>
                          <span>{relationship.lastUpdated}</span>
                        </div>
                        <div className="relationship-tags">
                          <span>Coop {relationship.cooperation}%</span>
                          <span>Hostility {relationship.hostility}%</span>
                          <span>Dependency {relationship.dependency}%</span>
                          <span>Deterrence {relationship.deterrence}%</span>
                        </div>
                        <p>{relationship.notes}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section>
                  <h3>Recent trajectory</h3>
                  <ul>
                    {selected.history.map((entry) => (
                      <li key={entry.label}>
                        <span>{entry.label}</span>
                        <strong>
                          {alignmentLabel[entry.alignment]} · {entry.confidence}%
                        </strong>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3>Assumptions</h3>
                  <ul>
                    {selected.profile.assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3>Source attribution</h3>
                  <div className="source-list">
                    {selected.profile.sources.map((source) => (
                      <article key={source.id} className="source-card">
                        <strong>{source.title}</strong>
                        <span>{source.publisher}</span>
                        <span>{source.accessedOn}</span>
                        <a href={source.url} target="_blank" rel="noreferrer">Open source</a>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </aside>
      </main>

      <section className="lower-grid">
        <article className="feed-panel">
          <div className="panel-header compact">
            <div>
              <h2>Scenario event feed</h2>
              <p>Highest-risk modeled shifts in the current time slice.</p>
            </div>
          </div>
          <div className="feed-list">
            {eventFeed.length > 0 ? (
              eventFeed.map((item) => (
                <div key={item.title} className="feed-item">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))
            ) : (
              <div className="feed-item">
                <strong>No countries match the active filters.</strong>
                <p>Reset one or more filters to restore the current scenario feed.</p>
              </div>
            )}
          </div>
        </article>

        <article className="methodology-panel">
          <div className="panel-header compact">
            <div>
              <h2>Trust and methodology</h2>
              <p>Explicit caveats for a prediction-oriented map.</p>
            </div>
          </div>
          <ul className="methodology-list">
            {methodologyNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>

        <article className="scenario-history-panel">
          <div className="panel-header compact">
            <div>
              <h2>Scenario history</h2>
              <p>Saved assumption sets so baseline and edited outcomes stay comparable.</p>
            </div>
          </div>
          <div className="scenario-history-list">
            {savedScenarios.length > 0 ? (
              savedScenarios.map((savedScenario) => {
                const savedWeightSet = getSimulationWeightSet(savedScenario.weightSetKey);

                return (
                  <article key={savedScenario.id} className="scenario-history-card">
                    <div className="relationship-card-header">
                      <strong>{savedScenario.name}</strong>
                      <span>{scenarioTimeline[savedScenario.timelineIndex]}</span>
                    </div>
                    <p>{savedWeightSet.label}</p>
                    <p>{summarizeScenarioInputs(savedScenario.inputs)}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setScenarioName(savedScenario.name);
                        setScenarioInputs({ ...savedScenario.inputs });
                        setWeightSetKey(savedScenario.weightSetKey);
                        setTimelineIndex(savedScenario.timelineIndex);
                      }}
                    >
                      Load scenario
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="feed-item">
                <strong>No saved scenarios yet.</strong>
                <p>Save the current assumptions to compare baseline versus edited outcomes over time.</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
};

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

type ScenarioSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function ScenarioSlider({ label, value, min, max, onChange }: ScenarioSliderProps) {
  return (
    <label className="scenario-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <strong>{value > 0 ? `+${value}` : value}</strong>
    </label>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  tone?: 'low' | 'medium' | 'high';
};

function MetricCard({ label, value, tone }: MetricCardProps) {
  return (
    <div className={`metric-card ${tone ?? ''}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
