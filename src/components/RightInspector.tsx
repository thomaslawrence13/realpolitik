import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Alignment,
  ConfidenceExplanation,
  ContributionLine,
  CountryIndicators,
  DatasetSource,
  IndicatorTelemetry,
  EconomicStats,
  HistoricalMetricSeries,
  MilitaryStats,
  ProbabilityExplanation,
  RelationshipDimensionKey,
  RiskExplanation,
  ScenarioInputs,
  SimulatedCountry,
  SimulationWeightSet,
  Tier,
} from '../types';
import { getRiskTier } from '../simulation';
import { INFORMATION_QUALITY_CONTRACT } from '../data/quality/contract';
import { deriveQualityRemediationDrivers } from '../data/quality/telemetry';
import { BarRow, MetricCard, Tabs } from './ui';

export type InspectorTab = 'stats' | 'overview' | 'relationships' | 'analysis';

type Props = {
  open: boolean;
  selected: SimulatedCountry;
  baselineSelected: SimulatedCountry;
  riskDelta: number;
  confidenceDelta: number;
  scenarioName: string;
  scenarioInputs: ScenarioInputs;
  activeWeightSet: SimulationWeightSet;
  activeEventNames: string[];
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onSelectRelated: (mapName: string) => void;
  comparisonSelected: SimulatedCountry | null;
  comparisonScenarioName: string | null;
  onClearComparison: () => void;
  sparkline: SparklineSeries | null;
  allCountries: SimulatedCountry[];
};

export interface SparklineSeries {
  labels: string[];
  active: number[];
  baseline: number[];
  currentIndex: number;
}

