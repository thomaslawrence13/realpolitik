import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  CountryIndicators,
  DatasetSource,
  HistoricalMetricSeries,
  SimulatedCountry,
} from '../../types';
import { INFORMATION_QUALITY_CONTRACT } from '../../data/quality/contract';
import { deriveQualityRemediationDrivers } from '../../data/quality/telemetry';
import { SvgIcon } from '../ui';
import {
  formatCountryId,
  formatIndicatorLabel,
  formatMetricValue,
  formatMineralName,
  formatTitle,
  parsePeriod,
} from '../inspectorUtils';
import { HISTORICAL_CHART, INFORMATION_QUALITY } from '../../lib/constants';
import {
  BaselineComparison,
  IndicatorBadge,
  MetricTelemetryTag,
  LARGE_VALUE_THRESHOLD,
  LARGE_VALUE_DECIMALS,
  SMALL_VALUE_DECIMALS,
  getIndicatorTelemetry,
} from './shared';
import { InlineSourceTag } from './EconomicStatsSection';
import { EconomicStatsSection } from './EconomicStatsSection';
import { MilitaryStatsSection } from './MilitaryStatsSection';

const HISTORICAL_CHART_WIDTH = HISTORICAL_CHART.width;
const HISTORICAL_CHART_HEIGHT = HISTORICAL_CHART.height;
const HISTORICAL_CHART_PAD_X = HISTORICAL_CHART.padX;
const HISTORICAL_CHART_PAD_Y = HISTORICAL_CHART.padY;
const V14_RELEASE_CONFIDENCE_FLOOR = INFORMATION_QUALITY.v14ReleaseConfidenceFloor;

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
export function StatsPanel({
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

  const availableHistorical = profile.historicalSeries ?? [];
  const [historicalMetricId, setHistoricalMetricId] = useState<string>('');
  const [comparisonCountryMapName, setComparisonCountryMapName] = useState<string>('');
  const [qualityInfoExpanded, setQualityInfoExpanded] = useState(false);

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
      {/* ── Data quality info (collapsed icon) ── */}
      {showQualityBanner && (
        <>
          <div className="quality-info-compact">
            <button
              type="button"
              className="quality-info-toggle"
              onClick={() => setQualityInfoExpanded(!qualityInfoExpanded)}
              aria-expanded={qualityInfoExpanded}
              title="Data quality information"
            >
              <SvgIcon.Info />
            </button>
            <span className="quality-info-label">Data quality</span>
          </div>
          {qualityInfoExpanded && (
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
        </>
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
                            LARGE_VALUE_THRESHOLD,
                            LARGE_VALUE_DECIMALS,
                            SMALL_VALUE_DECIMALS,
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
                            LARGE_VALUE_THRESHOLD,
                            LARGE_VALUE_DECIMALS,
                            SMALL_VALUE_DECIMALS,
                          )
                        : 'n/a'}
                    </strong>
                  </article>
                  <article className="historical-summary-card">
                    <span>Change from baseline</span>
                    <strong>
                      {selectedHistoricalDelta == null
                        ? 'n/a'
                        : <BaselineComparison
                            delta={selectedHistoricalDelta}
                            formattedValue={formatMetricValue(
                              selectedHistoricalDelta,
                              selectedHistoricalSeries.metadata.unit,
                              LARGE_VALUE_THRESHOLD,
                              LARGE_VALUE_DECIMALS,
                              SMALL_VALUE_DECIMALS,
                            )}
                          />}
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
        <EconomicStatsSection econ={econ} sources={srcs} selected={selected} />
      )}

      {/* ── Military statistics ── */}
      {mil && (
        <MilitaryStatsSection mil={mil} sources={srcs} selected={selected} />
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
          {(Object.entries(ind) as [keyof CountryIndicators, string | number][]).map(([key, value]) => (
            <div key={key} className="profile-indicator-row">
              <div className="profile-indicator-meta">
                <span className="profile-indicator-key">{formatIndicatorLabel(String(key))}</span>
                <MetricTelemetryTag entry={getIndicatorTelemetry(selected, key)} />
              </div>
              <IndicatorBadge value={String(value)} />
            </div>
          ))}
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
