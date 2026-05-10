import { useMemo, useState } from 'react';
import type { Alignment, SimulatedCountry } from '../types';

type MoverEntry = {
  mapName: string;
  displayName: string;
  region: string;
  riskDelta: number;
  confidenceDelta: number;
  alignmentChanged: boolean;
  reference: SimulatedCountry;
  active: SimulatedCountry;
};

type SortMetric = 'risk' | 'confidence' | 'alignmentShift';

const sortOptions: ReadonlyArray<{ value: SortMetric; label: string }> = [
  { value: 'risk', label: 'Risk Δ' },
  { value: 'confidence', label: 'Confidence Δ' },
  { value: 'alignmentShift', label: 'Alignment shift' },
];

const computeMovers = (
  active: SimulatedCountry[],
  reference: Map<string, SimulatedCountry>,
): MoverEntry[] => {
  return active
    .map((entry) => {
      const ref = reference.get(entry.profile.mapName);
      if (!ref) return null;
      return {
        mapName: entry.profile.mapName,
        displayName: entry.profile.displayName,
        region: entry.profile.region,
        riskDelta: Math.round(entry.risk - ref.risk),
        confidenceDelta: Math.round(entry.confidence - ref.confidence),
        alignmentChanged: entry.alignment !== ref.alignment,
        reference: ref,
        active: entry,
      };
    })
    .filter((entry): entry is MoverEntry => entry !== null);
};

const sortMovers = (movers: MoverEntry[], metric: SortMetric): MoverEntry[] => {
  const ranked = movers.slice();
  if (metric === 'risk') {
    ranked.sort((a, b) => Math.abs(b.riskDelta) - Math.abs(a.riskDelta));
  } else if (metric === 'confidence') {
    ranked.sort((a, b) => Math.abs(b.confidenceDelta) - Math.abs(a.confidenceDelta));
  } else {
    ranked.sort((a, b) => {
      const flagDelta = Number(b.alignmentChanged) - Number(a.alignmentChanged);
      if (flagDelta !== 0) return flagDelta;
      return Math.abs(b.riskDelta) - Math.abs(a.riskDelta);
    });
  }
  return ranked.slice(0, 10);
};

type Props = {
  active: SimulatedCountry[];
  baselineByName: Map<string, SimulatedCountry>;
  comparisonByName: Map<string, SimulatedCountry> | null;
  comparisonScenarioName: string | null;
  onSelectCountry: (mapName: string) => void;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
};

export function MoversPanel({
  active,
  baselineByName,
  comparisonByName,
  comparisonScenarioName,
  onSelectCountry,
  alignmentColor,
  alignmentLabel,
}: Props) {
  const [metric, setMetric] = useState<SortMetric>('risk');

  const baselineMovers = useMemo(
    () => sortMovers(computeMovers(active, baselineByName), metric),
    [active, baselineByName, metric],
  );

  const comparisonMovers = useMemo(() => {
    if (!comparisonByName) return null;
    return sortMovers(computeMovers(active, comparisonByName), metric);
  }, [active, comparisonByName, metric]);

  return (
    <div className="movers-panel">
      <header className="movers-header">
        <div>
          <strong>Top movers</strong>
          <p>Countries whose modeled outcome diverges most under the active scenario.</p>
        </div>
        <div className="movers-sort">
          <span>Rank by</span>
          <select value={metric} onChange={(event) => setMetric(event.target.value as SortMetric)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <MoversList
        title="Active vs baseline"
        movers={baselineMovers}
        onSelect={onSelectCountry}
        alignmentColor={alignmentColor}
        alignmentLabel={alignmentLabel}
      />

      {comparisonMovers && comparisonScenarioName && (
        <MoversList
          title={`Active vs ${comparisonScenarioName}`}
          movers={comparisonMovers}
          onSelect={onSelectCountry}
          alignmentColor={alignmentColor}
          alignmentLabel={alignmentLabel}
        />
      )}
    </div>
  );
}

function MoversList({
  title,
  movers,
  onSelect,
  alignmentColor,
  alignmentLabel,
}: {
  title: string;
  movers: MoverEntry[];
  onSelect: (mapName: string) => void;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
}) {
  if (movers.length === 0) {
    return (
      <section className="movers-section">
        <h3 className="movers-section-title">{title}</h3>
        <p className="movers-empty">No divergence detected — every country tracks the reference.</p>
      </section>
    );
  }

  return (
    <section className="movers-section">
      <h3 className="movers-section-title">{title}</h3>
      <ul className="movers-list">
        {movers.map((mover) => {
          const riskClass = mover.riskDelta > 0 ? 'mover-up' : mover.riskDelta < 0 ? 'mover-down' : '';
          const confidenceClass =
            mover.confidenceDelta > 0 ? 'mover-down' : mover.confidenceDelta < 0 ? 'mover-up' : '';
          return (
            <li key={mover.mapName}>
              <button type="button" className="mover-row" onClick={() => onSelect(mover.mapName)}>
                <span className="mover-row-main">
                  <span
                    className="mover-dot"
                    style={{ background: alignmentColor[mover.active.alignment] }}
                    aria-hidden
                  />
                  <span className="mover-name">
                    <strong>{mover.displayName}</strong>
                    <em>{mover.region}</em>
                  </span>
                </span>
                <span className="mover-row-stats">
                  {mover.alignmentChanged && (
                    <span className="mover-shift" title="Alignment shifted">
                      {alignmentLabel[mover.reference.alignment]} → {alignmentLabel[mover.active.alignment]}
                    </span>
                  )}
                  <span className={`mover-delta ${riskClass}`}>
                    risk {mover.riskDelta > 0 ? '+' : ''}{mover.riskDelta}
                  </span>
                  <span className={`mover-delta ${confidenceClass}`}>
                    conf {mover.confidenceDelta > 0 ? '+' : ''}{mover.confidenceDelta}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