const formatPercent = (value: number) => `${value}%`;
const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${value}%`;
const formatSignedValue = (value: number) => `${value > 0 ? '+' : ''}${value}`;
const formatTitle = (value: string) =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
const formatIndicatorLabel = (value: string) =>
  value.replace(/([A-Z])/g, ' $1').trim().replace(/^./, (v) => v.toUpperCase());
const formatEvidenceClass = (value: 'observed' | 'estimated' | 'fallback' | 'derived') =>
  value.charAt(0).toUpperCase() + value.slice(1);
/** Convert a camelCase mineral key (e.g. 'rareEarths') to a readable title ('Rare Earths'). Uses formatIndicatorLabel logic. */
const formatMineralName = (value: string) => formatIndicatorLabel(value);
/** Convert a kebab-case country ID (e.g. 'saudi-arabia') to title case ('Saudi Arabia'). */
const formatCountryId = (id: string) =>
  id.length === 0
    ? id
    : id.split('-').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
const relationshipTagBorderAlpha = '33';
const relationshipTagBackgroundAlpha = '14';
const LARGE_VALUE_THRESHOLD = 100;
const LARGE_VALUE_DECIMALS = 1;
const SMALL_VALUE_DECIMALS = 2;
const HISTORICAL_CHART_WIDTH = 520;
const HISTORICAL_CHART_HEIGHT = 180;
const HISTORICAL_CHART_PAD_X = 34;
const HISTORICAL_CHART_PAD_Y = 18;
const V14_RELEASE_CONFIDENCE_FLOOR = 0.35;

// Stable ordered key list for probability bars — avoids Object.keys() on every render.
const PROBABILITY_KEYS: ReadonlyArray<keyof SimulatedCountry['probabilities']> = ['blocA', 'blocB', 'nonAligned'];

const relationshipDimensionMeta: ReadonlyArray<{
  key: RelationshipDimensionKey;
  label: string;
  shortLabel: string;
  color: string;
}> = [
  { key: 'cooperation', label: 'Cooperative', shortLabel: 'Coop', color: '#38bdf8' },
  { key: 'hostility', label: 'Hostile', shortLabel: 'Host', color: '#fb7185' },
  { key: 'dependency', label: 'Dependency', shortLabel: 'Dep', color: '#f59e0b' },
  { key: 'deterrence', label: 'Deterrence', shortLabel: 'Deter', color: '#a78bfa' },
];

const getDominantRelationshipDimension = (relationship: SimulatedCountry['profile']['relationships'][number]) =>
  relationshipDimensionMeta.reduce((strongest, dimension) =>
    relationship[dimension.key] > relationship[strongest.key] ? dimension : strongest,
  );

const isRelationshipStale = (relationship: SimulatedCountry['profile']['relationships'][number]) =>
  relationship.dataQuality?.dimensions.some((dimension) => dimension.stale) ?? false;

const getIndicatorTelemetry = (
  selected: SimulatedCountry,
  indicator: keyof CountryIndicators,
): IndicatorTelemetry | null => {
  return selected.profile.dataQuality?.indicators.find((entry) => entry.indicator === indicator) ?? null;
};

function MetricTelemetryTag({
  entry,
  fallbackLabel,
}: {
  entry?: IndicatorTelemetry | null;
  fallbackLabel?: string;
}) {
  if (!entry && !fallbackLabel) return null;
  const label = entry
    ? `${formatEvidenceClass(entry.evidenceClass)} · ${entry.sourceId} · ${entry.observedAt}${entry.stale ? ' · stale' : ''}`
    : fallbackLabel;
  const tone = entry?.evidenceClass === 'fallback'
    ? 'warning'
    : entry?.evidenceClass === 'derived'
      ? 'derived'
      : entry?.evidenceClass === 'observed'
        ? 'observed'
        : 'neutral';
  return <span className={`metric-telemetry-tag metric-telemetry-tag-${tone}`}>{label}</span>;
}


/**
 * Returns a colored delta hint element when the delta is non-zero.
 * @param delta     The numeric delta value.
 * @param higherIsBetter When true (e.g. confidence), positive delta is green; when false (e.g. risk), positive delta is red.
 */
const DeltaHint = ({ delta, higherIsBetter }: { delta: number; higherIsBetter: boolean }) => {
  if (delta === 0) return <>{`Δ ${formatSignedPercent(delta)}`}</>;
  const positive = higherIsBetter ? delta > 0 : delta < 0;
  return (
    <span style={{ color: positive ? 'var(--risk-low)' : 'var(--risk-high)' }}>
      Δ {formatSignedPercent(delta)}
    </span>
  );
};

export function RightInspector({
  open,
  selected,
  baselineSelected,
  riskDelta,
  confidenceDelta,
  scenarioName,
  scenarioInputs,
  activeWeightSet,
  activeEventNames,
  alignmentColor,
  alignmentLabel,
  tab,
  onTabChange,
  onSelectRelated,
  comparisonSelected,
  comparisonScenarioName,
  onClearComparison,
  sparkline,
  allCountries,
}: Props) {
  const alignmentChanged = selected.alignment !== baselineSelected.alignment;
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Scroll the panel body back to the top whenever the selected country changes.
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bodyRef.current?.scrollTo({ top: 0, behavior: prefersReduced ? 'instant' : 'smooth' });
  }, [selected.profile.id]);

  return (
    <aside className="inspector" aria-label="Country inspector" aria-hidden={!open} {...(!open && { inert: true })}>
      <header className="inspector-header">
        <div className="inspector-title">
          <h2>
            {selected.profile.displayName}
            <span
              className="alignment-pill alignment-pill-inline"
              style={{
                color: alignmentColor[selected.alignment],
                borderColor: `${alignmentColor[selected.alignment]}55`,
                background: `${alignmentColor[selected.alignment]}14`,
              }}
            >
              <i style={{ background: alignmentColor[selected.alignment] }} aria-hidden />
              {alignmentLabel[selected.alignment]}
            </span>
          </h2>
          <p>
            <span>{formatTitle(selected.profile.region)}</span>
            <span className="inspector-sep">·</span>
            <span>{selected.profile.allianceNetwork}</span>
            <span className="inspector-sep">·</span>
            <span>{formatTitle(selected.profile.regimeType)}</span>
          </p>
        </div>
      </header>

      <Tabs<InspectorTab>
        value={tab}
        onChange={onTabChange}
        size="sm"
        options={[
          { value: 'stats', label: 'Stats' },
          { value: 'overview', label: 'Overview' },
          { value: 'relationships', label: 'Relationships', count: selected.profile.relationships.length },
          { value: 'analysis', label: 'Analysis' },
        ]}
      />

      <div className="inspector-body" ref={bodyRef}>
        {tab === 'stats' && (
          <StatsPanel
            selected={selected}
            comparisonSelected={comparisonSelected}
            comparisonScenarioName={comparisonScenarioName}
            allCountries={allCountries}
          />
        )}

        {tab === 'overview' && (
          <OverviewPanel
            selected={selected}
            baselineSelected={baselineSelected}
            riskDelta={riskDelta}
            confidenceDelta={confidenceDelta}
            alignmentChanged={alignmentChanged}
            alignmentColor={alignmentColor}
            alignmentLabel={alignmentLabel}
            comparisonSelected={comparisonSelected}
            comparisonScenarioName={comparisonScenarioName}
            onClearComparison={onClearComparison}
            sparkline={sparkline}
          />
        )}

        {tab === 'relationships' && (
          <RelationshipsPanel selected={selected} onSelectRelated={onSelectRelated} />
        )}

        {tab === 'analysis' && (
          <AnalysisPanel
            selected={selected}
            scenarioName={scenarioName}
            scenarioInputs={scenarioInputs}
            activeWeightSet={activeWeightSet}
            activeEventNames={activeEventNames}
            comparisonSelected={comparisonSelected}
            comparisonScenarioName={comparisonScenarioName}
          />
        )}
      </div>
    </aside>
  );
}

function OverviewPanel({
  selected,
  baselineSelected,
  riskDelta,
  confidenceDelta,
  alignmentChanged,
  alignmentColor,
  alignmentLabel,
  comparisonSelected,
  comparisonScenarioName,
  onClearComparison,
  sparkline,
}: {
  selected: SimulatedCountry;
  baselineSelected: SimulatedCountry;
  riskDelta: number;
  confidenceDelta: number;
  alignmentChanged: boolean;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
  comparisonSelected: SimulatedCountry | null;
  comparisonScenarioName: string | null;
  onClearComparison: () => void;
  sparkline: SparklineSeries | null;
}) {
  const tradeTelemetry = getIndicatorTelemetry(selected, 'tradeExposure');
  const regimeTelemetry = getIndicatorTelemetry(selected, 'regimeStability');
  const cohesionTelemetry = getIndicatorTelemetry(selected, 'cohesion');

  return (
    <div className="panel-stack">
      <div className="overview-strip" aria-label="At a glance">
        <div className={`overview-chip metric-${getRiskTier(selected.risk)}`}>
          <span>Risk</span>
          <strong>{selected.risk}%</strong>
        </div>
        <div className="overview-chip metric-accent">
          <span>Confidence</span>
          <strong>{selected.confidence}%</strong>
        </div>
        <div className="overview-chip">
          <span>Relationships</span>
          <strong>{selected.profile.relationships.length}</strong>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Confidence"
          value={formatPercent(selected.confidence)}
          hint={<DeltaHint delta={confidenceDelta} higherIsBetter />}
          explanation={selected.explanation ? <ConfidenceExplainer explanation={selected.explanation.confidence} /> : undefined}
        />
        <MetricCard
          label="Conflict pressure index"
          value={formatPercent(selected.risk)}
          hint={<DeltaHint delta={riskDelta} higherIsBetter={false} />}
          tone={getRiskTier(selected.risk)}
          explanation={selected.explanation ? <RiskExplainer explanation={selected.explanation.risk} /> : undefined}
        />
        <MetricCard
          label="Source coverage"
          value={formatPercent(selected.profile.sourceCoverage)}
          hint={<MetricTelemetryTag fallbackLabel="Profile coverage" />}
        />
        <MetricCard
          label="Last updated"
          value={selected.profile.lastUpdated}
          hint={
            <MetricTelemetryTag
              entry={regimeTelemetry ?? cohesionTelemetry ?? tradeTelemetry}
              fallbackLabel="Best available profile timestamp"
            />
          }
          size="sm"
        />
      </div>

      {sparkline && sparkline.active.length > 1 && (
        <div className="section">
          <h3 className="section-title">Modeled risk trajectory</h3>
          <RiskSparkline series={sparkline} />
        </div>
      )}

      {alignmentChanged && (
        <div className="callout callout-warning">
          <strong>Alignment shifted vs baseline</strong>
          <p>
            <span style={{ color: alignmentColor[baselineSelected.alignment] }}>
              {alignmentLabel[baselineSelected.alignment]}
            </span>
            <span className="callout-arrow">→</span>
            <span style={{ color: alignmentColor[selected.alignment] }}>
              {alignmentLabel[selected.alignment]}
            </span>
          </p>
        </div>
      )}

      <div className="section">
        <h3 className="section-title">Modeled alignment</h3>
        <div className="bar-stack">
          {PROBABILITY_KEYS.map((key) => {
            const baselineValue = baselineSelected.probabilities[key];
            return (
              <BarRow
                key={key}
                label={alignmentLabel[key as Alignment]}
                value={selected.probabilities[key]}
                delta={selected.probabilities[key] - baselineValue}
                color={alignmentColor[key as Alignment]}
                explanation={
                  selected.explanation
                    ? <ProbabilityExplainer
                        explanation={selected.explanation.probabilities[key]}
                        label={alignmentLabel[key as Alignment]}
                        color={alignmentColor[key as Alignment]}
                      />
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Relationship posture</h3>
        <div className="metric-grid metric-grid-tight">
          <MetricCard
            label="Cooperation"
            value={formatPercent(selected.relationshipSummary.cooperation)}
            tone="accent"
            size="sm"
          />
          <MetricCard
            label="Hostility"
            value={formatPercent(selected.relationshipSummary.hostility)}
            tone={getRiskTier(selected.relationshipSummary.hostility)}
            size="sm"
          />
          <MetricCard
            label="Dependency"
            value={formatPercent(selected.relationshipSummary.dependency)}
            size="sm"
          />
          <MetricCard
            label="Deterrence"
            value={formatPercent(selected.relationshipSummary.deterrence)}
            size="sm"
          />
        </div>
      </div>

      {comparisonSelected && comparisonScenarioName && (
        <ComparisonSection
          comparisonSelected={comparisonSelected}
          comparisonScenarioName={comparisonScenarioName}
          activeSelected={selected}
          alignmentColor={alignmentColor}
          alignmentLabel={alignmentLabel}
          onClearComparison={onClearComparison}
        />
      )}
    </div>
  );
}

// ─── Statistics tab — complete country data snapshot with provenance ──────────

function IndicatorBadge({ value }: { value: string }) {
  const tier = value as 'low' | 'medium' | 'high';
  const color =
    tier === 'high' ? 'var(--risk-high)' : tier === 'medium' ? 'var(--risk-med)' : 'var(--risk-low)';
  return (
    <span className="profile-indicator-badge" style={{ color, borderColor: `${color}44` }}>
      {formatTitle(value)}
    </span>
  );
}

function ProfileStatGrid({
  title,
  icon,
  children,
  sourceTag,
}: {
  title: string;
  icon: string;
  children: ReactNode;
  sourceTag?: ReactNode;
}) {
  return (
    <div className="profile-section">
      <h3 className="profile-section-title">
        <span className="profile-section-icon" aria-hidden={true}>{icon}</span>
        {title}
        {sourceTag && <span className="profile-section-source">{sourceTag}</span>}
      </h3>
      <div className="profile-stat-grid">{children}</div>
    </div>
  );
}

function ProfileStat({
  label,
  value,
  comparisonValue,
  sub,
  tone,
  telemetry,
}: {
  label: string;
  value: ReactNode;
  comparisonValue?: ReactNode;
  sub?: string;
  tone?: 'positive' | 'negative' | 'neutral';
  telemetry?: ReactNode;
}) {
  return (
    <div className="profile-stat">
      <span className="profile-stat-label">{label}</span>
      <div className="profile-stat-value-group">
        <strong
          className="profile-stat-value"
          data-tone={tone}
        >
          {value}
        </strong>
        {comparisonValue && (
          <strong className="profile-stat-value profile-stat-value-comparison">
             / {comparisonValue}
          </strong>
        )}
      </div>
      {sub && <span className="profile-stat-sub">{sub}</span>}
      {telemetry}
    </div>
  );
}

/** Inline source attribution tag used throughout the Statistics tab. */
function InlineSourceTag({ sources, ids }: { sources: DatasetSource[]; ids: string[] }) {
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

const parsePeriod = (period: string) => {
  const year = Number.parseInt(period, 10);
  return Number.isFinite(year) ? year : Number.NaN;
};

const formatMetricValue = (value: number, unit: string) => {
  const rounded = Math.abs(value) >= LARGE_VALUE_THRESHOLD
    ? value.toFixed(LARGE_VALUE_DECIMALS)
    : value.toFixed(SMALL_VALUE_DECIMALS);
  return `${rounded.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} ${unit}`;
};

const buildAverageHistoricalSeries = (
  countries: SimulatedCountry[],
  metricId: HistoricalMetricSeries['metricId'],
  region?: string,
): HistoricalMetricSeries | null => {
  const buckets = new Map<string, { sum: number; count: number }>();
  let template: HistoricalMetricSeries | null = null;

  for (const country of countries) {
    if (region && country.profile.region !== region) continue;
    const series = country.profile.historicalSeries?.find((entry) => entry.metricId === metricId);
    if (!series) continue;
    if (!template) template = series;
    for (const point of series.points) {
      const bucket = buckets.get(point.period);
      if (bucket) {
        bucket.sum += point.value;
        bucket.count += 1;
      } else {
        buckets.set(point.period, { sum: point.value, count: 1 });
      }
    }
  }

  if (!template || buckets.size === 0) return null;

  const points = [...buckets.entries()]
    .map(([period, bucket]) => ({
      period,
      value: bucket.sum / bucket.count,
      retrievalDate: template.metadata.retrievedAt,
      quality: 'estimated' as const,
    }))
    .sort((left, right) => parsePeriod(left.period) - parsePeriod(right.period));

  return {
    metricId: template.metricId,
    label: template.label,
    points,
    metadata: template.metadata,
  };
};

function HistoricalTrendChart({
  lines,
  unit,
}: {
  lines: Array<{ label: string; color: string; points: HistoricalMetricSeries['points'] }>;
  unit: string;
}) {
  const width = HISTORICAL_CHART_WIDTH;
  const height = HISTORICAL_CHART_HEIGHT;
  const padX = HISTORICAL_CHART_PAD_X;
  const padY = HISTORICAL_CHART_PAD_Y;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const periods = [...new Set(lines.flatMap((line) => line.points.map((point) => point.period)))]
    .sort((left, right) => parsePeriod(left) - parsePeriod(right));
  const values = lines.flatMap((line) => line.points.map((point) => point.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.0001, max - min);
  const yMin = min - span * 0.08;
  const yMax = max + span * 0.08;

  const xFor = (period: string) => {
    const index = periods.indexOf(period);
    if (index === -1) return padX;
    if (periods.length === 1) return padX + innerW / 2;
    return padX + (index / (periods.length - 1)) * innerW;
  };
  const yFor = (value: number) => padY + ((yMax - value) / (yMax - yMin || 1)) * innerH;

  const toPath = (points: HistoricalMetricSeries['points']) =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point.period)} ${yFor(point.value)}`)
      .join(' ');

  return (
    <div className="historical-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} aria-label={`Historical trend (${unit})`} className="historical-trend-svg">
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} className="historical-axis" />
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} className="historical-axis" />
        {lines.map((line) => (
          <g key={line.label}>
            <path d={toPath(line.points)} className="historical-line" style={{ stroke: line.color }} />
            {line.points.map((point) => (
              <circle
                key={`${line.label}-${point.period}`}
                cx={xFor(point.period)}
                cy={yFor(point.value)}
                r={2.6}
                style={{ fill: line.color }}
              />
            ))}
          </g>
        ))}
        {periods.map((period) => (
          <text key={period} x={xFor(period)} y={height - 5} textAnchor="middle" className="historical-axis-label">
            {period}
          </text>
        ))}
      </svg>
      <div className="historical-legend">
        {lines.map((line) => (
          <span key={line.label} className="historical-legend-item">
            <i style={{ background: line.color }} aria-hidden />
            {line.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Statistics tab — shows all structured data fields for the selected country
 * across multiple domains (economy, military, demographics, energy, minerals,
 * fiscal, food/water, cyber, diplomatic, soft-power) with inline source
 * attribution links and data quality notices.
 */
function StatsPanel({
  selected,
  comparisonSelected,
  comparisonScenarioName,
  allCountries,
}: {
  selected: SimulatedCountry;
  comparisonSelected: SimulatedCountry | null;
  comparisonScenarioName: string | null;
  allCountries: SimulatedCountry[];
}) {
  const { profile } = selected;
  const econ = profile.economicStats;
  const mil = profile.militaryStats;
  const dem = profile.demographics;
  const energy = profile.energy;
  const cyber = profile.cyber;
  const fiscal = profile.fiscal;
  const fw = profile.foodWater;
  const dip = profile.diplomatic;
  const minerals = profile.criticalMinerals;
  const soft = profile.softPower;
  const ind = profile.indicators;
  const srcs = profile.sources;

  const tradeTelemetry = getIndicatorTelemetry(selected, 'tradeExposure');
  const militaryTelemetry = getIndicatorTelemetry(selected, 'militaryTreatyLevel');
  const cohesionTelemetry = getIndicatorTelemetry(selected, 'cohesion');
  const availableHistorical = profile.historicalSeries ?? [];
  const [historicalMetricId, setHistoricalMetricId] = useState<string>('');
  const [comparisonCountryMapName, setComparisonCountryMapName] = useState<string>('');

  useEffect(() => {
    setHistoricalMetricId(availableHistorical[0]?.metricId ?? '');
    setComparisonCountryMapName('');
  }, [selected.profile.id]);

  const selectedHistoricalSeries = useMemo(
    () => availableHistorical.find((series) => series.metricId === historicalMetricId) ?? null,
    [availableHistorical, historicalMetricId],
  );

  const comparisonCountry = useMemo(
    () => {
      if (comparisonCountryMapName.length === 0) return null;
      return allCountries.find((country) => country.profile.mapName === comparisonCountryMapName) ?? null;
    },
    [allCountries, comparisonCountryMapName],
  );

  const comparisonHistoricalSeries = useMemo(() => {
    if (!comparisonCountry || !selectedHistoricalSeries) return null;
    return (
      comparisonCountry.profile.historicalSeries?.find(
        (series) => series.metricId === selectedHistoricalSeries.metricId,
      ) ?? null
    );
  }, [comparisonCountry, selectedHistoricalSeries]);

  const regionAverageSeries = useMemo(() => {
    if (!selectedHistoricalSeries) return null;
    return buildAverageHistoricalSeries(allCountries, selectedHistoricalSeries.metricId, selected.profile.region);
  }, [allCountries, selected.profile.region, selectedHistoricalSeries]);

  const globalAverageSeries = useMemo(() => {
    if (!selectedHistoricalSeries) return null;
    return buildAverageHistoricalSeries(allCountries, selectedHistoricalSeries.metricId);
  }, [allCountries, selectedHistoricalSeries]);
  const evidenceSummary = useMemo(() => {
    const indicators = profile.dataQuality?.indicators ?? [];
    const summary: Record<'observed' | 'estimated' | 'derived' | 'fallback', number> = {
      observed: 0,
      estimated: 0,
      derived: 0,
      fallback: 0,
    };
    indicators.forEach((indicator) => {
      summary[indicator.evidenceClass] += 1;
    });
    return summary;
  }, [profile.dataQuality]);
  const staleIndicatorCount = profile.dataQuality?.indicators.filter((entry) => entry.stale).length ?? 0;
  const lowestIndicatorConfidence = profile.dataQuality?.indicators.reduce(
    (lowest, indicator) => Math.min(lowest, indicator.confidence),
    1,
  ) ?? null;
  const releaseConfidenceFloorMet =
    lowestIndicatorConfidence == null || lowestIndicatorConfidence >= V14_RELEASE_CONFIDENCE_FLOOR;
  const lowCoverage = profile.sourceCoverage < INFORMATION_QUALITY_CONTRACT.lowCoverageThresholdPct;
  const fallbackIndicators = evidenceSummary.fallback;
  const remediationDrivers = deriveQualityRemediationDrivers(profile);
  const showQualityBanner =
    Boolean(profile.dataQuality && profile.dataQuality.degradedReasons.length > 0) ||
    staleIndicatorCount > 0 ||
    lowCoverage ||
    fallbackIndicators > 0;
  const selectedHistoricalLatestPoint = selectedHistoricalSeries
    ? selectedHistoricalSeries.points[selectedHistoricalSeries.points.length - 1] ?? null
    : null;
  const selectedHistoricalBaseline = useMemo(() => {
    if (!selectedHistoricalSeries || selectedHistoricalSeries.points.length <= 1) return null;
    const baselinePoints = selectedHistoricalSeries.points.slice(0, -1);
    return baselinePoints.reduce((sum, point) => sum + point.value, 0) / baselinePoints.length;
  }, [selectedHistoricalSeries]);
  const selectedHistoricalDelta = selectedHistoricalLatestPoint && selectedHistoricalBaseline != null
    ? selectedHistoricalLatestPoint.value - selectedHistoricalBaseline
    : null;

  return (
    <div className="panel-stack">
      {/* ── Data quality banner ── */}
      {showQualityBanner && (
        <div className="callout callout-warning stats-quality-notice">
          <strong>Data quality notice</strong>
          <div className="methodology-priority-gaps methodology-evidence-gaps">
            <span>Observed {evidenceSummary.observed}</span>
            <span>Estimated {evidenceSummary.estimated}</span>
            <span>Derived {evidenceSummary.derived}</span>
            <span>Fallback {evidenceSummary.fallback}</span>
          </div>
          <ul className="stats-quality-list">
            {staleIndicatorCount > 0 && <li>{staleIndicatorCount} indicators are stale against SLA thresholds.</li>}
            {lowCoverage && (
              <li>
                Source coverage is {profile.sourceCoverage}% (below recommended {INFORMATION_QUALITY_CONTRACT.lowCoverageThresholdPct}%).
              </li>
            )}
            {fallbackIndicators > 0 && <li>{fallbackIndicators} indicators are currently using fallback evidence.</li>}
            {lowestIndicatorConfidence != null && (
              <li>
                v14 confidence floor ({Math.round(V14_RELEASE_CONFIDENCE_FLOOR * 100)}%) status: {releaseConfidenceFloorMet ? 'met' : 'below floor'} (min {Math.round(lowestIndicatorConfidence * 100)}%).
              </li>
            )}
            {remediationDrivers.slice(0, 2).map((driver) => (
              <li key={`driver-${driver}`}>{driver}</li>
            ))}
            {(profile.dataQuality?.degradedReasons ?? []).slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="profile-section">
        <h3 className="profile-section-title">
          <span className="profile-section-icon" aria-hidden={true}>📊</span>
          Historical trend comparison
        </h3>
        {availableHistorical.length === 0 ? (
          <p className="profile-stat-note">No historical indicator series available for this country yet.</p>
        ) : (
          <div className="historical-trends">
            <div className="historical-controls">
              <label>
                <span>Indicator</span>
                <select
                  value={historicalMetricId}
                  onChange={(event) => setHistoricalMetricId(event.target.value)}
                >
                  {availableHistorical.map((series) => (
                    <option key={series.metricId} value={series.metricId}>
                      {series.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Compare country</span>
                <select
                  value={comparisonCountryMapName}
                  onChange={(event) => setComparisonCountryMapName(event.target.value)}
                >
                  <option value="">None</option>
                  {allCountries
                    .filter((country) => country.profile.id !== profile.id)
                    .sort((left, right) => left.profile.displayName.localeCompare(right.profile.displayName))
                    .map((country) => (
                      <option key={country.profile.id} value={country.profile.mapName}>
                        {country.profile.displayName}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {selectedHistoricalSeries && (
              <>
                <div className="historical-summary-grid">
                  <article className="historical-summary-card">
                    <span>
                      Current (
                      {selectedHistoricalLatestPoint ? selectedHistoricalLatestPoint.period : 'n/a'}
                      )
                    </span>
                    <strong>
                      {selectedHistoricalLatestPoint
                        ? formatMetricValue(
                            selectedHistoricalLatestPoint.value,
                            selectedHistoricalSeries.metadata.unit,
                          )
                        : 'n/a'}
                    </strong>
                  </article>
                  <article className="historical-summary-card">
                    <span>Historical baseline</span>
                    <strong>
                      {selectedHistoricalBaseline != null
                        ? formatMetricValue(
                            selectedHistoricalBaseline,
                            selectedHistoricalSeries.metadata.unit,
                          )
                        : 'n/a'}
                    </strong>
                  </article>
                  <article className="historical-summary-card">
                    <span>Delta vs baseline</span>
                    <strong>
                      {selectedHistoricalDelta == null
                        ? 'n/a'
                        : `${selectedHistoricalDelta >= 0 ? '+' : ''}${formatMetricValue(selectedHistoricalDelta, selectedHistoricalSeries.metadata.unit)}`}
                    </strong>
                  </article>
                </div>
                <HistoricalTrendChart
                  unit={selectedHistoricalSeries.metadata.unit}
                  lines={[
                    {
                      label: selected.profile.displayName,
                      color: '#60a5fa',
                      points: selectedHistoricalSeries.points,
                    },
                    ...(comparisonHistoricalSeries
                      ? [{
                          label: comparisonCountry?.profile.displayName ?? 'Comparison country',
                          color: '#f97316',
                          points: comparisonHistoricalSeries.points,
                        }]
                      : []),
                    ...(regionAverageSeries
                      ? [{
                          label: `${formatTitle(selected.profile.region)} average`,
                          color: '#a78bfa',
                          points: regionAverageSeries.points,
                        }]
                      : []),
                    ...(globalAverageSeries
                      ? [{
                          label: 'Global average',
                          color: '#34d399',
                          points: globalAverageSeries.points,
                        }]
                      : []),
                  ]}
                />
                <ul className="kv-list historical-metadata">
                  <li>
                    <span>Source</span>
                    <strong>
                      <a
                        href={selectedHistoricalSeries.metadata.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-source-link"
                      >
                        {selectedHistoricalSeries.metadata.sourceTitle}
                      </a>
                    </strong>
                  </li>
                  <li>
                    <span>Definition</span>
                    <strong>{selectedHistoricalSeries.metadata.definition}</strong>
                  </li>
                  <li>
                    <span>Methodology</span>
                    <strong>{selectedHistoricalSeries.metadata.methodology}</strong>
                  </li>
                  <li>
                    <span>Last updated</span>
                    <strong>{selectedHistoricalSeries.metadata.lastUpdated}</strong>
                  </li>
                  <li>
                    <span>Coverage</span>
                    <strong>{selectedHistoricalSeries.metadata.coverage}</strong>
                  </li>
                  <li>
                    <span>Retrieved</span>
                    <strong>{selectedHistoricalSeries.metadata.retrievedAt}</strong>
                  </li>
                  <li>
                    <span>Quality</span>
                    <strong>{selectedHistoricalSeries.metadata.confidenceFlags.join(' · ')}</strong>
                  </li>
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Identity ── */}
      <div className="profile-section">
        <h3 className="profile-section-title">
          <span className="profile-section-icon" aria-hidden={true}>🌐</span>
          Identity
        </h3>
        <ul className="kv-list">
          <li>
            <span>Region</span>
            <strong>{formatTitle(profile.region)}</strong>
          </li>
          <li>
            <span>Subregion</span>
            <strong>{formatTitle(profile.subregion)}</strong>
          </li>
          <li>
            <span>Alliance network</span>
            <strong>{profile.allianceNetwork}</strong>
          </li>
          <li>
            <span>Regime type</span>
            <strong>{formatTitle(profile.regimeType)}</strong>
          </li>
          <li>
            <span>Data coverage</span>
            <strong>{profile.sourceCoverage}%</strong>
          </li>
          <li>
            <span>Last updated</span>
            <strong>{profile.lastUpdated}</strong>
          </li>
        </ul>
      </div>

      {/* ── Economic statistics ── */}
      {econ && (
        <ProfileStatGrid
          title="Economy"
          icon="📈"
          sourceTag={<InlineSourceTag sources={srcs} ids={['imf-weo', 'world-bank-wdi']} />}
        >
          <ProfileStat label="GDP" value={`$${econ.gdpBillionUsd.toLocaleString()}B`} sub="nominal USD" />
          <ProfileStat label="GDP per capita" value={`$${econ.gdpPerCapitaUsd.toLocaleString()}`} sub="nominal USD" />
          <ProfileStat
            label="GDP growth"
            value={`${econ.gdpGrowthPct > 0 ? '+' : ''}${econ.gdpGrowthPct}%`}
            tone={econ.gdpGrowthPct >= 0 ? 'positive' : 'negative'}
            sub="annual"
          />
          <ProfileStat
            label="Inflation"
            value={`${econ.inflationPct}%`}
            tone={econ.inflationPct > 10 ? 'negative' : econ.inflationPct < 4 ? 'positive' : 'neutral'}
            sub="CPI annual"
          />
          <ProfileStat
            label="Trade / GDP"
            value={`${econ.tradeGdpPct}%`}
            sub="openness"
            telemetry={<MetricTelemetryTag entry={tradeTelemetry} fallbackLabel="Curated economic snapshot" />}
          />
        </ProfileStatGrid>
      )}

      {/* ── Military statistics ── */}
      {mil && (
        <ProfileStatGrid
          title="Military"
          icon="🛡"
          sourceTag={<InlineSourceTag sources={srcs} ids={['sipri-milex', 'iiss-military-balance']} />}
        >
          <ProfileStat
            label="Defence spending"
            value={`$${mil.militaryExpBillionUsd.toLocaleString()}B`}
            sub="annual"
          />
          <ProfileStat
            label="Spending / GDP"
            value={`${mil.militaryExpGdpPct}%`}
            sub="burden"
            telemetry={<MetricTelemetryTag entry={militaryTelemetry} fallbackLabel="Curated military snapshot" />}
          />
          <ProfileStat
            label="Active personnel"
            value={mil.activePersonnelThousands > 0 ? `${mil.activePersonnelThousands.toLocaleString()}k` : '—'}
            sub="troops"
          />
          <ProfileStat
            label="Nuclear armed"
            value={mil.nuclearArmed ? 'Yes' : 'No'}
            tone={mil.nuclearArmed ? 'negative' : 'neutral'}
          />
        </ProfileStatGrid>
      )}

      {/* ── Demographics ── */}
      {dem && (
        <ProfileStatGrid
          title="Demographics"
          icon="👥"
          sourceTag={<InlineSourceTag sources={srcs} ids={['un-desa-population', 'world-factbook']} />}
        >
          <ProfileStat label="Population" value={`${dem.populationMillions.toLocaleString()}M`} sub="total" />
          <ProfileStat label="Median age" value={`${dem.medianAge} yrs`} />
          <ProfileStat label="Urbanization" value={`${dem.urbanizationPct}%`} sub="urban share" />
          <ProfileStat label="Youth share (15–29)" value={`${dem.youthSharePct}%`} />
          {dem.netMigrationPer1000 !== undefined && (
            <ProfileStat
              label="Net migration"
              value={`${dem.netMigrationPer1000 > 0 ? '+' : ''}${dem.netMigrationPer1000}`}
              sub="per 1 000"
              tone={dem.netMigrationPer1000 > 0 ? 'positive' : 'negative'}
            />
          )}
        </ProfileStatGrid>
      )}

      {/* ── Energy & resources ── */}
      {energy && (
        <ProfileStatGrid
          title="Energy & resources"
          icon="⚡"
          sourceTag={<InlineSourceTag sources={srcs} ids={['iea-weo', 'us-eia']} />}
        >
          <ProfileStat
            label="Net oil exports"
            value={`${energy.netOilExportMbd > 0 ? '+' : ''}${energy.netOilExportMbd} mb/d`}
            tone={energy.netOilExportMbd > 0 ? 'positive' : energy.netOilExportMbd < 0 ? 'negative' : 'neutral'}
          />
          <ProfileStat
            label="Net gas exports"
            value={`${energy.netGasExportBcm > 0 ? '+' : ''}${energy.netGasExportBcm} bcm/yr`}
            tone={energy.netGasExportBcm > 0 ? 'positive' : energy.netGasExportBcm < 0 ? 'negative' : 'neutral'}
          />
          <ProfileStat
            label="Energy import dependence"
            value={`${energy.energyImportDependencePct}%`}
            tone={energy.energyImportDependencePct > 60 ? 'negative' : 'neutral'}
          />
          <ProfileStat
            label="Critical mineral exporter"
            value={energy.criticalMineralExporter ? 'Yes' : 'No'}
          />
          {energy.notes && (
            <div className="profile-stat-note">{energy.notes}</div>
          )}
        </ProfileStatGrid>
      )}

      {/* ── Critical minerals ── */}
      {minerals && minerals.length > 0 && (
        <div className="profile-section">
          <h3 className="profile-section-title">
            <span className="profile-section-icon" aria-hidden={true}>🪨</span>
            Critical minerals
            <span className="profile-section-source">
              <InlineSourceTag sources={srcs} ids={['usgs-minerals']} />
            </span>
          </h3>
          <ul className="kv-list">
            {minerals.map((entry) => (
              <li key={entry.mineral}>
                <span>{formatMineralName(entry.mineral)}</span>
                <strong>
                  {formatTitle(entry.role)}
                  {entry.globalSharePct != null ? ` · ${entry.globalSharePct}% global share` : ''}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Fiscal profile ── */}
      {fiscal && (
        <ProfileStatGrid
          title="Fiscal & sovereign credit"
          icon="🏦"
          sourceTag={<InlineSourceTag sources={srcs} ids={['imf-weo', 'world-bank-wdi']} />}
        >
          <ProfileStat
            label="Sovereign rating"
            value={formatTitle(fiscal.sovereignRatingTier)}
            tone={(() => {
              if (fiscal.sovereignRatingTier === 'investment') return 'positive';
              if (fiscal.sovereignRatingTier === 'speculative') return 'neutral';
              return 'negative';
            })()}
          />
          <ProfileStat
            label="External debt/GDP"
            value={`${fiscal.externalDebtGdpPct}%`}
            tone={fiscal.externalDebtGdpPct > 100 ? 'negative' : fiscal.externalDebtGdpPct > 60 ? 'neutral' : 'positive'}
          />
          <ProfileStat
            label="FX reserves"
            value={`${fiscal.fxReservesMonthsImports} mo`}
            sub="months import cover"
            tone={fiscal.fxReservesMonthsImports < 3 ? 'negative' : 'positive'}
          />
          {fiscal.primaryBalanceGdpPct !== undefined && (
            <ProfileStat
              label="Primary balance / GDP"
              value={`${fiscal.primaryBalanceGdpPct > 0 ? '+' : ''}${fiscal.primaryBalanceGdpPct}%`}
              tone={fiscal.primaryBalanceGdpPct >= 0 ? 'positive' : 'negative'}
            />
          )}
          {fiscal.notes && <div className="profile-stat-note">{fiscal.notes}</div>}
        </ProfileStatGrid>
      )}

      {/* ── Food & water security ── */}
      {fw && (
        <ProfileStatGrid
          title="Food & water security"
          icon="🌾"
          sourceTag={<InlineSourceTag sources={srcs} ids={['world-bank-wdi']} />}
        >
          <ProfileStat
            label="Food import dependence"
            value={`${fw.foodImportDependencePct > 0 ? '+' : ''}${fw.foodImportDependencePct}%`}
            tone={fw.foodImportDependencePct > 40 ? 'negative' : fw.foodImportDependencePct < 0 ? 'positive' : 'neutral'}
            sub="net imports / consumption"
          />
          <ProfileStat
            label="Water stress"
            value={`${fw.waterStressIndex} / 5`}
            tone={fw.waterStressIndex >= 4 ? 'negative' : fw.waterStressIndex <= 2 ? 'positive' : 'neutral'}
            sub="WRI Aqueduct (5 = extreme)"
          />
          <ProfileStat
            label="Arable land"
            value={`${fw.arableLandHaPerCapita} ha/capita`}
          />
          <ProfileStat
            label="Cereal exporter"
            value={fw.cerealExporter ? 'Yes' : 'No'}
            tone={fw.cerealExporter ? 'positive' : 'neutral'}
          />
          {fw.notes && <div className="profile-stat-note">{fw.notes}</div>}
        </ProfileStatGrid>
      )}

      {/* ── Cyber & digital ── */}
      {cyber && (
        <ProfileStatGrid
          title="Cyber & digital"
          icon="💻"
          sourceTag={<InlineSourceTag sources={srcs} ids={['freedom-house', 'csis-sanctions']} />}
        >
          <ProfileStat
            label="Offensive capability"
            value={formatTitle(cyber.offensiveTier)}
            tone={cyber.offensiveTier === 'high' ? 'negative' : cyber.offensiveTier === 'low' ? 'positive' : 'neutral'}
          />
          <ProfileStat label="Defensive resilience" value={formatTitle(cyber.defensiveTier)} />
          <ProfileStat
            label="Internet freedom"
            value={`${cyber.internetFreedomScore} / 100`}
            tone={cyber.internetFreedomScore >= 70 ? 'positive' : cyber.internetFreedomScore <= 40 ? 'negative' : 'neutral'}
            sub="Freedom House proxy"
          />
          <ProfileStat
            label="Internet penetration"
            value={`${cyber.internetPenetrationPct}%`}
          />
          <ProfileStat
            label="Data localization"
            value={cyber.dataLocalization ? 'Yes' : 'No'}
            tone={cyber.dataLocalization ? 'negative' : 'neutral'}
          />
          {cyber.notes && <div className="profile-stat-note">{cyber.notes}</div>}
        </ProfileStatGrid>
      )}

      {/* ── Diplomatic profile ── */}
      {dip && (
        <div className="profile-section">
          <h3 className="profile-section-title">
            <span className="profile-section-icon" aria-hidden={true}>🤝</span>
            Diplomatic profile
            <span className="profile-section-source">
              <InlineSourceTag sources={srcs} ids={['un-comtrade', 'imf-direction-of-trade']} />
            </span>
          </h3>
          <ul className="kv-list">
            <li>
              <span>UN voting — Western bloc</span>
              <strong>{dip.unVotingAlignmentBlocA}%</strong>
            </li>
            <li>
              <span>UN voting — Eastern bloc</span>
              <strong>{dip.unVotingAlignmentBlocB}%</strong>
            </li>
          </ul>
          {dip.defensePacts.length > 0 && (
            <div className="profile-tag-group">
              <span className="profile-tag-label">Defense pacts</span>
              <div className="profile-tags">
                {dip.defensePacts.map((pact) => (
                  <span key={pact} className="profile-tag">{pact}</span>
                ))}
              </div>
            </div>
          )}
          {dip.igoMemberships.length > 0 && (
            <div className="profile-tag-group">
              <span className="profile-tag-label">IGO memberships</span>
              <div className="profile-tags">
                {dip.igoMemberships.map((igo) => (
                  <span key={igo} className="profile-tag">{igo}</span>
                ))}
              </div>
            </div>
          )}
          {dip.pendingAccession && dip.pendingAccession.length > 0 && (
            <div className="profile-tag-group">
              <span className="profile-tag-label">Pending accession</span>
              <div className="profile-tags">
                {dip.pendingAccession.map((pa) => (
                  <span key={pa} className="profile-tag profile-tag-pending">{pa}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Soft power ── */}
      {soft && (
        <ProfileStatGrid title="Soft power" icon="🌍">
          <ProfileStat
            label="Reach score"
            value={`${soft.reachScore} / 100`}
            sub="composite"
          />
          {soft.inboundStudentsThousands !== undefined && (
            <ProfileStat
              label="Inbound students"
              value={`${soft.inboundStudentsThousands.toLocaleString()}k`}
            />
          )}
          <ProfileStat
            label="Global language host"
            value={soft.globalLanguageHost ? 'Yes' : 'No'}
          />
          {soft.notes && <div className="profile-stat-note">{soft.notes}</div>}
        </ProfileStatGrid>
      )}

      {/* ── Top trade partners ── */}
      {profile.topTradePartners && profile.topTradePartners.length > 0 && (
        <div className="profile-section">
          <h3 className="profile-section-title">
            <span className="profile-section-icon" aria-hidden={true}>🔄</span>
            Top trade partners
            <span className="profile-section-source">
              <InlineSourceTag sources={srcs} ids={['un-comtrade', 'imf-direction-of-trade', 'wto-profile']} />
            </span>
          </h3>
          <ul className="kv-list">
            {profile.topTradePartners.map((partner) => (
              <li key={partner.countryId}>
                <span>{formatCountryId(partner.countryId)}</span>
                <strong>{partner.sharePct}% · {formatTitle(partner.flow)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Geopolitical indicators ── */}
      <div className="profile-section">
        <h3 className="profile-section-title">
          <span className="profile-section-icon" aria-hidden={true}>⚖️</span>
          Geopolitical indicators
        </h3>
        <div className="profile-indicator-grid">
          {(Object.entries(ind) as [keyof CountryIndicators, string | number][])
            .filter(([key]) => key !== 'cohesion')
            .map(([key, value]) => (
              <div key={key} className="profile-indicator-row">
                <div className="profile-indicator-meta">
                  <span className="profile-indicator-key">{formatIndicatorLabel(String(key))}</span>
                  <MetricTelemetryTag entry={getIndicatorTelemetry(selected, key)} />
                </div>
                <IndicatorBadge value={String(value)} />
              </div>
            ))}
          <div className="profile-indicator-row">
            <div className="profile-indicator-meta">
              <span className="profile-indicator-key">Cohesion score</span>
              <MetricTelemetryTag entry={cohesionTelemetry} />
            </div>
            <span className="profile-indicator-badge profile-indicator-badge-neutral">
              {ind.cohesion}
            </span>
          </div>
        </div>
      </div>

      {/* ── Sources ── */}
      <div className="profile-section">
        <h3 className="profile-section-title">
          <span className="profile-section-icon" aria-hidden={true}>📚</span>
          Data sources for this country
        </h3>
        <div className="source-list">
          {srcs.map((source) => (
            <article key={source.id} className="source-card">
              <strong>{source.title}</strong>
              <span className="source-meta">{source.publisher} · accessed {source.accessedOn}</span>
              <a href={source.url} target="_blank" rel="noreferrer" className="source-link">
                Open source →
              </a>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComparisonSection({
  comparisonSelected,
  comparisonScenarioName,
  activeSelected,
  alignmentColor,
  alignmentLabel,
  onClearComparison,
}: {
  comparisonSelected: SimulatedCountry;
  comparisonScenarioName: string;
  activeSelected: SimulatedCountry;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
  onClearComparison: () => void;
}) {
  const riskGap = activeSelected.risk - comparisonSelected.risk;
  const confidenceGap = activeSelected.confidence - comparisonSelected.confidence;
  return (
    <div className="section comparison-section">
      <header className="comparison-header">
        <div>
          <h3 className="section-title">Comparison · {comparisonScenarioName}</h3>
          <p className="comparison-sub">
            How this country fares in the pinned saved analysis versus the active analysis.
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClearComparison}>
          Clear
        </button>
      </header>

      <div className="comparison-rows">
        <div className="comparison-row">
          <span className="comparison-row-label">Alignment</span>
          <span
            className="alignment-pill alignment-pill-sm"
            style={{
              color: alignmentColor[comparisonSelected.alignment],
              borderColor: `${alignmentColor[comparisonSelected.alignment]}55`,
              background: `${alignmentColor[comparisonSelected.alignment]}14`,
            }}
          >
            <i style={{ background: alignmentColor[comparisonSelected.alignment] }} aria-hidden />
            {alignmentLabel[comparisonSelected.alignment]}
          </span>
        </div>
        <div className="comparison-row">
          <span className="comparison-row-label">Pressure</span>
          <strong className="comparison-row-value">
            {comparisonSelected.risk}%
            <em className={`comparison-gap ${riskGap > 0 ? 'comparison-gap-up' : riskGap < 0 ? 'comparison-gap-down' : ''}`}>
              active {riskGap > 0 ? '+' : ''}{riskGap}
            </em>
          </strong>
        </div>
        <div className="comparison-row">
          <span className="comparison-row-label">Confidence</span>
          <strong className="comparison-row-value">
            {comparisonSelected.confidence}%
            <em className={`comparison-gap ${confidenceGap > 0 ? 'comparison-gap-up' : confidenceGap < 0 ? 'comparison-gap-down' : ''}`}>
              active {confidenceGap > 0 ? '+' : ''}{confidenceGap}
            </em>
          </strong>
        </div>
        {(['blocA', 'blocB', 'nonAligned'] as const).map((key) => (
          <div key={key} className="comparison-row">
            <span className="comparison-row-label">P({alignmentLabel[key as Alignment]})</span>
            <strong className="comparison-row-value">
              {comparisonSelected.probabilities[key]}%
              <em className="comparison-gap">
                active {activeSelected.probabilities[key] > comparisonSelected.probabilities[key] ? '+' : ''}
                {activeSelected.probabilities[key] - comparisonSelected.probabilities[key]}
              </em>
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelationshipsPanel({
  selected,
  onSelectRelated,
}: {
  selected: SimulatedCountry;
  onSelectRelated: (mapName: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'tensionDesc' | 'updatedDesc' | 'nameAsc'>('tensionDesc');
  const [focus, setFocus] = useState<'all' | 'stale' | RelationshipDimensionKey>('all');

  const relationshipEntries = useMemo(
    () =>
      selected.profile.relationships.map((relationship) => ({
        relationship,
        dominantDimension: getDominantRelationshipDimension(relationship),
        stale: isRelationshipStale(relationship),
        updatedAtMs: Date.parse(relationship.dataQuality?.computedLastUpdated ?? relationship.lastUpdated),
      })),
    [selected.profile.relationships],
  );

  const staleCount = useMemo(
    () => relationshipEntries.filter((entry) => entry.stale).length,
    [relationshipEntries],
  );
  const strongestRelationship = useMemo(
    () =>
      relationshipEntries.reduce<(typeof relationshipEntries)[number] | null>(
        (strongest, entry) =>
          !strongest || entry.relationship.tension > strongest.relationship.tension ? entry : strongest,
        null,
      ),
    [relationshipEntries],
  );

  const visibleRelationships = useMemo(() => {
    const query = search.trim().toLowerCase();
    const compareEntries = (
      left: (typeof relationshipEntries)[number],
      right: (typeof relationshipEntries)[number],
    ) => {
      if (sortMode === 'updatedDesc') {
        return right.updatedAtMs - left.updatedAtMs;
      }
      if (sortMode === 'nameAsc') {
        return left.relationship.displayName.localeCompare(right.relationship.displayName);
      }
      const tensionDelta = right.relationship.tension - left.relationship.tension;
      if (tensionDelta !== 0) return tensionDelta;
      const hostilityDelta = right.relationship.hostility - left.relationship.hostility;
      if (hostilityDelta !== 0) return hostilityDelta;
      return left.relationship.displayName.localeCompare(right.relationship.displayName);
    };

    return relationshipEntries
      .filter(({ relationship, dominantDimension, stale }) => {
        const matchesQuery =
          query.length === 0 ||
          relationship.displayName.toLowerCase().includes(query) ||
          relationship.notes.toLowerCase().includes(query);
        if (!matchesQuery) return false;
        if (focus === 'all') return true;
        if (focus === 'stale') return stale;
        return dominantDimension.key === focus;
      })
      .slice()
      .sort(compareEntries);
  }, [focus, relationshipEntries, search, sortMode]);

  useEffect(() => {
    setSearch('');
    setSortMode('tensionDesc');
    setFocus('all');
  }, [selected.profile.id]);

  if (selected.profile.relationships.length === 0) {
    return <EmptyState title="No relationships logged" body="This country has no parameterized edges yet." />;
  }

  return (
    <div className="panel-stack">
      <div className="relationship-summary-grid">
        <div className="relationship-summary-card">
          <span>Logged edges</span>
          <strong>{selected.profile.relationships.length}</strong>
        </div>
        <div className="relationship-summary-card">
          <span>Stale edges</span>
          <strong>{staleCount}</strong>
        </div>
        <div className="relationship-summary-card">
          <span>Highest tension</span>
          <strong>{strongestRelationship?.relationship.displayName ?? '—'}</strong>
        </div>
      </div>

      <div className="relationship-toolbar">
        <label className="relationship-search">
          <span className="sr-only">Search relationships</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search partner or note…"
            spellCheck={false}
          />
        </label>
        <label className="relationship-sort">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
            <option value="tensionDesc">Highest tension</option>
            <option value="updatedDesc">Most recent</option>
            <option value="nameAsc">Name</option>
          </select>
        </label>
      </div>

      <div className="relationship-filter-bar">
        <button
          type="button"
          className={`relationship-filter-chip ${focus === 'all' ? 'relationship-filter-chip-active' : ''}`}
          onClick={() => setFocus('all')}
        >
          All
        </button>
        {relationshipDimensionMeta.map((dimension) => (
          <button
            key={dimension.key}
            type="button"
            className={`relationship-filter-chip ${focus === dimension.key ? 'relationship-filter-chip-active' : ''}`}
            onClick={() => setFocus(dimension.key)}
          >
            {dimension.label}
          </button>
        ))}
        <button
          type="button"
          className={`relationship-filter-chip ${focus === 'stale' ? 'relationship-filter-chip-active' : ''}`}
          onClick={() => setFocus('stale')}
        >
          Stale
        </button>
        <span className="relationship-visible-count">
          {visibleRelationships.length} shown
        </span>
      </div>

      {visibleRelationships.length === 0 ? (
        <EmptyState title="No matching relationships" body="Try clearing the search or switching the active relationship filter." />
      ) : (
        <div className="relationship-list">
          {visibleRelationships.map(({ relationship, dominantDimension, stale }) => {
            return (
              <article key={relationship.countryId} className="relationship-card">
                <header>
                  <div className="relationship-header-main">
                    <button
                      type="button"
                      className="relationship-name"
                      onClick={() => onSelectRelated(relationship.mapName)}
                    >
                      {relationship.displayName}
                    </button>
                    <div className="relationship-tags">
                      <span
                        className="relationship-dominant-tag"
                        style={{
                          color: dominantDimension.color,
                          borderColor: `${dominantDimension.color}${relationshipTagBorderAlpha}`,
                          background: `${dominantDimension.color}${relationshipTagBackgroundAlpha}`,
                        }}
                      >
                        {dominantDimension.label}
                      </span>
                      {stale && <span className="relationship-stale-tag">Stale</span>}
                    </div>
                  </div>
                  <span className="relationship-date">
                    {relationship.dataQuality?.computedLastUpdated ?? relationship.lastUpdated}
                  </span>
                </header>
                <div className="relationship-bars">
                  {relationshipDimensionMeta.map((dimension) => (
                    <SmallBar
                      key={dimension.key}
                      label={dimension.shortLabel}
                      value={relationship[dimension.key]}
                      color={dimension.color}
                      emphasized={focus === dimension.key || dominantDimension.key === dimension.key}
                    />
                  ))}
                </div>
                <p className="relationship-notes">{relationship.notes}</p>
                {relationship.dataQuality && relationship.dataQuality.dimensions.length > 0 && (
                  <ul className="kv-list kv-list-sm">
                    {relationship.dataQuality.dimensions.map((dim) => (
                      <li key={dim.dimension}>
                        <span className="rel-dim-label">{formatTitle(dim.dimension)} · {dim.sourceId} · {dim.method}</span>
                        <strong>
                          {dim.observedAt} · {Math.round(dim.confidence * 100)}%
                          {dim.stale ? ' · stale' : ''}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SmallBar({
  label,
  value,
  color,
  emphasized = false,
}: {
  label: string;
  value: number;
  color: string;
  emphasized?: boolean;
}) {
  return (
    <div className={`small-bar ${emphasized ? 'small-bar-emphasized' : ''}`}>
      <span className="small-bar-label">{label}</span>
      <div className="small-bar-track">
        <div className="small-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <strong className="small-bar-value">{value}</strong>
    </div>
  );
}

function AnalysisPanel({
  selected,
  scenarioName,
  scenarioInputs,
  activeWeightSet,
  activeEventNames,
  comparisonSelected,
  comparisonScenarioName,
}: {
  selected: SimulatedCountry;
  scenarioName: string;
  scenarioInputs: ScenarioInputs;
  activeWeightSet: SimulationWeightSet;
  activeEventNames: string[];
  comparisonSelected: SimulatedCountry | null;
  comparisonScenarioName: string | null;
}) {
  return (
    <div className="panel-stack">
      <div className="callout callout-warning analysis-model-notice">
        <strong>Model-derived outputs</strong>
        <p>Values below are computed by the analysis model from indicator inputs — not direct observations from authoritative sources. See the Statistics tab for raw sourced data.</p>
      </div>

      <div className="section">
        <h3 className="section-title">Computed risk drivers</h3>
        <ul className="kv-list">
          {selected.drivers.map((driver) => {
            const compDriver = comparisonSelected?.drivers.find(d => d.label === driver.label);
            return (
              <li key={driver.label}>
                <span>{driver.label}</span>
                <strong>
                  {driver.value}
                  {compDriver && compDriver.value !== driver.value && (
                    <em style={{ marginLeft: 6, fontWeight: 'normal', color: 'var(--text-muted)' }}>
                      (was {compDriver.value})
                    </em>
                  )}
                </strong>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="section">
        <h3 className="section-title">Country indicators (model inputs)</h3>
        <ul className="kv-list">
          <li>
            <span>Region</span>
            <strong>{formatTitle(selected.profile.region)}</strong>
          </li>
          <li>
            <span>Subregion</span>
            <strong>{formatTitle(selected.profile.subregion)}</strong>
          </li>
          <li>
            <span>Regime type</span>
            <strong>{formatTitle(selected.profile.regimeType)}</strong>
          </li>
          <li>
            <span>Trade exposure</span>
            <strong>{formatTitle(selected.profile.indicators.tradeExposure)}</strong>
          </li>
          <li>
            <span>Treaties</span>
            <strong>{formatTitle(selected.profile.indicators.militaryTreatyLevel)}</strong>
          </li>
          <li>
            <span>Border disputes</span>
            <strong>{formatTitle(selected.profile.indicators.borderDisputes)}</strong>
          </li>
          <li>
            <span>Trade dependence</span>
            <strong>{formatTitle(selected.profile.indicators.tradeDependence)}</strong>
          </li>
          <li>
            <span>Regime stability</span>
            <strong>{formatTitle(selected.profile.indicators.regimeStability)}</strong>
          </li>
          <li>
            <span>Cohesion</span>
            <strong>{selected.profile.indicators.cohesion}</strong>
          </li>
        </ul>
      </div>

      {(selected.profile.economicStats || selected.profile.militaryStats) && (
        <EconomicMilitarySection
          economic={selected.profile.economicStats}
          military={selected.profile.militaryStats}
        />
      )}

      <div className="section">
        <h3 className="section-title">Active analysis parameters</h3>
        <ul className="kv-list">
          <li>
            <span>Label</span>
            <strong>{scenarioName}</strong>
          </li>
          <li>
            <span>Weight set</span>
            <strong>{activeWeightSet.label}</strong>
          </li>
          <li>
            <span>Sanctions</span>
            <strong className={scenarioInputs.sanctionShock !== 0 ? 'value-active' : ''}>{scenarioInputs.sanctionShock}</strong>
          </li>
          <li>
            <span>Treaty change</span>
            <strong className={scenarioInputs.treatyShift !== 0 ? 'value-active' : ''}>{formatSignedValue(scenarioInputs.treatyShift)}</strong>
          </li>
          <li>
            <span>Election volatility</span>
            <strong className={scenarioInputs.electionVolatility !== 0 ? 'value-active' : ''}>{scenarioInputs.electionVolatility}</strong>
          </li>
          <li>
            <span>Invasion pressure</span>
            <strong className={scenarioInputs.invasionPressure !== 0 ? 'value-active' : ''}>{scenarioInputs.invasionPressure}</strong>
          </li>
          <li>
            <span>Coup risk</span>
            <strong className={scenarioInputs.coupRisk !== 0 ? 'value-active' : ''}>{scenarioInputs.coupRisk}</strong>
          </li>
        </ul>
      </div>

      {activeEventNames.length > 0 && (
        <div className="section">
          <h3 className="section-title">Events affecting this country</h3>
          <ul className="kv-list">
            {activeEventNames.map((eventName) => (
              <li key={eventName}>
                <span>{eventName}</span>
                <strong>Active</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SourcesPanel({
  selected,
  alignmentLabel,
}: {
  selected: SimulatedCountry;
  alignmentLabel: Record<Alignment, string>;
}) {
  const remediationDrivers = deriveQualityRemediationDrivers(selected.profile);
  return (
    <div className="panel-stack">
      <div className="section">
        <h3 className="section-title">Historical trajectory (modeled)</h3>
        <ul className="kv-list">
          {selected.history.map((entry) => (
            <li key={entry.label}>
              <span>{entry.label}</span>
              <strong>
                {alignmentLabel[entry.alignment]} · {entry.confidence}%
              </strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="section">
        <h3 className="section-title">Analytical assumptions</h3>
        <ul className="bullet-list">
          {selected.profile.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </div>

      <div className="section">
        <h3 className="section-title">Sources</h3>
        <div className="source-list">
          {selected.profile.sources.map((source) => (
            <article key={source.id} className="source-card">
              <strong>{source.title}</strong>
              <span className="source-meta">
                {source.publisher} · accessed {source.accessedOn}
              </span>
              <a href={source.url} target="_blank" rel="noreferrer" className="source-link">
                Open source →
              </a>
            </article>
          ))}
        </div>
      </div>

      {selected.profile.dataQuality && (
        <>
          <div className="section">
            <h3 className="section-title">Indicator freshness</h3>
            <ul className="kv-list">
              {selected.profile.dataQuality.indicators.map((entry) => (
                <li key={`${entry.indicator}-${entry.sourceId}`}>
                  <span>
                    {formatIndicatorLabel(entry.indicator)} · {entry.sourceId}
                  </span>
                  <strong>
                    {formatEvidenceClass(entry.evidenceClass)} · {entry.observedAt} · {Math.round(entry.confidence * 100)}%
                    {entry.stale ? ' · stale' : ''}
                  </strong>
                </li>
              ))}
            </ul>
          </div>

          {selected.profile.dataQuality.degradedReasons.length > 0 && (
            <div className="section">
              <h3 className="section-title">Data quality notices</h3>
              <ul className="bullet-list">
                {selected.profile.dataQuality.degradedReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {remediationDrivers.length > 0 && (
            <div className="section">
              <h3 className="section-title">Priority remediation drivers</h3>
              <ul className="bullet-list">
                {remediationDrivers.map((driver) => (
                  <li key={driver}>{driver}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function RiskSparkline({ series }: { series: SparklineSeries }) {
  const width = 320;
  const height = 72;
  const padX = 8;
  const padY = 10;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const max = 100;
  const min = 0;
  const xFor = (i: number) =>
    padX + (series.active.length === 1 ? innerW / 2 : (i * innerW) / (series.active.length - 1));
  const yFor = (value: number) => padY + innerH - ((value - min) / (max - min)) * innerH;
  const toPath = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? 'M' : 'L'}${xFor(index)},${yFor(value)}`).join(' ');
  const activePath = toPath(series.active);
  const baselinePath = toPath(series.baseline);
  const currentX = xFor(series.currentIndex);
  const currentY = yFor(series.active[series.currentIndex] ?? series.active[series.active.length - 1]);

  return (
    <div className="sparkline-card">
      <div className="sparkline-legend">
        <span className="sparkline-key sparkline-key-active">
          <i aria-hidden /> Active
        </span>
        <span className="sparkline-key sparkline-key-baseline">
          <i aria-hidden /> Baseline
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="sparkline-svg"
        aria-label="Risk trajectory across the timeline"
      >
        <line x1={padX} x2={width - padX} y1={yFor(50)} y2={yFor(50)} className="sparkline-grid" />
        <path d={baselinePath} className="sparkline-path sparkline-path-baseline" />
        <path d={activePath} className="sparkline-path sparkline-path-active" />
        <line
          x1={currentX}
          x2={currentX}
          y1={padY}
          y2={height - padY}
          className="sparkline-cursor"
        />
        <circle cx={currentX} cy={currentY} r={3.5} className="sparkline-marker" />
      </svg>
      <div className="sparkline-axis">
        {series.labels.map((label, index) => (
          <span
            key={label}
            className={`sparkline-axis-label ${index === series.currentIndex ? 'is-current' : ''}`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Explainer popovers — derived from the simulator's own breakdown so the math
 * displayed always matches the math computed.
 * ------------------------------------------------------------------------- */

type ExplainerRow = {
  label: string;
  contribution: number;
  multiplier?: number;
  inputValue?: number;
  isBase?: boolean;
};

function ExplainerCard({
  title,
  description,
  weightSetLabel,
  rows,
  sumLabel,
  sumValue,
  finalLabel,
  finalValue,
  finalUnit,
  swatchColor,
  footer,
}: {
  title: string;
  description: string;
  weightSetLabel?: string;
  rows: ExplainerRow[];
  sumLabel: string;
  sumValue: number;
  finalLabel: string;
  finalValue: number;
  finalUnit?: string;
  swatchColor?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="explainer">
      <header className="explainer-header">
        {swatchColor && <span className="explainer-swatch" style={{ background: swatchColor }} aria-hidden />}
        <strong>{title}</strong>
      </header>
      <p className="explainer-desc">{description}</p>
      {weightSetLabel && (
        <div className="explainer-tag">
          <span>Active weights</span>
          <em>{weightSetLabel}</em>
        </div>
      )}
      <div className="explainer-table">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className={`explainer-row ${row.isBase ? 'is-base' : ''}`}>
            <div className="explainer-row-main">
              <span className="explainer-row-label">{row.label}</span>
              {(row.multiplier != null || row.inputValue != null) && (
                <span className="explainer-row-meta">
                  {row.inputValue != null && <em>in {formatNumber(row.inputValue)}</em>}
                  {row.multiplier != null && <em>×{row.multiplier}</em>}
                </span>
              )}
            </div>
            <span
              className={`explainer-row-num ${row.contribution > 0 ? 'pos' : row.contribution < 0 ? 'neg' : ''}`}
            >
              {row.isBase ? formatNumber(row.contribution) : formatSigned(row.contribution)}
            </span>
          </div>
        ))}
        <div className="explainer-row explainer-sum">
          <span className="explainer-row-label">{sumLabel}</span>
          <span className="explainer-row-num">{formatNumber(sumValue)}</span>
        </div>
        <div className="explainer-row explainer-final">
          <span className="explainer-row-label">{finalLabel}</span>
          <span className="explainer-row-num">
            {Math.round(finalValue)}
            {finalUnit ?? ''}
          </span>
        </div>
      </div>
      {footer && <footer className="explainer-footer">{footer}</footer>}
    </div>
  );
}

function RiskExplainer({ explanation }: { explanation: RiskExplanation }) {
  const baseRow: ExplainerRow = {
    label: 'Country baseline risk',
    contribution: explanation.base,
    isBase: true,
  };

  return (
    <ExplainerCard
      title="How conflict pressure index is computed"
      description="Country baseline plus weighted indicator contributions. Indicator levels (low/med/high) map to numeric scores 18/50/82 before weighting. Scenario shocks compound onto specific indicators."
      weightSetLabel={explanation.weightSetLabel}
      rows={[baseRow, ...toRows(explanation.components)]}
      sumLabel="Sum"
      sumValue={explanation.total}
      finalLabel="Clamped to [8, 97]"
      finalValue={explanation.clamped}
      finalUnit="%"
      footer={<>These are model-derived scores computed from indicator inputs, not direct forecasts or historical observations.</>}
    />
  );
}

function ConfidenceExplainer({ explanation }: { explanation: ConfidenceExplanation }) {
  const marginRow: ExplainerRow = {
    label: `Top − second probability (${explanation.topProbability}% − ${explanation.secondProbability}%)`,
    contribution: explanation.margin,
    isBase: true,
  };
  const baseRow: ExplainerRow = {
    label: 'Base confidence floor',
    contribution: explanation.base,
    isBase: true,
  };

  return (
    <ExplainerCard
      title="How confidence is derived"
      description="Probability gap between the top alignment and the second, plus a base floor of 54, minus political-volatility shocks."
      rows={[marginRow, baseRow, ...toRows(explanation.components)]}
      sumLabel="Sum"
      sumValue={explanation.total}
      finalLabel="Clamped to [38, 96]"
      finalValue={explanation.clamped}
      finalUnit="%"
      footer={<>Higher confidence does not mean higher accuracy — it reflects how decisively the model lands on one bloc.</>}
    />
  );
}

function ProbabilityExplainer({
  explanation,
  label,
  color,
}: {
  explanation: ProbabilityExplanation;
  label: string;
  color: string;
}) {
  const baseRow: ExplainerRow = {
    label: 'Bloc base score',
    contribution: explanation.base,
    isBase: true,
  };

  return (
    <ExplainerCard
      title={`Why ${label}`}
      description={`Raw bloc score from indicators, regime bonus, and momentum, then normalized across the three blocs (sum of clamped raws = ${formatNumber(
        explanation.rawTotal,
      )}).`}
      rows={[baseRow, ...toRows(explanation.components)]}
      sumLabel="Raw score"
      sumValue={explanation.raw}
      finalLabel={`Normalized share (${formatNumber(explanation.rawClamped)} ÷ ${formatNumber(
        explanation.rawTotal,
      )})`}
      finalValue={explanation.normalized}
      finalUnit="%"
      swatchColor={color}
      footer={<>Each bloc is computed independently, then divided by the total to yield the percentage shown.</>}
    />
  );
}

function toRows(components: ContributionLine[]): ExplainerRow[] {
  return components.map((component) => ({
    label: component.label,
    contribution: component.contribution,
    multiplier: component.multiplier,
    inputValue: component.inputValue,
  }));
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatSigned(value: number) {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

function EconomicMilitarySection({
  economic,
  military,
}: {
  economic?: EconomicStats;
  military?: MilitaryStats;
}) {
  return (
    <>
      {economic && (
        <div className="section">
          <h3 className="section-title">Economic statistics</h3>
          <ul className="kv-list">
            <li>
              <span>GDP</span>
              <strong>${economic.gdpBillionUsd.toLocaleString()}B</strong>
            </li>
            <li>
              <span>GDP per capita</span>
              <strong>${economic.gdpPerCapitaUsd.toLocaleString()}</strong>
            </li>
            <li>
              <span>GDP growth</span>
              <strong className={economic.gdpGrowthPct >= 0 ? '' : 'value-active'}>
                {economic.gdpGrowthPct > 0 ? '+' : ''}{economic.gdpGrowthPct}%
              </strong>
            </li>
            <li>
              <span>Inflation</span>
              <strong className={economic.inflationPct > 10 ? 'value-active' : ''}>
                {economic.inflationPct}%
              </strong>
            </li>
            <li>
              <span>Trade / GDP</span>
              <strong>{economic.tradeGdpPct}%</strong>
            </li>
          </ul>
        </div>
      )}

      {military && (
        <div className="section">
          <h3 className="section-title">Military statistics</h3>
          <ul className="kv-list">
            <li>
              <span>Defence spending</span>
              <strong>${military.militaryExpBillionUsd.toLocaleString()}B</strong>
            </li>
            <li>
              <span>Defence / GDP</span>
              <strong>{military.militaryExpGdpPct}%</strong>
            </li>
            <li>
              <span>Active personnel</span>
              <strong>
                {military.activePersonnelThousands > 0
                  ? `${military.activePersonnelThousands.toLocaleString()}k`
                  : '—'}
              </strong>
            </li>
            <li>
              <span>Nuclear armed</span>
              <strong className={military.nuclearArmed ? 'value-active' : ''}>
                {military.nuclearArmed ? 'Yes' : 'No'}
              </strong>
            </li>
          </ul>
        </div>
      )}
    </>
  );
}
