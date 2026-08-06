import type { ReactNode } from 'react';
import type { EconomicStats, DatasetSource, SimulatedCountry, CountryIndicators } from '../../types';
import { MetricTelemetryTag, getIndicatorTelemetry } from './shared';

/** Inline source attribution tag used throughout the Statistics tab. */
export function InlineSourceTag({ sources, ids }: { sources: DatasetSource[]; ids: string[] }) {
  const matched = sources.filter((s) => ids.includes(s.id));
  if (matched.length === 0) return null;
  return (
    <span className="inline-source-tag">
      {matched.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ' · '}
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="inline-source-link"
            title={`${s.title} — ${s.publisher} (accessed ${s.accessedOn})`}
          >
            {s.publisher}
          </a>
        </span>
      ))}
    </span>
  );
}

interface EconomicStatsSectionProps {
  econ: EconomicStats;
  sources: DatasetSource[];
  selected: SimulatedCountry;
}

/**
 * Economic statistics section component displaying GDP, inflation, trade metrics.
 */
export function EconomicStatsSection({ econ, sources, selected }: EconomicStatsSectionProps) {
  const tradeTelemetry = getIndicatorTelemetry(selected, 'tradeExposure');

  return (
    <div className="profile-section">
      <h3 className="profile-section-title">
        <span className="profile-section-icon" aria-hidden={true}>📈</span>
        Economy
        <span className="profile-section-source">
          <InlineSourceTag sources={sources} ids={['imf-weo', 'world-bank-wdi']} />
        </span>
      </h3>
      <div className="profile-stat-grid">
        <div className="profile-stat">
          <span className="profile-stat-label">GDP</span>
          <div className="profile-stat-value-group">
            <strong className="profile-stat-value">${econ.gdpBillionUsd.toLocaleString()}B</strong>
          </div>
          <span className="profile-stat-sub">nominal USD</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">GDP per capita</span>
          <div className="profile-stat-value-group">
            <strong className="profile-stat-value">${econ.gdpPerCapitaUsd.toLocaleString()}</strong>
          </div>
          <span className="profile-stat-sub">nominal USD</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">GDP growth</span>
          <div className="profile-stat-value-group">
            <strong
              className="profile-stat-value"
              data-tone={econ.gdpGrowthPct >= 0 ? 'positive' : 'negative'}
            >
              {econ.gdpGrowthPct > 0 ? '+' : ''}{econ.gdpGrowthPct}%
            </strong>
          </div>
          <span className="profile-stat-sub">annual</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Inflation</span>
          <div className="profile-stat-value-group">
            <strong
              className="profile-stat-value"
              data-tone={econ.inflationPct > 10 ? 'negative' : econ.inflationPct < 4 ? 'positive' : 'neutral'}
            >
              {econ.inflationPct}%
            </strong>
          </div>
          <span className="profile-stat-sub">CPI annual</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Trade / GDP</span>
          <div className="profile-stat-value-group">
            <strong className="profile-stat-value">{econ.tradeGdpPct}%</strong>
          </div>
          <span className="profile-stat-sub">openness</span>
          <MetricTelemetryTag entry={tradeTelemetry} fallbackLabel="Curated economic snapshot" />
        </div>
      </div>
    </div>
  );
}
