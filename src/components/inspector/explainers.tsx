import type { ReactNode } from 'react';
import type {
  ContributionLine,
  ConfidenceExplanation,
  ProbabilityExplanation,
  RiskExplanation,
} from '../../types';
import { formatNumber, formatSigned } from '../inspectorUtils';

export type ExplainerRow = {
  label: string;
  contribution: number;
  multiplier?: number;
  inputValue?: number;
  isBase?: boolean;
};

export function ExplainerCard({
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

export function RiskExplainer({ explanation }: { explanation: RiskExplanation }) {
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

export function ConfidenceExplainer({ explanation }: { explanation: ConfidenceExplanation }) {
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

export function ProbabilityExplainer({
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

export function toRows(components: ContributionLine[]): ExplainerRow[] {
  return components.map((component) => ({
    label: component.label,
    contribution: component.contribution,
    multiplier: component.multiplier,
    inputValue: component.inputValue,
  }));
}
