import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Alignment,
  EventCategory,
  EventTemplate,
  InformationQualityTelemetry,
  SavedScenario,
  ScenarioInputs,
  SimulatedCountry,
  SimulationWeightSet,
  WeightSetKey,
} from '../types';
import { Slider, SvgIcon, Tabs } from './ui';
import { MoversPanel } from './MoversPanel';

export type DrawerTab = 'scenario' | 'feed' | 'movers' | 'history' | 'methodology';

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
  scenarioTimeline: string[];
  events: EventTemplate[];
  activeEventIds: string[];
  onApplyEvent: (id: string) => void;
  onRemoveEvent: (id: string) => void;
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
  scenarioTimeline,
  events,
  activeEventIds,
  onApplyEvent,
  onRemoveEvent,
  onResizeStart,
  onResizeStep,
  onResizeTo,
  movers,
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
            { value: 'scenario', label: 'Scenario lab' },
            { value: 'feed', label: 'Events', count: activeEventIds.length > 0 ? activeEventIds.length : undefined },
            { value: 'movers', label: 'Movers' },
            { value: 'history', label: 'History', count: savedScenarios.length },
            { value: 'methodology', label: 'Methodology' },
          ]}
        />
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close drawer">
          <SvgIcon.X />
        </button>
      </header>

      <div className="drawer-body">
        {tab === 'scenario' && (
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

        {tab === 'feed' && (
          <EventsPanel
            events={events}
            activeEventIds={activeEventIds}
            onApply={onApplyEvent}
            onRemove={onRemoveEvent}
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

        {tab === 'methodology' && <MethodologyPanel notes={methodologyNotes} informationQuality={informationQuality} />}
      </div>
    </section>
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
      <div className="scenario-meta">
        <label className="field">
          <span>Scenario label</span>
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
            Save scenario
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

function EventsPanel({
  events,
  activeEventIds,
  onApply,
  onRemove,
  scenarioFeed,
}: {
  events: EventTemplate[];
  activeEventIds: string[];
  onApply: (id: string) => void;
  onRemove: (id: string) => void;
  scenarioFeed: EventFeedItem[];
}) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | EventCategory>('all');

  const categories: Array<{ value: 'all' | EventCategory; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'military', label: 'Military' },
    { value: 'economic', label: 'Economic' },
    { value: 'political', label: 'Political' },
    { value: 'compound', label: 'Compound' },
  ];

  const visible = categoryFilter === 'all' ? events : events.filter((e) => e.category === categoryFilter);

  const formatDelta = (key: string, value: number) => {
    const signed = value > 0 ? `+${value}` : `${value}`;
    const labels: Record<string, string> = {
      sanctionShock: 'Sanctions',
      treatyShift: 'Treaty',
      electionVolatility: 'Election',
      invasionPressure: 'Invasion',
      coupRisk: 'Coup',
    };
    return `${labels[key] ?? key} ${signed}`;
  };

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

      <div className="events-grid">
        {visible.map((event) => {
          const isActive = activeEventIds.includes(event.id);
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

      {scenarioFeed.length > 0 && (
        <div className="events-impact-section">
          <h3 className="events-impact-title">Scenario impact — top pressures</h3>
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
          <strong>Saved scenarios</strong>
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
          <strong>No saved scenarios yet</strong>
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
        <span>{timeline[scenario.timelineIndex]}</span>
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
}: {
  notes: string[];
  informationQuality: InformationQualityTelemetry;
}) {
  const priorityCountries = informationQuality.weakestInformationCountries.slice(0, 8);
  return (
    <div className="methodology-panel">
      <ul className="methodology-list">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <section className="scenario-meta-card">
        <strong>Information quality telemetry</strong>
        <p className="methodology-telemetry-line">
          Assessed {new Date(informationQuality.assessedAt).toLocaleDateString()} · Average score {informationQuality.averageInformationScore}
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          High quality: {informationQuality.highQualityCount} · Low quality: {informationQuality.lowQualityCount} · Stale records: {informationQuality.staleCountryCount}
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
                {country.stale ? ` · ${country.yearsStale}y stale` : ''}
              </p>
              {country.gaps.length > 0 && (
                <div className="methodology-priority-gaps">
                  {country.gaps.slice(0, 3).map((gap) => (
                    <span key={`${country.countryId}-${gap}`}>{gap}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
