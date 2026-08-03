import { useState } from 'react';
import type { Alignment, SimulatedCountry } from '../../types';
import { getRiskTier } from '../../simulation';
import { BarRow, MetricCard, SvgIcon } from '../ui';
import { formatPercent } from '../inspectorUtils';
import { PROBABILITY_KEYS, SparklineSeries, DeltaHint, MetricTelemetryTag, getIndicatorTelemetry } from './shared';
import { ComparisonSection } from './ComparisonSection';
import { ConfidenceExplainer, ProbabilityExplainer, RiskExplainer } from './explainers';

export function OverviewPanel({
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
  const [disclosureState, setDisclosureState] = useState({
    details: false,
    alignment: false,
    relationships: false,
    trend: false,
  });
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

      <button
        type="button"
        className="disclosure-toggle"
        onClick={() => setDisclosureState({ ...disclosureState, details: !disclosureState.details })}
        aria-expanded={disclosureState.details}
      >
        <SvgIcon.Chevron dir={disclosureState.details ? 'down' : 'right'} />
        <span>Details</span>
      </button>

      {disclosureState.details && (
        <div className="metric-grid">
          <MetricCard
            label="Confidence"
            value={formatPercent(selected.confidence)}
            hint={<DeltaHint delta={confidenceDelta} higherIsBetter />}
            explanation={selected.explanation ? <ConfidenceExplainer explanation={selected.explanation.confidence} /> : undefined}
            barValue={selected.confidence}
            tone="accent"
          />
          <MetricCard
            label="Conflict pressure index"
            value={formatPercent(selected.risk)}
            hint={<DeltaHint delta={riskDelta} higherIsBetter={false} />}
            tone={getRiskTier(selected.risk)}
            explanation={selected.explanation ? <RiskExplainer explanation={selected.explanation.risk} /> : undefined}
            barValue={selected.risk}
          />
          <MetricCard
            label="Source coverage"
            value={formatPercent(selected.profile.sourceCoverage)}
            hint={<MetricTelemetryTag fallbackLabel="Profile coverage" />}
            barValue={selected.profile.sourceCoverage}
            tone="low"
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

      {sparkline && sparkline.active.length > 1 && (
        <div className="section">
          <button
            type="button"
            className="disclosure-toggle"
            onClick={() => setDisclosureState({ ...disclosureState, trend: !disclosureState.trend })}
            aria-expanded={disclosureState.trend}
          >
            <SvgIcon.Chevron dir={disclosureState.trend ? 'down' : 'right'} />
            <span>Risk trajectory</span>
          </button>
          {disclosureState.trend && (
            <div style={{ marginTop: '0.5rem' }}>
              <RiskSparkline series={sparkline} />
            </div>
          )}
        </div>
      )}

      <div className="section">
        <button
          type="button"
          className="disclosure-toggle"
          onClick={() => setDisclosureState({ ...disclosureState, alignment: !disclosureState.alignment })}
          aria-expanded={disclosureState.alignment}
        >
          <SvgIcon.Chevron dir={disclosureState.alignment ? 'down' : 'right'} />
          <span>Alignment model</span>
        </button>
        {disclosureState.alignment && (
          <div className="bar-stack" style={{ marginTop: '0.5rem' }}>
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
        )}
      </div>

      <div className="section">
        <button
          type="button"
          className="disclosure-toggle"
          onClick={() => setDisclosureState({ ...disclosureState, relationships: !disclosureState.relationships })}
          aria-expanded={disclosureState.relationships}
        >
          <SvgIcon.Chevron dir={disclosureState.relationships ? 'down' : 'right'} />
          <span>Relationship dimensions</span>
        </button>
        {disclosureState.relationships && (
          <div className="metric-grid metric-grid-tight" style={{ marginTop: '0.5rem' }}>
            <MetricCard
              label="Cooperation"
              value={formatPercent(selected.relationshipSummary.cooperation)}
              tone="accent"
              size="sm"
              barValue={selected.relationshipSummary.cooperation}
              barColor="#38bdf8"
            />
            <MetricCard
              label="Hostility"
              value={formatPercent(selected.relationshipSummary.hostility)}
              tone={getRiskTier(selected.relationshipSummary.hostility)}
              size="sm"
              barValue={selected.relationshipSummary.hostility}
              barColor="#fb7185"
            />
            <MetricCard
              label="Dependency"
              value={formatPercent(selected.relationshipSummary.dependency)}
              size="sm"
              barValue={selected.relationshipSummary.dependency}
              barColor="#f59e0b"
            />
            <MetricCard
              label="Deterrence"
              value={formatPercent(selected.relationshipSummary.deterrence)}
              size="sm"
              barValue={selected.relationshipSummary.deterrence}
              barColor="#a78bfa"
            />
          </div>
        )}
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

export function RiskSparkline({ series }: { series: SparklineSeries }) {
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
