import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type {
  Alignment,
  ConfidenceExplanation,
  ContributionLine,
  CountryIndicators,
  IndicatorTelemetry,
  EconomicStats,
  MilitaryStats,
  ProbabilityExplanation,
  RiskExplanation,
  ScenarioInputs,
  SimulatedCountry,
  SimulationWeightSet,
  Tier,
} from '../types';
import { getRiskTier } from '../simulation';
import { BarRow, MetricCard, Tabs } from './ui';

export type InspectorTab = 'overview' | 'profile' | 'relationships' | 'drivers' | 'sources';

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
          <h2>{selected.profile.displayName}</h2>
          <p>
            <span>{formatTitle(selected.profile.region)}</span>
            <span className="inspector-sep">·</span>
            <span>{selected.profile.allianceNetwork}</span>
            <span className="inspector-sep">·</span>
            <span>{formatTitle(selected.profile.regimeType)}</span>
          </p>
        </div>
        <span
          className="alignment-pill"
          style={{
            color: alignmentColor[selected.alignment],
            borderColor: `${alignmentColor[selected.alignment]}55`,
            background: `${alignmentColor[selected.alignment]}14`,
          }}
        >
          <i style={{ background: alignmentColor[selected.alignment] }} aria-hidden />
          {alignmentLabel[selected.alignment]}
        </span>
      </header>

      <Tabs<InspectorTab>
        value={tab}
        onChange={onTabChange}
        size="sm"
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'profile', label: 'Profile' },
          { value: 'relationships', label: 'Relationships', count: selected.profile.relationships.length },
          { value: 'drivers', label: 'Drivers' },
          { value: 'sources', label: 'Sources', count: selected.profile.sources.length },
        ]}
      />

      <div className="inspector-body" ref={bodyRef}>
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

        {tab === 'profile' && (
          <ProfilePanel 
            selected={selected} 
            comparisonSelected={comparisonSelected}
            comparisonScenarioName={comparisonScenarioName}
          />
        )}

        {tab === 'relationships' && (
          <RelationshipsPanel selected={selected} onSelectRelated={onSelectRelated} />
        )}

        {tab === 'drivers' && (
          <DriversPanel
            selected={selected}
            scenarioName={scenarioName}
            scenarioInputs={scenarioInputs}
            activeWeightSet={activeWeightSet}
            activeEventNames={activeEventNames}
            comparisonSelected={comparisonSelected}
            comparisonScenarioName={comparisonScenarioName}
          />
        )}

        {tab === 'sources' && <SourcesPanel selected={selected} alignmentLabel={alignmentLabel} />}
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
          explanation={<ConfidenceExplainer explanation={selected.explanation.confidence} />}
        />
        <MetricCard
          label="Escalation risk"
          value={formatPercent(selected.risk)}
          hint={<DeltaHint delta={riskDelta} higherIsBetter={false} />}
          tone={getRiskTier(selected.risk)}
          explanation={<RiskExplainer explanation={selected.explanation.risk} />}
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
          <h3 className="section-title">Risk trajectory</h3>
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
        <h3 className="section-title">Alignment probabilities</h3>
        <div className="bar-stack">
          {(Object.keys(selected.probabilities) as Array<keyof typeof selected.probabilities>).map((key) => {
            const baselineValue = baselineSelected.probabilities[key];
            return (
              <BarRow
                key={key}
                label={alignmentLabel[key as Alignment]}
                value={selected.probabilities[key]}
                delta={selected.probabilities[key] - baselineValue}
                color={alignmentColor[key as Alignment]}
                explanation={
                  <ProbabilityExplainer
                    explanation={selected.explanation.probabilities[key]}
                    label={alignmentLabel[key as Alignment]}
                    color={alignmentColor[key as Alignment]}
                  />
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

// ─── Profile tab — complete country data snapshot ────────────────────────────

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
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <div className="profile-section">
      <h3 className="profile-section-title">
        <span className="profile-section-icon" aria-hidden={true}>{icon}</span>
        {title}
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

function ProfilePanel({ 
  selected, 
  comparisonSelected, 
  comparisonScenarioName 
}: { 
  selected: SimulatedCountry;
  comparisonSelected: SimulatedCountry | null;
  comparisonScenarioName: string | null;
}) {
  const { profile } = selected;
  const econ = profile.economicStats;
  const mil = profile.militaryStats;
  const ind = profile.indicators;
  const tradeTelemetry = getIndicatorTelemetry(selected, 'tradeExposure');
  const militaryTelemetry = getIndicatorTelemetry(selected, 'militaryTreatyLevel');
  const cohesionTelemetry = getIndicatorTelemetry(selected, 'cohesion');

  return (
    <div className="panel-stack">
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
            <span>Last updated</span>
            <strong>{profile.lastUpdated}</strong>
          </li>
        </ul>
      </div>

      {/* ── Economic statistics ── */}
      {econ && (
        <ProfileStatGrid title="Economy" icon="📈">
          <ProfileStat
            label="GDP"
            value={`$${econ.gdpBillionUsd.toLocaleString()}B`}
            sub="nominal USD"
          />
          <ProfileStat
            label="GDP per capita"
            value={`$${econ.gdpPerCapitaUsd.toLocaleString()}`}
            sub="nominal USD"
          />
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
        <ProfileStatGrid title="Military" icon="🛡">
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

      {/* ── Model outputs (quick reference) ── */}
      <div className="profile-section">
        <h3 className="profile-section-title">
          <span className="profile-section-icon" aria-hidden={true}>📊</span>
          Model outputs
          {comparisonScenarioName && <span className="profile-section-sub"> (vs {comparisonScenarioName})</span>}
        </h3>
        <div className="profile-stat-grid">
          <ProfileStat
            label="Escalation risk"
            value={`${selected.risk}%`}
            comparisonValue={comparisonSelected ? `${comparisonSelected.risk}%` : undefined}
            tone={selected.risk >= 65 ? 'negative' : selected.risk >= 40 ? 'neutral' : 'positive'}
          />
          <ProfileStat
            label="Confidence"
            value={`${selected.confidence}%`}
            comparisonValue={comparisonSelected ? `${comparisonSelected.confidence}%` : undefined}
          />
          <ProfileStat
            label="Source coverage"
            value={`${profile.sourceCoverage}%`}
            telemetry={<MetricTelemetryTag fallbackLabel="Profile coverage" />}
          />
          <ProfileStat
            label="Relationships"
            value={String(profile.relationships.length)}
            sub="parameterised edges"
          />
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
            How this country fares in the pinned saved scenario versus the active scenario.
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
          <span className="comparison-row-label">Risk</span>
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
  if (selected.profile.relationships.length === 0) {
    return <EmptyState title="No relationships logged" body="This country has no parameterized edges yet." />;
  }

  return (
    <div className="relationship-list">
      {selected.profile.relationships.map((relationship) => (
        <article key={relationship.countryId} className="relationship-card">
          <header>
            <button
              type="button"
              className="relationship-name"
              onClick={() => onSelectRelated(relationship.mapName)}
            >
              {relationship.displayName}
            </button>
            <span className="relationship-date">
              {relationship.dataQuality?.computedLastUpdated ?? relationship.lastUpdated}
            </span>
          </header>
          <div className="relationship-bars">
            <SmallBar label="Coop" value={relationship.cooperation} color="#38bdf8" />
            <SmallBar label="Host" value={relationship.hostility} color="#fb7185" />
            <SmallBar label="Dep" value={relationship.dependency} color="#f59e0b" />
            <SmallBar label="Deter" value={relationship.deterrence} color="#a78bfa" />
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
      ))}
    </div>
  );
}

function SmallBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="small-bar">
      <span className="small-bar-label">{label}</span>
      <div className="small-bar-track">
        <div className="small-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <strong className="small-bar-value">{value}</strong>
    </div>
  );
}

function DriversPanel({
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
      <div className="section">
        <h3 className="section-title">Key drivers</h3>
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
        <h3 className="section-title">Country indicators</h3>
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
        <h3 className="section-title">Active scenario</h3>
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
  return (
    <div className="panel-stack">
      <div className="section">
        <h3 className="section-title">Recent trajectory</h3>
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
        <h3 className="section-title">Assumptions</h3>
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
      title="How escalation risk is computed"
      description="Country baseline plus weighted indicator contributions. Indicator levels (low/med/high) map to numeric scores 18/50/82 before weighting. Scenario shocks compound onto specific indicators."
      weightSetLabel={explanation.weightSetLabel}
      rows={[baseRow, ...toRows(explanation.components)]}
      sumLabel="Sum"
      sumValue={explanation.total}
      finalLabel="Clamped to [8, 97]"
      finalValue={explanation.clamped}
      finalUnit="%"
      footer={<>Numbers are illustrative — the active dataset is a versioned snapshot, not a live feed.</>}
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
