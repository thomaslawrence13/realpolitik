import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Alignment,
  EventCategory,
  EventTemplate,
  IngestTelemetry,
  InformationQualityContract,
  InformationQualityTelemetry,
  RegimeType,
  SavedScenario,
  ScenarioInputs,
  SimulatedCountry,
  SimulationWeightSet,
  Tier,
  WeightSetKey,
} from '../types';
import { Slider, SvgIcon, Tabs } from './ui';
import { MoversPanel } from './MoversPanel';
import { summarizeCountryTrust, TrustTag } from './provenance';
import { getRiskTier } from '../simulation';
import { clampTimelineIndex } from '../lib/timeline';
import {
  indicatorQualityRules,
  indicatorSourcePriority,
  relationshipDimensionQualityRules,
  relationshipDimensionSourcePriority,
} from '../data/pipeline/rules';

export type DrawerTab = 'index' | 'movers' | 'methodology' | 'analysis' | 'events' | 'history';

export type EventFeedItem = {
  title: string;
  detail: string;
  tone: 'low' | 'medium' | 'high';
};

type Props = {
  open: boolean;
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  scenarioName: string;
  onScenarioNameChange: (value: string) => void;
  scenarioInputs: ScenarioInputs;
  onScenarioInputChange: <K extends keyof ScenarioInputs>(key: K, value: number) => void;
  activeWeightSet: SimulationWeightSet;
  weightSetKey: WeightSetKey;
  onWeightSetChange: (key: WeightSetKey) => void;
  weightSets: SimulationWeightSet[];
  savedScenarios: SavedScenario[];
  onSaveScenario: () => void;
  onResetScenario: () => void;
  onShareScenario: () => void;
  shareStatus: 'idle' | 'copied' | 'error';
  onLoadScenario: (scenario: SavedScenario) => void;
  onDeleteScenario: (id: string) => void;
  onRenameScenario: (id: string, nextName: string) => void;
  onExportScenarios: (id?: string) => void;
  onImportScenarios: () => void;
  importError: string | null;
  comparisonScenarioId: string | null;
  onToggleComparison: (id: string) => void;
  eventFeed: EventFeedItem[];
  methodologyNotes: string[];
  informationQuality: InformationQualityTelemetry;
  baselineInformationQuality: InformationQualityTelemetry;
  informationQualityContract: InformationQualityContract;
  ingestTelemetry: IngestTelemetry;
  liveDataDiagnostics: {
    totalIndicators: number;
    succeededIndicators: number;
    failedIndicators: number;
    failedCodes: string[];
  } | null;
  scenarioTimeline: string[];
  events: EventTemplate[];
  activeEventIds: string[];
  onApplyEvent: (id: string) => void;
  onRemoveEvent: (id: string) => void;
  onApplyEvents: (ids: string[]) => void;
  onClearAllEvents: () => void;
  onResizeStart: (startClientY: number) => void;
  onResizeStep: (delta: number) => void;
  onResizeTo: (edge: 'min' | 'max') => void;
  movers: {
    active: SimulatedCountry[];
    baselineByName: Map<string, SimulatedCountry>;
    comparisonByName: Map<string, SimulatedCountry> | null;
    comparisonScenarioName: string | null;
    onSelectCountry: (mapName: string) => void;
    alignmentColor: Record<Alignment, string>;
    alignmentLabel: Record<Alignment, string>;
  };
  indexCountries: SimulatedCountry[];
};

