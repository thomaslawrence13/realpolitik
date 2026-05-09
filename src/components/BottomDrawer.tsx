import { useState } from 'react';
import type {
  EventCategory,
  EventTemplate,
  SavedScenario,
  ScenarioInputs,
  SimulationWeightSet,
  WeightSetKey,
} from '../types';
import { Slider, SvgIcon, Tabs } from './ui';

export type DrawerTab = 'scenario' | 'feed' | 'history' | 'methodology';

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
  onLoadScenario: (scenario: SavedScenario) => void;
  eventFeed: EventFeedItem[];
  methodologyNotes: string[];
  scenarioTimeline: string[];
  events: EventTemplate[];
  activeEventIds: string[];
  onApplyEvent: (id: string) => void;
  onRemoveEvent: (id: string) => void;
  onResizeStart: (startClientY: number) => void;
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
  onLoadScenario,
  eventFeed,
  methodologyNotes,
  scenarioTimeline,
  events,
  activeEventIds,
  onApplyEvent,
  onRemoveEvent,
  onResizeStart,
}: Props) {
  return (
    <section className={`drawer ${open ? 'drawer-open' : 'drawer-closed'}`} aria-hidden={!open}>
      {/* Drag handle — lets the user resize the drawer by dragging its top edge */}
      <div
        className="drawer-resize-handle"
        aria-hidden="true"
        onMouseDown={(e) => { e.preventDefault(); onResizeStart(e.clientY); }}
      />
      <header className="drawer-header">
        <Tabs<DrawerTab>
          value={tab}
          onChange={onTabChange}
          options={[
            { value: 'scenario', label: 'Scenario lab' },
            { value: 'feed', label: 'Events', count: activeEventIds.length > 0 ? activeEventIds.length : undefined },
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

        {tab === 'history' && (
          <HistoryPanel
            scenarios={savedScenarios}
            timeline={scenarioTimeline}
            weightSets={weightSets}
            onLoad={onLoadScenario}
          />
        )}

        {tab === 'methodology' && <MethodologyPanel notes={methodologyNotes} />}
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
}) {
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
}: {
  scenarios: SavedScenario[];
  timeline: string[];
  weightSets: SimulationWeightSet[];
  onLoad: (s: SavedScenario) => void;
}) {
  if (scenarios.length === 0) {
    return (
      <div className="empty-state">
        <strong>No saved scenarios yet</strong>
        <p>Save the current assumptions to compare baseline against edited outcomes over time.</p>
      </div>
    );
  }

  return (
    <div className="history">
      {scenarios.map((scenario) => {
        const weightSet = weightSets.find((entry) => entry.key === scenario.weightSetKey);
        return (
          <article key={scenario.id} className="history-card">
            <header>
              <strong>{scenario.name}</strong>
              <span>{timeline[scenario.timelineIndex]}</span>
            </header>
            <p>{weightSet?.label ?? 'Custom weighting'}</p>
            <p className="history-summary">
              Sanctions {scenario.inputs.sanctionShock} · Treaties{' '}
              {scenario.inputs.treatyShift > 0 ? '+' : ''}
              {scenario.inputs.treatyShift} · Election {scenario.inputs.electionVolatility} · Invasion{' '}
              {scenario.inputs.invasionPressure} · Coup {scenario.inputs.coupRisk}
            </p>
            <button type="button" className="btn btn-ghost" onClick={() => onLoad(scenario)}>
              Load scenario
            </button>
          </article>
        );
      })}
    </div>
  );
}

function MethodologyPanel({ notes }: { notes: string[] }) {
  return (
    <ul className="methodology-list">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}
