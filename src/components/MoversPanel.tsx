import { useMemo, useState } from 'react';
import type { Alignment, CountryProfile, SimulatedCountry } from '../types';
import { summarizeCountryTrust, TrustTag } from './provenance';
import {
  computeLiveMovers,
  sortLiveMovers,
  type LiveMoverEntry,
  type LiveMoverMetric,
} from '../lib/liveMovers';
import type { LiveDataStatus } from './TopBar';

type ScenarioMoverEntry = {
  mapName: string;
  displayName: string;
  region: string;
  riskDelta: number;
  confidenceDelta: number;
  alignmentChanged: boolean;
  reference: SimulatedCountry;
  active: SimulatedCountry;
};

type ScenarioSortMetric = 'risk' | 'confidence' | 'alignmentShift';

const scenarioSortOptions: ReadonlyArray<{ value: ScenarioSortMetric; label: string }> = [
  { value: 'risk', label: 'Risk Δ' },
  { value: 'confidence', label: 'Confidence Δ' },
  { value: 'alignmentShift', label: 'Alignment shift' },
];

const liveSortOptions: ReadonlyArray<{ value: LiveMoverMetric; label: string }> = [
  { value: 'composite', label: 'Composite' },
  { value: 'gdpGrowth', label: 'GDP growth' },
  { value: 'inflation', label: 'Inflation' },
  { value: 'trade', label: 'Trade/GDP' },
  { value: 'military', label: 'Defence %GDP' },
  { value: 'coverage', label: 'Coverage' },
];

const computeScenarioMovers = (
  active: SimulatedCountry[],
  reference: Map<string, SimulatedCountry>,
): ScenarioMoverEntry[] => {
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
    .filter((entry): entry is ScenarioMoverEntry => entry !== null);
};

