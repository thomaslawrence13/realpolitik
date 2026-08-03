import type { ReactNode } from 'react';
import type { ScenarioInputs, SimulationWeightSet, WeightSetKey } from '../../types';
import { Slider, SvgIcon } from '../ui';

export function ScenarioPanel({
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