export function BottomDrawer({
  open,
  tab,
  onTabChange,
  onClose,
  scenarioName,
  onScenarioNameChange,
  scenarioInputs,
  onScenarioInputChange,
  activeWeightSet,
  weightSetKey,
  onWeightSetChange,
  weightSets,
  savedScenarios,
  onSaveScenario,
  onResetScenario,
  onShareScenario,
  shareStatus,
  onLoadScenario,
  onDeleteScenario,
  onRenameScenario,
  onExportScenarios,
  onImportScenarios,
  importError,
  comparisonScenarioId,
  onToggleComparison,
  eventFeed,
  methodologyNotes,
  informationQuality,
  baselineInformationQuality,
  informationQualityContract,
  ingestTelemetry,
  liveDataDiagnostics,
  scenarioTimeline,
  events,
  activeEventIds,
  onApplyEvent,
  onRemoveEvent,
  onApplyEvents,
  onClearAllEvents,
  onResizeStart,
  onResizeStep,
  onResizeTo,
  movers,
  indexCountries,
}: Props) {
  return (
    <section className={`drawer ${open ? 'drawer-open' : 'drawer-closed'}`} aria-hidden={!open}>
      {/* Drag handle — lets the user resize the drawer by dragging its top edge.
          Keyboard: ↑ expands, ↓ shrinks (20 px per step). */}
      <div
        className="drawer-resize-handle"
        role="separator"
        aria-label="Resize panel"
        aria-orientation="horizontal"
        tabIndex={0}
        onMouseDown={(e) => { e.preventDefault(); onResizeStart(e.clientY); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); onResizeStep(20); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onResizeStep(-20); }
          if (e.key === 'Home') { e.preventDefault(); onResizeTo('min'); }
          if (e.key === 'End') { e.preventDefault(); onResizeTo('max'); }
        }}
      />
      <header className="drawer-header">
        <Tabs<DrawerTab>
          value={tab}
          onChange={onTabChange}
          options={[
            { value: 'index', label: 'Index' },
            { value: 'movers', label: 'Movers' },
            { value: 'methodology', label: 'Methodology' },
            { value: 'analysis', label: 'Analysis' },
            { value: 'events', label: 'Events', count: activeEventIds.length > 0 ? activeEventIds.length : undefined },
            { value: 'history', label: 'History', count: savedScenarios.length },
          ]}
        />
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close drawer">
          <SvgIcon.X />
        </button>
      </header>

      <div className="drawer-body">
        {tab === 'analysis' && (
          <ScenarioPanel
            scenarioName={scenarioName}
            onScenarioNameChange={onScenarioNameChange}
            scenarioInputs={scenarioInputs}
            onScenarioInputChange={onScenarioInputChange}
            activeWeightSet={activeWeightSet}
            weightSetKey={weightSetKey}
            onWeightSetChange={onWeightSetChange}
            weightSets={weightSets}
            onSaveScenario={onSaveScenario}
            onResetScenario={onResetScenario}
            onShareScenario={onShareScenario}
            shareStatus={shareStatus}
          />
        )}

        {tab === 'events' && (
          <EventsPanel
            events={events}
            activeEventIds={activeEventIds}
            onApply={onApplyEvent}
            onRemove={onRemoveEvent}
            onApplyMany={onApplyEvents}
            onClearAll={onClearAllEvents}
            scenarioFeed={eventFeed}
          />
        )}

        {tab === 'movers' && (
          <MoversPanel
            active={movers.active}
            baselineByName={movers.baselineByName}
            comparisonByName={movers.comparisonByName}
            comparisonScenarioName={movers.comparisonScenarioName}
            onSelectCountry={movers.onSelectCountry}
            alignmentColor={movers.alignmentColor}
            alignmentLabel={movers.alignmentLabel}
          />
        )}

        {tab === 'index' && <IndexPanel countries={indexCountries} onSelectCountry={movers.onSelectCountry} />}

        {tab === 'history' && (
          <HistoryPanel
            scenarios={savedScenarios}
            timeline={scenarioTimeline}
            weightSets={weightSets}
            onLoad={onLoadScenario}
            onDelete={onDeleteScenario}
            onRename={onRenameScenario}
            onExport={onExportScenarios}
            onImport={onImportScenarios}
            importError={importError}
            comparisonScenarioId={comparisonScenarioId}
            onToggleCompare={onToggleComparison}
          />
        )}

        {tab === 'methodology' && (
          <MethodologyPanel
            notes={methodologyNotes}
            informationQuality={informationQuality}
            baselineInformationQuality={baselineInformationQuality}
            informationQualityContract={informationQualityContract}
            ingestTelemetry={ingestTelemetry}
            liveDataDiagnostics={liveDataDiagnostics}
          />
        )}
      </div>
    </section>
  );
}

type IndexMetric = 'coverage' | 'confidence' | 'risk';
const maxComparisonCountries = 4;

const CSV_COLUMNS = ['Country', 'Region', 'Regime', 'Coverage%', 'Confidence%', 'Risk%', 'Relationships', 'Trust'] as const;

