import { useEffect, useState } from 'react';
import type { HistoricalMetricPoint, HistoricalMetricSeries } from '../../types';

interface HistoricalSeriesSectionProps {
  countryId: string;
}

const CHART_WIDTH = 264;
const CHART_HEIGHT = 56;
const CHART_PAD = 3;

const formatValue = (value: number): string =>
  value >= 10 ? value.toFixed(1) : value.toFixed(2);

const formatDelta = (value: number, unit: string): string => {
  const rendered = Math.abs(value) >= 1000
    ? Math.round(value).toLocaleString()
    : Math.abs(value) >= 10
      ? value.toFixed(1)
      : value.toFixed(2);
  const signed = value > 0 ? `+${rendered}` : rendered;
  if (unit.includes('%')) return `${signed}pp`;
  return `${signed}${unit}`;
};

const flagClass = (flags: string[]): string => {
  if (flags.some((flag) => flag === 'stale')) return 'history-flag history-flag-warn';
  if (flags.some((flag) => flag === 'low coverage' || flag.includes('low'))) return 'history-flag history-flag-warn';
  return 'history-flag';
};

function Sparkline({ points, unit }: { points: HistoricalMetricPoint[]; unit: string }) {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = points.length > 1 ? (CHART_WIDTH - CHART_PAD * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = points.length > 1 ? CHART_PAD + index * step : CHART_WIDTH / 2;
    const y = CHART_HEIGHT - CHART_PAD - ((point.value - min) / span) * (CHART_HEIGHT - CHART_PAD * 2);
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = coords.length > 1
    ? `${linePath} L${coords[coords.length - 1]![0].toFixed(1)},${CHART_HEIGHT - CHART_PAD} L${coords[0]![0].toFixed(1)},${CHART_HEIGHT - CHART_PAD} Z`
    : '';

  return (
    <div className="sparkline-wrap">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Observed ${points[0]?.period} to ${points[points.length - 1]?.period}, ${unit}`}
      >
        {coords.length > 1 && <path className="sparkline-area" d={areaPath} />}
        <path className="sparkline-line" d={linePath} />
        {coords.map(([x, y], index) => (
          <circle
            key={points[index]!.period}
            cx={x}
            cy={y}
            r={index === coords.length - 1 ? 2.5 : 1.25}
            className="sparkline-dot"
          >
            <title>{`${points[index]!.period}: ${points[index]!.value} ${unit}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/**
 * Observed multi-year indicator series (World Bank WDI) for one country.
 * Charts draw only the years the source actually published — no modeled points.
 */
export function HistoricalSeriesSection({ countryId }: HistoricalSeriesSectionProps) {
  const [series, setSeries] = useState<HistoricalMetricSeries[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSeries(null);
    setLoadFailed(false);

    void import('../../data/historicalSeries')
      .then(({ historicalSeriesByCountryId }) => {
        if (!cancelled) setSeries(historicalSeriesByCountryId[countryId] ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setSeries([]);
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [countryId]);

  if (series === null) {
    return (
      <div className="profile-section" aria-live="polite">
        <h3 className="profile-section-title">
          <span className="profile-section-icon" aria-hidden={true}>📜</span>
          History
        </h3>
        <p className="glance-empty">Loading observed historical series…</p>
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="profile-section">
        <h3 className="profile-section-title">
          <span className="profile-section-icon" aria-hidden={true}>📜</span>
          History
        </h3>
        <p className="glance-empty">
          {loadFailed ? 'Historical series could not be loaded.' : 'No observed historical series for this profile.'}
        </p>
      </div>
    );
  }

  const retrievedAt = series[0]?.metadata.retrievedAt ?? 'unknown';
  const source = series[0]?.metadata;

  return (
    <div className="profile-section">
      <h3 className="profile-section-title">
        <span className="profile-section-icon" aria-hidden={true}>📜</span>
        History
        <span className="profile-section-source">
          {source ? (
            <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="inline-source-link">
              {source.sourceTitle}
            </a>
          ) : null}
          {retrievedAt && retrievedAt !== 'unknown' ? (
            <span className="profile-section-meta" title="When this series was retrieved from the source API">
              retrieved {retrievedAt}
            </span>
          ) : null}
        </span>
      </h3>
      <p className="history-note">
        Observed annual values from the source API. Only published years are plotted — nothing modeled.
      </p>
      <div className="history-stack">
        {series.map((metric) => {
          const points = metric.points;
          const latest = points[points.length - 1];
          const previous = points[points.length - 2];
          const deltaPp = previous ? latest.value - previous.value : null;
          return (
            <figure className="history-series" key={metric.metricId}>
              <figcaption>
                <strong>{metric.label}</strong>
                {latest ? (
                  <em>
                    {latest.value >= 10 ? latest.value.toFixed(1) : latest.value.toFixed(2)}
                    {metric.metadata.unit} · {latest.period}
                    {deltaPp !== null && (
                      <span
                        data-tone={
                          deltaPp > 0.0001 ? 'positive' : deltaPp < -0.0001 ? 'negative' : undefined
                        }
                      >
                        {' '}({formatDelta(deltaPp, metric.metadata.unit)} vs {previous!.period})
                      </span>
                    )}
                  </em>
                ) : (
                  <em>No observed values</em>
                )}
              </figcaption>
              {points.length > 1 && <Sparkline points={points} unit={metric.metadata.unit} />}
              <div className="history-meta">
                <span className={flagClass(metric.metadata.confidenceFlags)}>
                  {metric.metadata.confidenceFlags.join(' · ') || 'observed'}
                </span>
                <span>{metric.metadata.coverage}</span>
                <span>{metric.metadata.lastUpdated === 'unknown' ? '' : `series through ${metric.metadata.lastUpdated}`}</span>
              </div>
              <details className="history-details">
                <summary>About this series</summary>
                <p>{metric.metadata.definition}</p>
                <p>
                  {metric.metadata.methodology} Years with no published observation are omitted rather
                  than interpolated.
                </p>
              </details>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
