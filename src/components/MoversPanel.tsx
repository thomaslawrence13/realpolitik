import { useMemo, useState } from 'react';
import type { CountryProfile } from '../types';
import {
  computeLiveMovers,
  sortLiveMovers,
  type LiveMoverEntry,
  type LiveMoverMetric,
} from '../lib/liveMovers';
import type { LiveDataStatus } from './TopBar';

const liveSortOptions: ReadonlyArray<{ value: LiveMoverMetric; label: string }> = [
  { value: 'composite', label: 'Composite' },
  { value: 'gdpGrowth', label: 'GDP growth' },
  { value: 'inflation', label: 'Inflation' },
  { value: 'trade', label: 'Trade/GDP' },
  { value: 'military', label: 'Defence %GDP' },
  { value: 'coverage', label: 'Coverage' },
];

const formatSigned = (value: number | null, suffix = '') => {
  if (value == null || value === 0) return `0${suffix}`;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
};

type Props = {
  onSelectCountry: (mapName: string) => void;
  /** Static pipeline profiles (pre-live) for observed series deltas. */
  staticProfiles?: CountryProfile[];
  /** Active profiles after live/ingest enrichment. */
  liveProfiles?: CountryProfile[];
  liveDataStatus?: LiveDataStatus;
};

export function MoversPanel({
  onSelectCountry,
  staticProfiles,
  liveProfiles,
  liveDataStatus,
}: Props) {
  const [liveMetric, setLiveMetric] = useState<LiveMoverMetric>('composite');

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
          <p>Observed series deltas between the static snapshot and live World Bank enrichment.</p>
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