const exportIndexCsv = (rows: SimulatedCountry[]) => {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = CSV_COLUMNS.join(',');
  const body = rows.map((country) => {
    const trust = summarizeCountryTrust(country.profile);
    return [
      escape(country.profile.displayName),
      escape(country.profile.region),
      escape(country.profile.regimeType),
      String(country.profile.sourceCoverage),
      String(country.confidence),
      String(country.risk),
      String(country.profile.relationships.length),
      escape(trust.label),
    ].join(',');
  });
  const csv = [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `realpolitik-index-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function IndexPanel({
  countries,
  onSelectCountry,
}: {
  countries: SimulatedCountry[];
  onSelectCountry: (mapName: string) => void;
}) {
  const [metric, setMetric] = useState<IndexMetric>('coverage');
  // Use a Set for O(1) selection checks; expose ordered array for rendering.
  const [selectedIdSet, setSelectedIdSet] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<'all' | string>('all');
  const [trustFilter, setTrustFilter] = useState<'all' | 'good' | 'warning' | 'bad'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | Tier>('all');
  const [regimeFilter, setRegimeFilter] = useState<'all' | RegimeType>('all');

  const availableRegions = useMemo(
    () => [...new Set(countries.map((country) => country.profile.region))].sort((left, right) => left.localeCompare(right)),
    [countries],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return countries.filter((country) => {
      const trust = summarizeCountryTrust(country.profile);
      const matchesQuery =
        query.length === 0 ||
        country.profile.displayName.toLowerCase().includes(query) ||
        country.profile.region.toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (regionFilter !== 'all' && country.profile.region !== regionFilter) return false;
      if (trustFilter !== 'all' && trust.tone !== trustFilter) return false;
      if (riskFilter !== 'all' && getRiskTier(country.risk) !== riskFilter) return false;
      if (regimeFilter !== 'all' && country.profile.regimeType !== regimeFilter) return false;
      return true;
    });
  }, [countries, regionFilter, regimeFilter, riskFilter, search, trustFilter]);

  const ranked = useMemo(() => {
    const next = filtered.slice();
    next.sort((left, right) => {
      if (metric === 'coverage') {
        return right.profile.sourceCoverage - left.profile.sourceCoverage || left.profile.displayName.localeCompare(right.profile.displayName);
      }
      if (metric === 'confidence') {
        return right.confidence - left.confidence || left.profile.displayName.localeCompare(right.profile.displayName);
      }
      return right.risk - left.risk || left.profile.displayName.localeCompare(right.profile.displayName);
    });
    return next;
  }, [filtered, metric]);

  // Build Set of valid IDs from current ranked list.
  const rankedIdSet = useMemo(() => new Set(ranked.map((c) => c.profile.id)), [ranked]);

  const compared = useMemo(
    () =>
      [...selectedIdSet]
        .filter((id) => rankedIdSet.has(id))
        .map((countryId) => ranked.find((country) => country.profile.id === countryId))
        .filter((country): country is SimulatedCountry => Boolean(country)),
    [ranked, rankedIdSet, selectedIdSet],
  );

  const activeFilterCount = [regionFilter, trustFilter, riskFilter, regimeFilter].filter((value) => value !== 'all').length;

  useEffect(() => {
    // Prune selection when the ranked list changes.
    setSelectedIdSet((current) => {
      const pruned = new Set([...current].filter((id) => rankedIdSet.has(id)));
      return pruned.size === current.size ? current : pruned;
    });
  }, [rankedIdSet]);

  const toggleCountry = (countryId: string) => {
    setSelectedIdSet((current) => {
      const next = new Set(current);
      if (next.has(countryId)) {
        next.delete(countryId);
      } else {
        // FIFO eviction: JavaScript Sets maintain insertion order, so
        // `values().next().value` always returns the oldest (first inserted) entry.
        while (next.size >= maxComparisonCountries) {
          const oldest = next.values().next().value;
          // Defensive guard; should never occur because loop condition implies non-empty Set.
          if (oldest === undefined) break;
          next.delete(oldest);
        }
        next.add(countryId);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setSearch('');
    setRegionFilter('all');
    setTrustFilter('all');
    setRiskFilter('all');
    setRegimeFilter('all');
  };

  const matrixRows = [
    { label: 'Coverage', value: (country: SimulatedCountry) => `${country.profile.sourceCoverage}%` },
    { label: 'Confidence', value: (country: SimulatedCountry) => `${country.confidence}%` },
    { label: 'Risk', value: (country: SimulatedCountry) => `${country.risk}%` },
    { label: 'Relationships', value: (country: SimulatedCountry) => String(country.profile.relationships.length) },
    { label: 'Trust', value: (country: SimulatedCountry) => summarizeCountryTrust(country.profile).label },
  ];

  return (
    <div className="index-panel">
      <div className="index-toolbar">
        <div>
          <strong>Factual index</strong>
          <p className="movers-empty">Search, filter, and compare a small cohort before jumping into the inspector.</p>
        </div>
        <div className="index-toolbar-actions">
          <label className="index-toolbar-field">
            <span>Rank by</span>
            <select value={metric} onChange={(event) => setMetric(event.target.value as IndexMetric)}>
              <option value="coverage">Coverage</option>
              <option value="confidence">Confidence</option>
              <option value="risk">Risk</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => exportIndexCsv(ranked)}
            title="Export visible countries as CSV"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="index-summary-grid">
        <article className="index-summary-card">
          <span>Visible countries</span>
          <strong>{ranked.length}</strong>
        </article>
        <article className="index-summary-card">
          <span>Compared</span>
          <strong>{compared.length} / {maxComparisonCountries}</strong>
        </article>
        <article className="index-summary-card">
          <span>Filters</span>
          <strong>{search.length > 0 ? activeFilterCount + 1 : activeFilterCount}</strong>
        </article>
      </div>

      <div className="index-filter-grid">
        <label className="index-toolbar-field index-search-field">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Country or region…"
            spellCheck={false}
          />
        </label>
        <label className="index-toolbar-field">
          <span>Region</span>
          <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
            <option value="all">All regions</option>
            {availableRegions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <label className="index-toolbar-field">
          <span>Trust</span>
          <select value={trustFilter} onChange={(event) => setTrustFilter(event.target.value as typeof trustFilter)}>
            <option value="all">All trust states</option>
            <option value="good">Observed data</option>
            <option value="warning">Quality notice</option>
            <option value="bad">Low trust</option>
          </select>
        </label>
        <label className="index-toolbar-field">
          <span>Risk tier</span>
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}>
            <option value="all">All tiers</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="index-toolbar-field">
          <span>Regime</span>
          <select value={regimeFilter} onChange={(event) => setRegimeFilter(event.target.value as typeof regimeFilter)}>
            <option value="all">All regimes</option>
            <option value="democracy">Democracy</option>
            <option value="hybrid">Hybrid</option>
            <option value="authoritarian">Authoritarian</option>
          </select>
        </label>
        {(search.length > 0 || activeFilterCount > 0) && (
          <button type="button" className="btn btn-ghost btn-sm index-reset-btn" onClick={resetFilters}>
            <SvgIcon.Reset />
            Reset
          </button>
        )}
      </div>

      <div className="index-layout">
        <section className="index-list-section">
          <h3 className="movers-section-title">Country rankings</h3>
          {ranked.length === 0 ? (
            <div className="empty-state">
              <strong>No countries match</strong>
              <p>Try broadening the search or clearing one of the active filters.</p>
            </div>
          ) : (
            <div className="index-list">
              {ranked.map((country, index) => {
                const trust = summarizeCountryTrust(country.profile);
                return (
                  <button
                    key={country.profile.id}
                    type="button"
                    className={`index-row ${selectedIdSet.has(country.profile.id) ? 'index-row-active' : ''}`}
                    onClick={() => toggleCountry(country.profile.id)}
                  >
                    <span className="index-rank">#{index + 1}</span>
                    <span className="index-main">
                      <span className="index-main-row">
                        <strong>{country.profile.displayName}</strong>
                        <TrustTag summary={trust} />
                      </span>
                      <span className="index-sub">
                        {country.profile.region} · {country.profile.regimeType} · Risk {getRiskTier(country.risk)}
                      </span>
                      <span className="index-sub">{trust.detail}</span>
                    </span>
                    <span className="index-score">
                      {metric === 'coverage' ? `${country.profile.sourceCoverage}%` : metric === 'confidence' ? `${country.confidence}%` : `${country.risk}%`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="index-compare-section">
          <h3 className="movers-section-title">Compare countries</h3>
          {compared.length === 0 ? (
            <p className="movers-empty">Select up to {maxComparisonCountries} countries from the ranking to compare trust, risk, confidence, and relationship density.</p>
          ) : (
            <>
              <div className="index-compare-grid">
                {compared.map((country) => {
                  const trust = summarizeCountryTrust(country.profile);
                  return (
                    <article key={country.profile.id} className="methodology-priority-card index-compare-card">
                      <header>
                        <strong>{country.profile.displayName}</strong>
                        <TrustTag summary={trust} />
                      </header>
                      <p>{country.profile.region} · {country.profile.regimeType} · updated {country.profile.lastUpdated}</p>
                      <p>Coverage {country.profile.sourceCoverage}% · Confidence {country.confidence}% · Risk {country.risk}%</p>
                      <p>Relationships {country.profile.relationships.length} · {trust.detail}</p>
                      <div className="index-compare-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelectCountry(country.profile.mapName)}>
                          Open inspector
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleCountry(country.profile.id)}>
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {compared.length > 1 && (
                <div className="index-matrix-wrap">
                  <h4 className="index-matrix-title">Comparison matrix</h4>
                  <div className="index-matrix-scroll">
                    <table className="index-matrix">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          {compared.map((country) => (
                            <th key={country.profile.id}>{country.profile.displayName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrixRows.map((row) => (
                          <tr key={row.label}>
                            <th>{row.label}</th>
                            {compared.map((country) => (
                              <td key={`${row.label}-${country.profile.id}`}>{row.value(country)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ScenarioPanel({
  scenarioName,
  onScenarioNameChange,
  scenarioInputs,
  onScenarioInputChange,
  activeWeightSet,
  weightSetKey,
  onWeightSetChange,
  weightSets,
  onSaveScenario,
  onResetScenario,
  onShareScenario,
  shareStatus,
}: {
  scenarioName: string;
  onScenarioNameChange: (v: string) => void;
  scenarioInputs: ScenarioInputs;
  onScenarioInputChange: <K extends keyof ScenarioInputs>(key: K, value: number) => void;
  activeWeightSet: SimulationWeightSet;
  weightSetKey: WeightSetKey;
  onWeightSetChange: (key: WeightSetKey) => void;
  weightSets: SimulationWeightSet[];
  onSaveScenario: () => void;
  onResetScenario: () => void;
  onShareScenario: () => void;
  shareStatus: 'idle' | 'copied' | 'error';
}) {
  const shareLabel: Record<'idle' | 'copied' | 'error', ReactNode> = {
    idle: 'Share link',
    copied: 'Copied!',
    error: 'Copy failed',
  };
  const shareTitle: Record<'idle' | 'copied' | 'error', string> = {
    idle: 'Copy a URL that opens this scenario',
    copied: 'Link copied to clipboard',
    error: 'Could not access the clipboard',
  };
  return (
    <div className="scenario-panel">
      <div className="scenario-disclaimer">
        <strong>Analysis tools</strong>
        <p>Adjust shock parameters and weight sets to model hypothetical conditions. These are not forecasts — all outputs are model-derived from indicator inputs.</p>
      </div>
      <div className="scenario-meta">
        <label className="field">
          <span>Analysis label</span>
          <input
            value={scenarioName}
            onChange={(event) => onScenarioNameChange(event.target.value)}
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>Weight set</span>
          <select
            value={weightSetKey}
            onChange={(event) => onWeightSetChange(event.target.value as WeightSetKey)}
          >
            {weightSets.map((weightSet) => (
              <option key={weightSet.key} value={weightSet.key}>
                {weightSet.label}
              </option>
            ))}
          </select>
        </label>
        <div className="scenario-meta-card">
          <span>Active weighting</span>
          <strong>{activeWeightSet.label}</strong>
          <p>{activeWeightSet.description}</p>
        </div>
        <div className="scenario-actions">
          <button type="button" className="btn btn-ghost" onClick={onResetScenario}>
            <SvgIcon.Reset />
            Reset
          </button>
          <button
            type="button"
            className={`btn btn-ghost share-btn ${shareStatus !== 'idle' ? `share-btn-${shareStatus}` : ''}`}
            onClick={onShareScenario}
            title={shareTitle[shareStatus]}
          >
            {shareLabel[shareStatus]}
          </button>
          <button type="button" className="btn btn-primary" onClick={onSaveScenario}>
            Save analysis
          </button>
        </div>
      </div>

      <div className="scenario-sliders">
        <Slider
          label="Sanctions shock"
          value={scenarioInputs.sanctionShock}
          min={0}
          max={100}
          onChange={(v) => onScenarioInputChange('sanctionShock', v)}
        />
        <Slider
          label="Treaty change"
          value={scenarioInputs.treatyShift}
          min={-60}
          max={60}
          onChange={(v) => onScenarioInputChange('treatyShift', v)}
        />
        <Slider
          label="Election volatility"
          value={scenarioInputs.electionVolatility}
          min={0}
          max={100}
          onChange={(v) => onScenarioInputChange('electionVolatility', v)}
        />
        <Slider
          label="Invasion pressure"
          value={scenarioInputs.invasionPressure}
          min={0}
          max={100}
          onChange={(v) => onScenarioInputChange('invasionPressure', v)}
        />
        <Slider
          label="Coup risk"
          value={scenarioInputs.coupRisk}
          min={0}
          max={100}
          onChange={(v) => onScenarioInputChange('coupRisk', v)}
        />
      </div>
    </div>
  );
}

const INPUT_LABELS: Record<string, string> = {
  sanctionShock: 'Sanctions',
  treatyShift: 'Treaty',
  electionVolatility: 'Election',
  invasionPressure: 'Invasion',
  coupRisk: 'Coup',
};

function EventsPanel({
  events,
  activeEventIds,
  onApply,
  onRemove,
  onApplyMany,
  onClearAll,
  scenarioFeed,
}: {
  events: EventTemplate[];
  activeEventIds: string[];
  onApply: (id: string) => void;
  onRemove: (id: string) => void;
  onApplyMany: (ids: string[]) => void;
  onClearAll: () => void;
  scenarioFeed: EventFeedItem[];
}) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | EventCategory>('all');
  const [search, setSearch] = useState('');

  // O(1) active-event lookup for the potentially large event grid.
  const activeSet = useMemo(() => new Set(activeEventIds), [activeEventIds]);

  const categories: Array<{ value: 'all' | EventCategory; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'military', label: 'Military' },
    { value: 'economic', label: 'Economic' },
    { value: 'political', label: 'Political' },
    { value: 'compound', label: 'Compound' },
  ];

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      if (categoryFilter !== 'all' && event.category !== categoryFilter) return false;
      if (query.length === 0) return true;
      return (
        event.name.toLowerCase().includes(query) ||
        event.summary.toLowerCase().includes(query) ||
        event.regionTags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [categoryFilter, events, search]);

  const formatDelta = (key: string, value: number) => {
    const signed = value > 0 ? `+${value}` : `${value}`;
    return `${INPUT_LABELS[key] ?? key} ${signed}`;
  };

  const visibleInactiveIds = useMemo(
    () => visible.filter((event) => !activeSet.has(event.id)).map((event) => event.id),
    [activeSet, visible],
  );

  return (
    <div className="events-panel">
      <div className="events-filter-bar">
        {categories.map((cat) => (
          <button
            key={cat.value}
            type="button"
            className={`event-cat-chip ${categoryFilter === cat.value ? 'event-cat-chip-active' : ''}`}
            onClick={() => setCategoryFilter(cat.value)}
          >
            {cat.label}
          </button>
        ))}
        {activeEventIds.length > 0 && (
          <span className="events-active-badge">{activeEventIds.length} active</span>
        )}
      </div>

      <div className="events-bulk-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onApplyMany(visibleInactiveIds)}
          disabled={visibleInactiveIds.length === 0}
          title="Apply all currently visible events that are not active"
        >
          Apply visible ({visibleInactiveIds.length})
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onClearAll}
          disabled={activeEventIds.length === 0}
          title="Clear all currently active events"
        >
          Clear active ({activeEventIds.length})
        </button>
      </div>

      <label className="events-search">
        <span className="sr-only">Search events</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, region, or keyword…"
          spellCheck={false}
        />
        {search.length > 0 && (
          <button type="button" className="events-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
            <SvgIcon.X />
          </button>
        )}
      </label>

      {visible.length === 0 ? (
        <p className="movers-empty">No events match — try adjusting your search or category filter.</p>
      ) : (
        <div className="events-grid">
          {visible.map((event) => {
            const isActive = activeSet.has(event.id);
            const deltaItems = (Object.entries(event.inputs) as Array<[string, number]>).filter(
              ([, v]) => v !== 0,
            );
            return (
              <article key={event.id} className={`event-card ${isActive ? 'event-card-active' : ''}`}>
                <header className="event-card-header">
                  <span className={`event-category-tag event-category-${event.category}`}>
                    {event.category}
                  </span>
                  <button
                    type="button"
                    className={`btn ${isActive ? 'btn-ghost event-btn-remove' : 'btn-primary'} btn-sm`}
                    onClick={() => (isActive ? onRemove(event.id) : onApply(event.id))}
                  >
                    {isActive ? 'Remove' : 'Apply'}
                  </button>
                </header>
                <strong className="event-card-name">{event.name}</strong>
                <p className="event-card-summary">{event.summary}</p>
                <div className="event-deltas">
                  {deltaItems.map(([key, value]) => (
                    <span key={key} className={`event-delta ${value > 0 ? 'event-delta-up' : 'event-delta-down'}`}>
                      {formatDelta(key, value)}
                    </span>
                  ))}
                </div>
                {event.regionTags.length > 0 && (
                  <div className="event-regions">
                    {event.regionTags.map((tag) => (
                      <span key={tag} className="event-region-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {scenarioFeed.length > 0 && (
        <div className="events-impact-section">
          <h3 className="events-impact-title">Analysis impact — top pressures</h3>
          <div className="feed">
            {scenarioFeed.map((item) => (
              <article key={item.title} className={`feed-item feed-item-${item.tone}`}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  scenarios,
  timeline,
  weightSets,
  onLoad,
  onDelete,
  onRename,
  onExport,
  onImport,
  importError,
  comparisonScenarioId,
  onToggleCompare,
}: {
  scenarios: SavedScenario[];
  timeline: string[];
  weightSets: SimulationWeightSet[];
  onLoad: (s: SavedScenario) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onExport: (id?: string) => void;
  onImport: () => void;
  importError: string | null;
  comparisonScenarioId: string | null;
  onToggleCompare: (id: string) => void;
}) {
  return (
    <div className="history-wrap">
      <div className="history-toolbar">
        <div className="history-toolbar-meta">
          <strong>Saved analyses</strong>
          <span>{scenarios.length} saved</span>
        </div>
        <div className="history-toolbar-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onImport}>
            <SvgIcon.Plus />
            Import JSON
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onExport()}
            disabled={scenarios.length === 0}
          >
            Export all
          </button>
        </div>
      </div>

      {importError && (
        <div className="callout callout-warning history-import-error">
          <strong>Could not import scenarios</strong>
          <p>{importError}</p>
        </div>
      )}

      {scenarios.length === 0 ? (
        <div className="empty-state">
          <strong>No saved analyses yet</strong>
          <p>Save the current assumptions, or import a JSON file to get started.</p>
        </div>
      ) : (
        <div className="history">
          {scenarios.map((scenario) => (
            <HistoryCard
              key={scenario.id}
              scenario={scenario}
              timeline={timeline}
              weightSets={weightSets}
              onLoad={onLoad}
              onDelete={onDelete}
              onRename={onRename}
              onExport={onExport}
              isComparison={comparisonScenarioId === scenario.id}
              onToggleCompare={onToggleCompare}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  scenario,
  timeline,
  weightSets,
  onLoad,
  onDelete,
  onRename,
  onExport,
  isComparison,
  onToggleCompare,
}: {
  scenario: SavedScenario;
  timeline: string[];
  weightSets: SimulationWeightSet[];
  onLoad: (s: SavedScenario) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onExport: (id?: string) => void;
  isComparison: boolean;
  onToggleCompare: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(scenario.name);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  const commitRename = () => {
    const next = draftName.trim();
    if (next && next !== scenario.name) {
      onRename(scenario.id, next);
    } else {
      setDraftName(scenario.name);
    }
    setRenaming(false);
  };

  const cancelRename = () => {
    setDraftName(scenario.name);
    setRenaming(false);
  };

  const weightSet = weightSets.find((entry) => entry.key === scenario.weightSetKey);
  const summaryItems = [
    { abbr: 'S', label: 'Sanctions', value: scenario.inputs.sanctionShock, signed: false },
    { abbr: 'T', label: 'Treaty', value: scenario.inputs.treatyShift, signed: true },
    { abbr: 'E', label: 'Election', value: scenario.inputs.electionVolatility, signed: false },
    { abbr: 'I', label: 'Invasion', value: scenario.inputs.invasionPressure, signed: false },
    { abbr: 'C', label: 'Coup', value: scenario.inputs.coupRisk, signed: false },
  ];
  return (
    <article className={`history-card ${isComparison ? 'history-card-compare' : ''}`}>
      <header>
        {renaming ? (
          <input
            ref={renameInputRef}
            className="history-rename-input"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitRename();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelRename();
              }
            }}
            spellCheck={false}
            aria-label="Rename scenario"
          />
        ) : (
          <button
            type="button"
            className="history-rename-trigger"
            onClick={() => setRenaming(true)}
            title="Click to rename"
          >
            <strong>{scenario.name}</strong>
          </button>
        )}
        <span>{timeline[clampTimelineIndex(scenario.timelineIndex, timeline.length)]}</span>
      </header>
      <div className="history-card-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p>{weightSet?.label ?? 'Custom weighting'}</p>
        <p className="history-saved-at" style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>
          {scenario.savedAt ? `Saved ${new Date(scenario.savedAt).toLocaleDateString()}` : ''}
        </p>
      </div>
      <div className="history-summary-chips">
        {summaryItems.map(({ abbr, label, value, signed }) => (
          <span
            key={abbr}
            className={`history-input-chip ${value !== 0 ? 'history-input-chip-active' : ''}`}
            title={`${label}: ${signed && value > 0 ? '+' : ''}${value}`}
          >
            <em>{abbr}</em>
            <strong>{signed && value > 0 ? '+' : ''}{value}</strong>
          </span>
        ))}
      </div>
      <div className="history-card-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onLoad(scenario)}>
          Load
        </button>
        <button
          type="button"
          className={`btn btn-sm ${isComparison ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onToggleCompare(scenario.id)}
          title={isComparison ? 'Stop comparing this scenario' : 'Pin as comparison track'}
        >
          {isComparison ? 'Comparing' : 'Compare'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onExport(scenario.id)}
          title="Download this scenario as JSON"
        >
          Export
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm history-delete-btn"
          onClick={() => onDelete(scenario.id)}
          aria-label={`Delete ${scenario.name}`}
          title="Delete scenario"
        >
          <SvgIcon.X />
        </button>
      </div>
    </article>
  );
}

