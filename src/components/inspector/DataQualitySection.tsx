import type { CountryAssessment, EvidenceClass, IndicatorTelemetry } from '../../types';
import { getCoverageMetrics } from '../../lib/coverage';
import { formatEvidenceClass, formatIndicatorLabel } from '../inspectorUtils';

const evidenceOrder: EvidenceClass[] = ['observed', 'estimated', 'derived', 'fallback'];

const weaknessScore = (entry: IndicatorTelemetry): number =>
  (entry.stale ? 1000 : 0) +
  (entry.evidenceClass === 'fallback' ? 500 : entry.evidenceClass === 'derived' ? 250 : entry.evidenceClass === 'estimated' ? 100 : 0) +
  (100 - entry.confidence);

export function DataQualitySection({ selected }: { selected: CountryAssessment }) {
  const quality = selected.profile.dataQuality;
  const coverage = getCoverageMetrics(selected.profile);
  const indicators = quality?.indicators ?? [];
  const evidenceCounts = evidenceOrder.map((evidenceClass) => ({
    evidenceClass,
    count: indicators.filter((entry) => entry.evidenceClass === evidenceClass).length,
  })).filter(({ count }) => count > 0);
  const sources = new Set(indicators.map((entry) => entry.sourceId));
  const orderedIndicators = [...indicators].sort((left, right) => weaknessScore(right) - weaknessScore(left));
  const issues = quality?.degradedReasons ?? [];
  const coverageRows = [
    { label: 'Values available', value: coverage.valuePct, tone: 'neutral' },
    { label: 'Observed evidence', value: coverage.observedPct, tone: 'positive' },
    { label: 'Fresh within SLA', value: coverage.freshPct, tone: 'positive' },
    { label: 'Fallback values', value: coverage.fallbackPct, tone: 'negative' },
  ] as const;

  return (
    <section className="profile-section quality-section">
      <h3 className="profile-section-title">
        <span className="profile-section-icon" aria-hidden>✓</span>
        Data quality
        <span className="quality-score" data-tone={selected.confidence >= 75 ? 'positive' : selected.confidence < 60 ? 'negative' : 'neutral'}>
          {selected.confidence}% confidence
        </span>
      </h3>
      <p className="quality-summary">
        {indicators.length} assessed indicators from {sources.size} {sources.size === 1 ? 'source' : 'sources'} · telemetry computed {quality?.computedLastUpdated ?? selected.profile.lastUpdated}
      </p>
      <div className="quality-coverage-grid">
        {coverageRows.map((row) => (
          <div className="quality-coverage-row" data-tone={row.tone} key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}%</strong>
            <i aria-hidden><b style={{ width: `${Math.max(0, Math.min(100, row.value))}%` }} /></i>
          </div>
        ))}
      </div>
      <div className="quality-evidence-mix" aria-label="Evidence class mix">
        {evidenceCounts.map(({ evidenceClass, count }) => (
          <span data-evidence={evidenceClass} key={evidenceClass}>
            {formatEvidenceClass(evidenceClass)} <strong>{count}</strong>
          </span>
        ))}
        {coverage.stalePct > 0 && <span data-evidence="warning">Stale <strong>{coverage.stalePct}%</strong></span>}
        {coverage.lowConfidencePct > 0 && <span data-evidence="warning">Low confidence <strong>{coverage.lowConfidencePct}%</strong></span>}
      </div>
      <div className={`quality-notice ${issues.length > 0 ? 'quality-notice-warning' : 'quality-notice-good'}`}>
        <strong>{issues.length > 0 ? `${issues.length} remediation ${issues.length === 1 ? 'issue' : 'issues'}` : 'No active quality degradations'}</strong>
        {issues.length > 0 && (
          <ul>{issues.slice(0, 4).map((issue) => <li key={issue}>{issue}</li>)}</ul>
        )}
      </div>
      {orderedIndicators.length > 0 && (
        <details className="quality-details">
          <summary>Indicator evidence audit <span>{orderedIndicators.length} fields</span></summary>
          <div className="quality-audit-list">
            {orderedIndicators.map((entry) => (
              <div className="quality-audit-row" key={entry.indicator}>
                <strong>{formatIndicatorLabel(entry.indicator)}</strong>
                <span>{entry.confidence}% · {entry.sourceId}</span>
                <em data-stale={entry.stale || undefined}>{formatEvidenceClass(entry.evidenceClass)} · {entry.observedAt}{entry.stale ? ' · stale' : ''}</em>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
