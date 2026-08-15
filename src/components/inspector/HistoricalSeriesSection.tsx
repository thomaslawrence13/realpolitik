import { useEffect, useMemo, useState } from 'react';
import type { HistoricalMetricId, HistoricalMetricPoint, HistoricalMetricSeries } from '../../types';

interface HistoricalSeriesSectionProps {
  countryId: string;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 116;
const CHART_PAD_X = 12;
const CHART_PAD_Y = 12;

const formatMetricValue = (value: number, unit: string): string => {
  const sign = value < 0 ? '-' : '';
  const magnitude = Math.abs(value);
  if (unit.includes('bn USD')) return `${sign}$${magnitude.toFixed(magnitude >= 100 ? 0 : 1)}B`;
  if (unit.includes('USD')) return `${sign}$${Math.round(magnitude).toLocaleString()}`;
  if (unit.includes('%')) return `${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const formatDelta = (value: number, unit: string): string => {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const magnitude = Math.abs(value);
  if (unit.includes('bn USD')) return `${sign}$${magnitude.toFixed(1)}B`;
  if (unit.includes('USD')) return `${sign}$${Math.round(magnitude).toLocaleString()}`;
  if (unit.includes('%')) return `${sign}${magnitude.toFixed(2)}pp`;
  return `${sign}${magnitude.toFixed(2)}`;
};

const deltaTone = (metricId: HistoricalMetricId, delta: number): 'positive' | 'negative' | 'neutral' => {
  if (Math.abs(delta) < 0.0001) return 'neutral';
  const inverse = metricId === 'inflation' || metricId === 'unemployment' || metricId === 'militaryBurden';
  const directional = inverse ? -delta : delta;
  if (metricId === 'tradeOpenness' || metricId === 'militarySpend') return 'neutral';
  return directional > 0 ? 'positive' : 'negative';
};

function TrendChart({ metric }: { metric: HistoricalMetricSeries }) {
  const { points } = metric;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rawSpan = max - min;
  const visualPad = rawSpan === 0 ? Math.max(1, Math.abs(max) * 0.05) : rawSpan * 0.08;
  const chartMin = min - visualPad;
  const chartMax = max + visualPad;
  const span = chartMax - chartMin || 1;
  const step = points.length > 1 ? (CHART_WIDTH - CHART_PAD_X * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => ({
    x: points.length > 1 ? CHART_PAD_X + index * step : CHART_WIDTH / 2,
    y: CHART_HEIGHT - CHART_PAD_Y - ((point.value - chartMin) / span) * (CHART_HEIGHT - CHART_PAD_Y * 2),
    point,
  }));
  const linePath = coords.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = coords.length > 1
    ? `${linePath} L${coords.at(-1)!.x.toFixed(1)},${CHART_HEIGHT - CHART_PAD_Y} L${coords[0]!.x.toFixed(1)},${CHART_HEIGHT - CHART_PAD_Y} Z`
    : '';

  return (
    <div className="history-chart">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`${metric.label}, observed ${points[0]?.period} to ${points.at(-1)?.period}`}
      >
        {[CHART_PAD_Y, CHART_HEIGHT / 2, CHART_HEIGHT - CHART_PAD_Y].map((y) => (
          <line key={y} x1={CHART_PAD_X} x2={CHART_WIDTH - CHART_PAD_X} y1={y} y2={y} className="history-chart-gridline" />
        ))}
        {coords.length > 1 && <path className="sparkline-area" d={areaPath} />}
        <path className="sparkline-line" d={linePath} />
        {coords.map(({ x, y, point }, index) => (
          <circle key={point.period} cx={x} cy={y} r={index === coords.length - 1 ? 3 : 1.5} className="sparkline-dot">
            <title>{`${point.period}: ${formatMetricValue(point.value, metric.metadata.unit)}`}</title>
          </circle>
        ))}
      </svg>
      <span className="history-chart-max">{formatMetricValue(max, metric.metadata.unit)}</span>
      <span className="history-chart-min">{formatMetricValue(min, metric.metadata.unit)}</span>
      <span className="history-chart-start">{points[0]?.period}</span>
      <span className="history-chart-end">{points.at(-1)?.period}</span>
    </div>
  );
}

export function HistoricalSeriesSection({ countryId }: HistoricalSeriesSectionProps) {
  const [series, setSeries] = useState<HistoricalMetricSeries[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeMetricId, setActiveMetricId] = useState<HistoricalMetricId>('gdpGrowth');

  useEffect(() => {
    let cancelled = false;
    setSeries(null);
    setLoadFailed(false);
    setActiveMetricId('gdpGrowth');

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
    return () => { cancelled = true; };
  }, [countryId]);

  const activeMetric = useMemo(() => {
    if (!series?.length) return null;
    return series.find((metric) => metric.metricId === activeMetricId) ?? series[0]!;
  }, [activeMetricId, series]);

  if (series === null) {
    return <div className="profile-section" aria-live="polite"><p className="glance-empty">Loading observed historical series…</p></div>;
  }
  if (series.length === 0 || !activeMetric) {
    return (
      <div className="profile-section">
        <p className="glance-empty">{loadFailed ? 'Historical series could not be loaded.' : 'No observed historical series for this profile.'}</p>
      </div>
    );
  }

  const points = activeMetric.points;
  const latest = points.at(-1)!;
  const previous = points.at(-2);
  const first = points[0]!;
  const delta = previous ? latest.value - previous.value : null;
  const periodChange = latest.value - first.value;
  const source = activeMetric.metadata;

  return (
    <div className="profile-section history-section">
      <h3 className="profile-section-title">
        <span className="profile-section-icon" aria-hidden>↗</span>
        Observed history
        <span className="profile-section-source">
          <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="inline-source-link">{source.sourceTitle}</a>
        </span>
      </h3>
      <p className="history-note">Published annual observations only. Missing years are left blank rather than modeled.</p>

      <div className="history-series-picker" role="group" aria-label="Historical indicator">
        {series.map((metric) => {
          const metricLatest = metric.points.at(-1);
          const metricPrevious = metric.points.at(-2);
          const metricDelta = metricLatest && metricPrevious ? metricLatest.value - metricPrevious.value : null;
          return (
            <button
              type="button"
              aria-pressed={metric.metricId === activeMetric.metricId}
              className={metric.metricId === activeMetric.metricId ? 'history-picker-active' : ''}
              onClick={() => setActiveMetricId(metric.metricId)}
              key={metric.metricId}
            >
              <span>{metric.label}</span>
              <strong>{metricLatest ? formatMetricValue(metricLatest.value, metric.metadata.unit) : '—'}</strong>
              {metricDelta != null && <em data-tone={deltaTone(metric.metricId, metricDelta)}>{formatDelta(metricDelta, metric.metadata.unit)}</em>}
            </button>
          );
        })}
      </div>

      <figure className="history-focus">
        <figcaption>
          <div>
            <span>{activeMetric.label}</span>
            <strong>{formatMetricValue(latest.value, source.unit)}</strong>
          </div>
          {delta != null && previous && (
            <em data-tone={deltaTone(activeMetric.metricId, delta)}>
              {formatDelta(delta, source.unit)} vs {previous.period}
            </em>
          )}
        </figcaption>
        {points.length > 1 && <TrendChart metric={activeMetric} />}
        <div className="history-summary-grid">
          <span><em>Latest</em><strong>{latest.period}</strong></span>
          <span><em>Coverage</em><strong>{points.length} years</strong></span>
          <span><em>Period change</em><strong data-tone={deltaTone(activeMetric.metricId, periodChange)}>{formatDelta(periodChange, source.unit)}</strong></span>
        </div>
      </figure>

      <div className="history-quality-row">
        <span className={source.confidenceFlags.includes('stale') ? 'history-flag-warn' : 'history-flag'}>{source.confidenceFlags.join(' · ')}</span>
        <span>{source.coverage}</span>
        <span>retrieved {source.retrievedAt}</span>
      </div>
      <details className="history-details">
        <summary>Definition and methodology</summary>
        <p>{source.definition}</p>
        <p>{source.methodology} Years with no published observation are omitted.</p>
      </details>
    </div>
  );
}
