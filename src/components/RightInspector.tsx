import type { ReactNode } from 'react';
import type {
  Alignment,
  ConfidenceExplanation,
  ContributionLine,
  ProbabilityExplanation,
  RiskExplanation,
  ScenarioInputs,
  SimulatedCountry,
  SimulationWeightSet,
  Tier,
} from '../types';
import { BarRow, MetricCard, Tabs } from './ui';

export type InspectorTab = 'overview' | 'relationships' | 'drivers' | 'sources';

type Props = {
  open: boolean;
  selected: SimulatedCountry;
  baselineSelected: SimulatedCountry;
  riskDelta: number;
  confidenceDelta: number;
  scenarioName: string;
  scenarioInputs: ScenarioInputs;
  activeWeightSet: SimulationWeightSet;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onSelectRelated: (mapName: string) => void;
};

const formatPercent = (value: number) => `${value}%`;
const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${value}%`;
const formatSignedValue = (value: number) => `${value > 0 ? '+' : ''}${value}`;
const formatTitle = (value: string) =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
const formatIndicator = (value: string) =>
  value.replace(/([A-Z])/g, ' $1').replace(/^./, (v) => v.toUpperCase());

const riskTier = (value: number): Tier => {
  if (value >= 65) return 'high';
  if (value >= 40) return 'medium';
  return 'low';
};

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
  alignmentColor,
  alignmentLabel,
  tab,
  onTabChange,
  onSelectRelated,
}: Props) {
  const alignmentChanged = selected.alignment !== baselineSelected.alignment;

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
          { value: 'relationships', label: 'Relationships', count: selected.profile.relationships.length },
          { value: 'drivers', label: 'Drivers' },
          { value: 'sources', label: 'Sources', count: selected.profile.sources.length },
        ]}
      />

      <div className="inspector-body">
        {tab === 'overview' && (
          <OverviewPanel
            selected={selected}
            baselineSelected={baselineSelected}
            riskDelta={riskDelta}
            confidenceDelta={confidenceDelta}
            alignmentChanged={alignmentChanged}
            alignmentColor={alignmentColor}
            alignmentLabel={alignmentLabel}
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
}: {
  selected: SimulatedCountry;
  baselineSelected: SimulatedCountry;
  riskDelta: number;
  confidenceDelta: number;
  alignmentChanged: boolean;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
}) {
  return (
    <div className="panel-stack">
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
          tone={riskTier(selected.risk)}
          explanation={<RiskExplainer explanation={selected.explanation.risk} />}
        />
        <MetricCard label="Source coverage" value={formatPercent(selected.profile.sourceCoverage)} />
        <MetricCard label="Last updated" value={selected.profile.lastUpdated} size="sm" />
      </div>

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
        <h3 className="section-title">Alignment likelihoods</h3>
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
        <h3 className="section-title">Relationship summary</h3>
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
            tone={riskTier(selected.relationshipSummary.hostility)}
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
            <span className="relationship-date">{relationship.lastUpdated}</span>
          </header>
          <div className="relationship-bars">
            <SmallBar label="Coop" value={relationship.cooperation} color="#38bdf8" />
            <SmallBar label="Host" value={relationship.hostility} color="#fb7185" />
            <SmallBar label="Dep" value={relationship.dependency} color="#f59e0b" />
            <SmallBar label="Deter" value={relationship.deterrence} color="#a78bfa" />
          </div>
          <p className="relationship-notes">{relationship.notes}</p>
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
}: {
  selected: SimulatedCountry;
  scenarioName: string;
  scenarioInputs: ScenarioInputs;
  activeWeightSet: SimulationWeightSet;
}) {
  return (
    <div className="panel-stack">
      <div className="section">
        <h3 className="section-title">Key drivers</h3>
        <ul className="kv-list">
          {selected.drivers.map((driver) => (
            <li key={driver.label}>
              <span>{driver.label}</span>
              <strong>{driver.value}</strong>
            </li>
          ))}
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
            <strong>{scenarioInputs.sanctionShock}</strong>
          </li>
          <li>
            <span>Treaty change</span>
            <strong>{formatSignedValue(scenarioInputs.treatyShift)}</strong>
          </li>
          <li>
            <span>Election volatility</span>
            <strong>{scenarioInputs.electionVolatility}</strong>
          </li>
          <li>
            <span>Invasion pressure</span>
            <strong>{scenarioInputs.invasionPressure}</strong>
          </li>
          <li>
            <span>Coup risk</span>
            <strong>{scenarioInputs.coupRisk}</strong>
          </li>
        </ul>
      </div>
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
                    {formatIndicator(entry.indicator)} · {entry.sourceId}
                  </span>
                  <strong>
                    {entry.observedAt} · {Math.round(entry.confidence * 100)}%
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
