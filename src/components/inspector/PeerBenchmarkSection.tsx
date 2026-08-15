import type { CountryBenchmarkSummary } from './benchmarks';

export function PeerBenchmarkSection({ summary }: { summary: CountryBenchmarkSummary }) {
  if (summary.metrics.length === 0) return null;
  return (
    <section className="glance-card benchmark-section">
      <header>
        <div>
          <h3>Peer context</h3>
          <p className="section-caption">Regional median and global distribution.</p>
        </div>
        <span title="Ranked from highest to lowest stress">risk rank #{summary.riskRank} / {summary.countryCount}</span>
      </header>
      <div className="benchmark-list">
        {summary.metrics.slice(0, 4).map((metric) => (
          <article className="benchmark-row" data-tone={metric.tone} key={metric.id}>
            <div className="benchmark-copy">
              <span>{metric.label}</span>
              <strong>{metric.valueLabel}</strong>
              <em>{metric.comparison} · median {metric.regionalMedianLabel}</em>
            </div>
            <div className="benchmark-position">
              <span>{metric.percentile}%</span>
              <i aria-hidden><b style={{ width: `${metric.percentile}%` }} /></i>
              <em>at or below globally</em>
            </div>
          </article>
        ))}
      </div>
      <p className="benchmark-footnote">Compared with {summary.regionalPeerCount} countries in the same region.</p>
    </section>
  );
}
