import type { CountryRelationship } from '../../types';
import { relationshipDimensionLabels, relationshipEvidenceTimeline } from '../../lib/relationshipEvidence';

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
};

export function RelationshipEvidenceSection({ relationships }: { relationships: CountryRelationship[] }) {
  return (
    <section className="glance-card relationship-evidence-section">
      <header>
        <div>
          <h3>Relationship evidence</h3>
          <p className="section-caption">Latest observed evidence per edge dimension, with source timing.</p>
        </div>
        <span>{relationships.length} edges</span>
      </header>
      {relationships.length === 0 ? (
        <p className="glance-empty">No relationship evidence is available for this country.</p>
      ) : (
        <div className="relationship-evidence-list">
          {relationships.map((relationship) => {
            const points = relationshipEvidenceTimeline(relationship);
            return (
              <article key={relationship.mapName} className="relationship-evidence-card">
                <div className="relationship-evidence-card-head">
                  <strong>{relationship.displayName}</strong>
                  <span>Updated {relationship.dataQuality?.computedLastUpdated ?? relationship.lastUpdated}</span>
                </div>
                <div className="relationship-evidence-values">
                  <span>Coop <strong>{relationship.cooperation}</strong></span>
                  <span>Host <strong>{relationship.hostility}</strong></span>
                  <span>Dep <strong>{relationship.dependency}</strong></span>
                  <span>Det <strong>{relationship.deterrence}</strong></span>
                </div>
                {points.length > 0 ? (
                  <ol className="relationship-evidence-timeline">
                    {points.map((point) => (
                      <li key={`${point.dimension}-${point.sourceId}`}>
                        <time dateTime={point.observedAt}>{formatDate(point.observedAt)}</time>
                        <span>{relationshipDimensionLabels[point.dimension]} · {point.sourceId}</span>
                        <strong>{point.value}</strong>
                        {point.stale && <em>stale</em>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="relationship-evidence-empty">Static edge record · {formatDate(relationship.lastUpdated)}</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