function MethodologyPanel({
  notes,
  informationQuality,
  baselineInformationQuality,
  informationQualityContract,
  ingestTelemetry,
  liveDataDiagnostics,
}: {
  notes: string[];
  informationQuality: InformationQualityTelemetry;
  baselineInformationQuality: InformationQualityTelemetry;
  informationQualityContract: InformationQualityContract;
  ingestTelemetry: IngestTelemetry;
  liveDataDiagnostics: {
    totalIndicators: number;
    succeededIndicators: number;
    failedIndicators: number;
    failedCodes: string[];
  } | null;
}) {
  const priorityCountries = informationQuality.weakestInformationCountries.slice(0, 8);
  const pipelineReconciliation = Object.entries(indicatorSourcePriority).map(([indicator, priority]) => ({
    key: indicator,
    label: indicator,
    priority,
  }));
  const relationshipReconciliation = Object.entries(relationshipDimensionSourcePriority).map(([dimension, priority]) => ({
    key: dimension,
    label: dimension,
    priority,
  }));
  const indicatorCadence = Object.entries(indicatorQualityRules).map(([indicator, rule]) => ({
    key: indicator,
    label: indicator,
    cadence: rule.cadence,
    staleAfterDays: rule.staleAfterDays,
    minimumConfidence: rule.minimumConfidence,
  }));
  const relationshipCadence = Object.entries(relationshipDimensionQualityRules).map(([dimension, rule]) => ({
    key: dimension,
    label: dimension,
    cadence: rule.cadence,
    staleAfterDays: rule.staleAfterDays,
    minimumConfidence: rule.minimumConfidence,
  }));
  const revisionEntries = notes
    .map((note) => {
      const match = note.match(/^(v\d+)\s*\(([^)]+)\):\s*(.+)$/i);
      if (!match) return null;
      return {
        version: match[1]!.toUpperCase(),
        scope: match[2]!,
        detail: match[3]!,
      };
    })
    .filter((entry): entry is { version: string; scope: string; detail: string } => Boolean(entry))
    .reverse();
  const methodologyFormulas = [
    'Tier thresholds: low/medium/high are mapped through pipeline transforms before model scoring.',
    'Cohesion transform = baseline + GDP growth uplift − inflation penalty − unemployment penalty (bounded to 0–100).',
    'Risk/pressure and confidence are model-derived from indicator stack + relationship dimensions + period offset.',
    'Historical trend baselines use period means of earlier observations, then compare current period versus that baseline.',
  ];
  const knownLimitations = [
    'Observed coverage varies by indicator and country; low-coverage or stale metrics trigger fallback evidence classes.',
    'Some relationship edges are derived rather than directly observed and are tagged lower confidence.',
    'Simulation outputs are analytical model outputs and should not be interpreted as deterministic forecasts.',
  ];
  const staticRuntimeScoreDelta =
    Math.round(
      Math.abs(informationQuality.averageInformationScore - baselineInformationQuality.averageInformationScore) * 10,
    ) / 10;
  return (
    <div className="methodology-panel">
      <section className="scenario-meta-card">
        <strong>Information-quality contract baseline</strong>
        <p className="methodology-telemetry-line">
          Contract {informationQualityContract.contractVersion} · Scoring {informationQualityContract.scoringVersion}
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          Runtime avg {informationQuality.averageInformationScore} · Static avg {baselineInformationQuality.averageInformationScore} · Δ {staticRuntimeScoreDelta}
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          KPI status: avg {informationQuality.kpiStatus.averageInformationScoreWithinTarget ? '✓' : '✕'} · low-quality {informationQuality.kpiStatus.lowQualityCountWithinTarget ? '✓' : '✕'} · stale {informationQuality.kpiStatus.staleCountryCountWithinTarget ? '✓' : '✕'} · layer consistency {informationQuality.kpiStatus.staticRuntimeScoreDeltaWithinTarget ? '✓' : '✕'}
        </p>
        {liveDataDiagnostics && liveDataDiagnostics.failedIndicators > 0 && (
          <p className="methodology-telemetry-line methodology-telemetry-line-tight">
            Live ingest impact: {liveDataDiagnostics.failedIndicators}/{liveDataDiagnostics.totalIndicators} live indicators failed ({liveDataDiagnostics.failedCodes.join(', ')}).
          </p>
        )}
      </section>
      <section className="scenario-meta-card">
        <strong>Evidence-class legend</strong>
        <p className="methodology-telemetry-line">
          Every indicator is tagged as one of: observed, estimated, derived, or fallback.
        </p>
        <div className="methodology-priority-gaps methodology-evidence-gaps">
          <span>Observed: direct external source signal</span>
          <span>Estimated: curated snapshot with acceptable quality</span>
          <span>Derived: computed from cross-source transforms</span>
          <span>Fallback: stale or low-confidence replacement</span>
        </div>
      </section>
      <ul className="methodology-list">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <section className="scenario-meta-card">
        <strong>Indicator formulas & transform rules</strong>
        <ul className="methodology-mini-list">
          {methodologyFormulas.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>
      <section className="scenario-meta-card">
        <strong>Information quality telemetry</strong>
        <p className="methodology-telemetry-line">
          Runtime assessed {new Date(informationQuality.assessedAt).toLocaleDateString()} · Average score {informationQuality.averageInformationScore}
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          High quality: {informationQuality.highQualityCount} · Low quality: {informationQuality.lowQualityCount} · Stale records: {informationQuality.staleCountryCount}
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          Targets → Avg ≥ {informationQuality.kpiTargets.minimumAverageInformationScore} · Low-quality ≤ {informationQuality.kpiTargets.maximumLowQualityCountries} · Stale ≤ {informationQuality.kpiTargets.maximumStaleCountries}
        </p>
        <div className="methodology-priority-targets">
          <strong className="methodology-priority-label">Priority refresh targets:</strong>{' '}
          {priorityCountries
            .slice(0, 5)
            .map((country) => `${country.displayName} (${country.informationScore})`)
            .join(', ')}
        </div>
        <div className="methodology-priority-grid">
          {priorityCountries.map((country) => (
            <article key={country.countryId} className="methodology-priority-card">
              <header>
                <strong>{country.displayName}</strong>
                <span className="methodology-priority-score">{country.informationScore}</span>
              </header>
              <p>
                Coverage {country.sourceCoverage}% · Completeness {Math.round(country.completeness * 100)}%
                {country.stale ? ` · ${country.yearsStale}y stale` : ''} · Fallback {country.fallbackIndicatorCount} · Low confidence {country.lowConfidenceIndicatorCount}
              </p>
              {country.gaps.length > 0 && (
                <div className="methodology-priority-gaps">
                  {country.gaps.slice(0, 3).map((gap) => (
                    <span key={`${country.countryId}-${gap}`}>{gap}</span>
                  ))}
                </div>
              )}
              {country.remediationDrivers.length > 0 && (
                <p className="methodology-telemetry-line methodology-telemetry-line-tight">
                  {country.remediationDrivers[0]}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Quality output inventory</strong>
        <div className="methodology-priority-grid">
          {informationQualityContract.outputs.map((entry) => (
            <article key={`quality-output-${entry.key}`} className="methodology-priority-card">
              <header>
                <strong>{entry.key}</strong>
                <span className="methodology-priority-score">{entry.origin}</span>
              </header>
              <p>{entry.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Source reconciliation priority rules</strong>
        <p className="methodology-telemetry-line">
          Conflicts are resolved by source rank, then confidence, then recency.
        </p>
        <div className="methodology-priority-grid">
          {pipelineReconciliation.map((entry) => (
            <article key={`indicator-priority-${entry.key}`} className="methodology-priority-card">
              <header>
                <strong>{entry.label}</strong>
                <span className="methodology-priority-score">indicator</span>
              </header>
              <p>{entry.priority.join(' → ')}</p>
            </article>
          ))}
          {relationshipReconciliation.map((entry) => (
            <article key={`relationship-priority-${entry.key}`} className="methodology-priority-card">
              <header>
                <strong>{entry.label}</strong>
                <span className="methodology-priority-score">relationship</span>
              </header>
              <p>{entry.priority.join(' → ')}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Ingest coverage telemetry</strong>
        <p className="methodology-telemetry-line">
          Generated {new Date(ingestTelemetry.generatedAt).toLocaleDateString()} · Average indicator coverage {ingestTelemetry.averageCoveragePct}%
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          Provider: {ingestTelemetry.provider} · Requested countries: {ingestTelemetry.requestedCountryCount}
        </p>
        <div className="methodology-priority-grid">
          {ingestTelemetry.strongestIndicators.map((indicator) => (
            <article key={`strong-${indicator.snapshotKey}`} className="methodology-priority-card">
              <header>
                <strong>{indicator.label}</strong>
                <span className="methodology-priority-score">{indicator.coverageCount}</span>
              </header>
              <p>Strongest coverage · Missing {indicator.missingCountryCount} · Latest {indicator.newestObservation ?? 'n/a'}</p>
            </article>
          ))}
          {ingestTelemetry.weakestIndicators.map((indicator) => (
            <article key={`weak-${indicator.snapshotKey}`} className="methodology-priority-card">
              <header>
                <strong>{indicator.label}</strong>
                <span className="methodology-priority-score">{indicator.coverageCount}</span>
              </header>
              <p>Weakest coverage · Missing {indicator.missingCountryCount} · Latest {indicator.newestObservation ?? 'n/a'}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Refresh cadence & quality floors</strong>
        <p className="methodology-telemetry-line">
          Quality notices appear when data age exceeds SLA or confidence falls below minimum thresholds.
        </p>
        <div className="methodology-priority-grid">
          {indicatorCadence.map((entry) => (
            <article key={`cadence-indicator-${entry.key}`} className="methodology-priority-card">
              <header>
                <strong>{entry.label}</strong>
                <span className="methodology-priority-score">{entry.cadence}</span>
              </header>
              <p>Stale after {entry.staleAfterDays}d · Minimum confidence {Math.round(entry.minimumConfidence * 100)}%</p>
            </article>
          ))}
          {relationshipCadence.map((entry) => (
            <article key={`cadence-relationship-${entry.key}`} className="methodology-priority-card">
              <header>
                <strong>{entry.label}</strong>
                <span className="methodology-priority-score">{entry.cadence}</span>
              </header>
              <p>Stale after {entry.staleAfterDays}d · Minimum confidence {Math.round(entry.minimumConfidence * 100)}%</p>
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Known limitations</strong>
        <ul className="methodology-mini-list">
          {knownLimitations.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>
      <section className="scenario-meta-card">
        <strong>Data revision changelog</strong>
        {revisionEntries.length === 0 ? (
          <p className="methodology-telemetry-line">No structured revision entries found in methodology notes.</p>
        ) : (
          <div className="methodology-priority-grid">
            {revisionEntries.map((entry) => (
              <article key={`${entry.version}-${entry.scope}`} className="methodology-priority-card">
                <header>
                  <strong>{entry.version}</strong>
                  <span className="methodology-priority-score">{entry.scope}</span>
                </header>
                <p>{entry.detail}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
