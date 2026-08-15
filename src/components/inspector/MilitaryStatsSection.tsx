import type { DatasetSource, MilitaryStats, CountryAssessment } from '../../types';
import { InlineSourceTag } from './EconomicStatsSection';
import { MetricProvenanceTag, MetricTelemetryTag, getIndicatorTelemetry } from './shared';

interface MilitaryStatsSectionProps {
  mil: MilitaryStats;
  sources: DatasetSource[];
  selected: CountryAssessment;
}

/**
 * Military statistics section component displaying defense spending, personnel, nuclear status.
 */
export function MilitaryStatsSection({ mil, sources, selected }: MilitaryStatsSectionProps) {
  const militaryTelemetry = getIndicatorTelemetry(selected, 'militaryTreatyLevel');

  return (
    <div className="profile-section">
      <h3 className="profile-section-title">
        <span className="profile-section-icon" aria-hidden={true}>🛡</span>
        Military
        <span className="profile-section-source">
          <InlineSourceTag sources={sources} ids={['sipri-milex', 'iiss-military-balance']} />
        </span>
      </h3>
      <div className="profile-stat-grid">
        <div className="profile-stat">
          <span className="profile-stat-label">Defence spending</span>
          <div className="profile-stat-value-group">
            <strong className="profile-stat-value">${mil.militaryExpBillionUsd.toLocaleString()}B</strong>
          </div>
          <span className="profile-stat-sub">annual</span>
          <MetricProvenanceTag entry={mil.provenance?.militaryExpBillionUsd} sources={sources} />
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Spending / GDP</span>
          <div className="profile-stat-value-group">
            <strong className="profile-stat-value">{mil.militaryExpGdpPct}%</strong>
          </div>
          <span className="profile-stat-sub">burden</span>
          <MetricProvenanceTag entry={mil.provenance?.militaryExpGdpPct} sources={sources} />
          <MetricTelemetryTag entry={militaryTelemetry} fallbackLabel="Curated military snapshot" />
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Active personnel</span>
          <div className="profile-stat-value-group">
            <strong className="profile-stat-value">
              {mil.activePersonnelThousands > 0 ? `${mil.activePersonnelThousands.toLocaleString()}k` : '—'}
            </strong>
          </div>
          <span className="profile-stat-sub">troops</span>
          <MetricProvenanceTag entry={mil.provenance?.activePersonnelThousands} sources={sources} />
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Nuclear armed</span>
          <div className="profile-stat-value-group">
            <strong
              className="profile-stat-value"
              data-tone={mil.nuclearArmed ? 'negative' : 'neutral'}
            >
              {mil.nuclearArmed ? 'Yes' : 'No'}
            </strong>
          </div>
          <MetricProvenanceTag entry={mil.provenance?.nuclearArmed} sources={sources} />
        </div>
      </div>
    </div>
  );
}
