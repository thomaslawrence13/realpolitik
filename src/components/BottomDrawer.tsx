import type {
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
}: Props) {
  return (
    <section className={`drawer ${open ? 'drawer-open' : 'drawer-closed'}`} aria-hidden={!open}>
      <header className="drawer-header">
        <Tabs<DrawerTab>
          value={tab}
          onChange={onTabChange}
          options={[
            { value: 'scenario', label: 'Scenario lab' },
            { value: 'feed', label: 'Event feed', count: eventFeed.length },
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

        {tab === 'feed' && <FeedPanel feed={eventFeed} />}

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

function FeedPanel({ feed }: { feed: EventFeedItem[] }) {
  if (feed.length === 0) {
    return (
      <div className="empty-state">
        <strong>No countries match the active filters.</strong>
        <p>Reset one or more filters to restore the current scenario feed.</p>
      </div>
    );
  }

  return (
    <div className="feed">
      {feed.map((item) => (
        <article key={item.title} className={`feed-item feed-item-${item.tone}`}>
          <strong>{item.title}</strong>
          <p>{item.detail}</p>
        </article>
      ))}
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