const sortScenarioMovers = (
  movers: ScenarioMoverEntry[],
  metric: ScenarioSortMetric,
): ScenarioMoverEntry[] => {
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

const formatSigned = (value: number | null, suffix = '') => {
  if (value == null || value === 0) return `0${suffix}`;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
};

type Props = {
  active: SimulatedCountry[];
  baselineByName: Map<string, SimulatedCountry>;
  comparisonByName: Map<string, SimulatedCountry> | null;
  comparisonScenarioName: string | null;
  onSelectCountry: (mapName: string) => void;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
  /** Static pipeline profiles (pre-live) for observed series deltas. */
  staticProfiles?: CountryProfile[];
  /** Active profiles after live/ingest enrichment. */
  liveProfiles?: CountryProfile[];
  liveDataStatus?: LiveDataStatus;
};

export function MoversPanel({
  active,
  baselineByName,
  comparisonByName,
  comparisonScenarioName,
  onSelectCountry,
  alignmentColor,
  alignmentLabel,
  staticProfiles,
  liveProfiles,
  liveDataStatus,
}: Props) {
  const [scenarioMetric, setScenarioMetric] = useState<ScenarioSortMetric>('risk');
  const [liveMetric, setLiveMetric] = useState<LiveMoverMetric>('composite');

  const baselineMovers = useMemo(
    () => sortScenarioMovers(computeScenarioMovers(active, baselineByName), scenarioMetric),
    [active, baselineByName, scenarioMetric],
  );

  const comparisonMovers = useMemo(() => {
    if (!comparisonByName) return null;
    return sortScenarioMovers(computeScenarioMovers(active, comparisonByName), scenarioMetric);
  }, [active, comparisonByName, scenarioMetric]);

  const liveMovers = useMemo(() => {
    if (!staticProfiles?.length || !liveProfiles?.length) return [];
    return sortLiveMovers(computeLiveMovers(staticProfiles, liveProfiles), liveMetric, 12);
  }, [staticProfiles, liveProfiles, liveMetric]);

  const liveReady = liveDataStatus === 'live' || liveDataStatus === 'partial';

  return (
    <div className="movers-panel">
      <header className="movers-header">
        <div>
          <strong>Top movers</strong>
          <p>
            Live series deltas lead; scenario model deltas sit below for optional what-if analysis.
          </p>
        </div>
      </header>

      <section className="movers-section movers-section-live">
        <div className="movers-section-head">
          <h3 className="movers-section-title">Live series · static → enriched</h3>
          <div className="movers-sort">
            <span>Rank by</span>
            <select
              value={liveMetric}
              onChange={(event) => setLiveMetric(event.target.value as LiveMoverMetric)}
              aria-label="Rank live movers by"
            >
              {liveSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!liveReady && (
          <p className="movers-empty">
            Waiting on live World Bank enrichment — showing static bootstrap only until sync
            completes.
          </p>
        )}
        {liveReady && liveMovers.length === 0 && (
          <p className="movers-empty">
            No material live-series changes versus the static snapshot (stats already matched).
          </p>
        )}
        {liveMovers.length > 0 && (
          <ul className="movers-list">
            {liveMovers.map((mover) => (
              <LiveMoverRow key={mover.mapName} mover={mover} onSelect={onSelectCountry} />
            ))}
          </ul>
        )}
      </section>

      <header className="movers-subheader">
        <strong>What-if model movers</strong>
        <div className="movers-sort">
          <span>Rank by</span>
          <select
            value={scenarioMetric}
            onChange={(event) => setScenarioMetric(event.target.value as ScenarioSortMetric)}
            aria-label="Rank scenario movers by"
          >
            {scenarioSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <ScenarioMoversList
        title="Active vs model baseline"
        movers={baselineMovers}
        onSelect={onSelectCountry}
        alignmentColor={alignmentColor}
        alignmentLabel={alignmentLabel}
      />

      {comparisonMovers && comparisonScenarioName && (
        <ScenarioMoversList
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

function LiveMoverRow({
  mover,
  onSelect,
}: {
  mover: LiveMoverEntry;
  onSelect: (mapName: string) => void;
}) {
  return (
    <li>
      <button type="button" className="mover-row" onClick={() => onSelect(mover.mapName)}>
        <span className="mover-row-main">
          <span className="mover-name">
            <span className="mover-name-row">
              <strong>{mover.displayName}</strong>
            </span>
            <em>{mover.region}</em>
          </span>
        </span>
        <span className="mover-row-stats mover-row-stats-live">
          {mover.growthDelta != null && Math.abs(mover.growthDelta) >= 0.1 && (
            <span className={`mover-delta ${mover.growthDelta > 0 ? 'mover-down' : 'mover-up'}`}>
              g {formatSigned(mover.growthDelta, 'pp')}
            </span>
          )}
          {mover.inflationDelta != null && Math.abs(mover.inflationDelta) >= 0.1 && (
            <span className={`mover-delta ${mover.inflationDelta > 0 ? 'mover-up' : 'mover-down'}`}>
              π {formatSigned(mover.inflationDelta, 'pp')}
            </span>
          )}
          {mover.militaryDelta != null && Math.abs(mover.militaryDelta) >= 0.05 && (
            <span className="mover-delta">
              mil {formatSigned(mover.militaryDelta, 'pp')}
            </span>
          )}
          {mover.coverageDelta !== 0 && (
            <span className="mover-delta">
              cov {formatSigned(mover.coverageDelta, 'pp')}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function ScenarioMoversList({
  title,
  movers,
  onSelect,
  alignmentColor,
  alignmentLabel,
}: {
  title: string;
  movers: ScenarioMoverEntry[];
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
          const trust = summarizeCountryTrust(mover.active.profile);
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
                    <span className="mover-name-row">
                      <strong>{mover.displayName}</strong>
                      <TrustTag summary={trust} />
                    </span>
                    <em>{mover.region}</em>
                    <small className="mover-trust-detail">{trust.detail}</small>
                  </span>
                </span>
                <span className="mover-row-stats">
                  {mover.alignmentChanged && (
                    <span className="mover-shift" title="Alignment shifted">
                      {alignmentLabel[mover.reference.alignment]} →{' '}
                      {alignmentLabel[mover.active.alignment]}
                    </span>
                  )}
                  <span className={`mover-delta ${riskClass}`}>
                    risk {mover.riskDelta > 0 ? '+' : ''}
                    {mover.riskDelta}
                  </span>
                  <span className={`mover-delta ${confidenceClass}`}>
                    conf {mover.confidenceDelta > 0 ? '+' : ''}
                    {mover.confidenceDelta}
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
