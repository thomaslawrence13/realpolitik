import { useEffect, useRef, useState } from 'react';
import type { SavedScenario, SimulationWeightSet } from '../../types';
import { clampTimelineIndex } from '../../lib/timeline';
import { SvgIcon } from '../ui';

export function HistoryPanel({
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
