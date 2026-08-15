import type {
  EnhancementReleaseTelemetry,
  InformationQualityContract,
  InformationQualityTelemetry,
  IngestTelemetry,
} from '../../types';
import {
  indicatorQualityRules,
  indicatorSourcePriority,
  relationshipDimensionQualityRules,
  relationshipDimensionSourcePriority,
} from '../../data/pipeline/rules';
import {
  AUTHORITY_LABEL,
  AUTHORITY_RANK,
  SOURCE_REGISTRY,
  type SourceAccess,
} from '../../data/sourceRegistry';
import {
  ARTIFACT_STATUS_LABEL,
  buildArtifactRegisterTelemetry,
} from '../../data/artifactRegistry';

const ACCESS_LABEL: Record<SourceAccess, string> = {
  'live-api': 'Live API',
  'build-ingest': 'Ingested snapshot',
  curated: 'Curated',
};

/** Most authoritative first, then freshest-publishing, then alphabetical. */
const REGISTERED_SOURCES = Object.values(SOURCE_REGISTRY).sort((left, right) => {
  const tierDiff = AUTHORITY_RANK[left.authorityTier] - AUTHORITY_RANK[right.authorityTier];
  if (tierDiff !== 0) return tierDiff;
  const lagDiff = left.typicalLagMonths - right.typicalLagMonths;
  if (lagDiff !== 0) return lagDiff;
  return left.publisher.localeCompare(right.publisher);
});

export function MethodologyPanel({
  notes,
  informationQuality,
  baselineInformationQuality,
  informationQualityContract,
  ingestTelemetry,
  enhancementReleaseTelemetry,
  liveDataDiagnostics,
}: {
  notes: string[];
  informationQuality: InformationQualityTelemetry;
  baselineInformationQuality: InformationQualityTelemetry;
  informationQualityContract: InformationQualityContract;
  ingestTelemetry: IngestTelemetry;
  enhancementReleaseTelemetry: EnhancementReleaseTelemetry;
  liveDataDiagnostics: {
    totalIndicators: number;
    succeededIndicators: number;
    failedIndicators: number;
    failedCodes: string[];
    latestObservedYear?: string | null;
    source?: 'backend' | 'direct';
    refreshedAt?: string | null;
  } | null;
}) {
  const priorityCountries = informationQuality.weakestInformationCountries.slice(0, 8);
  const pipelineReconciliation = Object.entries(indicatorSourcePriority).map(([indicator, priority]) => ({
    key: indicator,
    label: indicator,
    priority,
  }));
  const relationshipReconciliation = Object.entries(relationshipDimensionSourcePriority).map(([dimension, priority]) => ({
    key: dimension,
    label: dimension,
    priority,
  }));
  const indicatorCadence = Object.entries(indicatorQualityRules).map(([indicator, rule]) => ({
    key: indicator,
    label: indicator,
    cadence: rule.cadence,
    staleAfterDays: rule.staleAfterDays,
    minimumConfidence: rule.minimumConfidence,
  }));
  const relationshipCadence = Object.entries(relationshipDimensionQualityRules).map(([dimension, rule]) => ({
    key: dimension,
    label: dimension,
    cadence: rule.cadence,
    staleAfterDays: rule.staleAfterDays,
    minimumConfidence: rule.minimumConfidence,
  }));
  const revisionEntries = notes
    .map((note) => {
      const match = note.match(/^(v\d+)\s*\(([^)]+)\):\s*(.+)$/i);
      if (!match) return null;
      return {
        version: match[1]!.toUpperCase(),
        scope: match[2]!,
        detail: match[3]!,
      };
    })
    .filter((entry): entry is { version: string; scope: string; detail: string } => Boolean(entry))
    .reverse();
  const methodologyFormulas = [
    'Tier thresholds: low/medium/high are mapped through pipeline transforms before assessment scoring.',
    'Cohesion transform = baseline + GDP growth uplift − inflation penalty − unemployment penalty (bounded to 0–100).',
    'Risk stress index = baseline risk + structural vulnerabilities (external-debt pressure, water stress) + relationship tension (hostility, deterrence), clamped to 8–97.',
    'Confidence = data quality score: source coverage, dimensional completeness, recency, evidence class, indicator confidence.',
    'Alignment = deterministic reading of current defense pacts, alliance network, and UN General Assembly voting delta — no probability model.',
  ];
  const knownLimitations = [
    'Observed coverage varies by indicator and country; low-coverage or stale metrics trigger fallback evidence classes.',
    'Some relationship edges are derived rather than directly observed and are tagged lower confidence.',
    'Assessment outputs describe the observed present; they are not forecasts of future alignment or conflict.',
  ];
  // Four committed artifacts; recomputing per render keeps the displayed age
  // honest across a long-lived session rather than freezing it at module load.
  const artifactRegister = buildArtifactRegisterTelemetry();
  const staticRuntimeScoreDelta =
    Math.round(
      Math.abs(informationQuality.averageInformationScore - baselineInformationQuality.averageInformationScore) * 10,
    ) / 10;
  return (
    <div className="methodology-panel">
      <section className="scenario-meta-card">
        <strong>Information-quality contract baseline</strong>
        <p className="methodology-telemetry-line">
          Contract {informationQualityContract.contractVersion} · Scoring {informationQualityContract.scoringVersion}
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          Runtime avg {informationQuality.averageInformationScore} · Static avg {baselineInformationQuality.averageInformationScore} · Δ {staticRuntimeScoreDelta}
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          KPI status: avg {informationQuality.kpiStatus.averageInformationScoreWithinTarget ? '✓' : '✕'} · low-quality {informationQuality.kpiStatus.lowQualityCountWithinTarget ? '✓' : '✕'} · stale {informationQuality.kpiStatus.staleCountryCountWithinTarget ? '✓' : '✕'} · layer consistency {informationQuality.kpiStatus.staticRuntimeScoreDeltaWithinTarget ? '✓' : '✕'}
        </p>
        {liveDataDiagnostics && liveDataDiagnostics.failedIndicators > 0 && (
          <p className="methodology-telemetry-line methodology-telemetry-line-tight">
            Live ingest impact: {liveDataDiagnostics.failedIndicators}/{liveDataDiagnostics.totalIndicators} live indicators failed ({liveDataDiagnostics.failedCodes.join(', ')}).
          </p>
        )}
        {liveDataDiagnostics?.source && (
          <p className="methodology-telemetry-line methodology-telemetry-line-tight">
            Live path: {liveDataDiagnostics.source === 'backend' ? 'backend /api/state' : 'direct World Bank API'}
            {liveDataDiagnostics.refreshedAt ? ` · server refresh ${liveDataDiagnostics.refreshedAt.slice(0, 16).replace('T', ' ')} UTC` : ''}
          </p>
        )}
        {liveDataDiagnostics?.latestObservedYear && (
          <p className="methodology-telemetry-line methodology-telemetry-line-tight">
            Latest published World Bank observation: {liveDataDiagnostics.latestObservedYear} · retrieval time is tracked separately.
          </p>
        )}
      </section>
      <section className="scenario-meta-card">
        <strong>{enhancementReleaseTelemetry.releaseTag.toUpperCase()} release acceptance gate</strong>
        <p className="methodology-telemetry-line">
          Scope: {enhancementReleaseTelemetry.scope} · Dataset {enhancementReleaseTelemetry.datasetVersion} · Accepted {enhancementReleaseTelemetry.releaseAccepted ? '✓' : '✕'}
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          Coverage v10 {enhancementReleaseTelemetry.status.v10CoveragePct}% ({enhancementReleaseTelemetry.status.meetsV10Coverage ? '✓' : '✕'}) · v11 {enhancementReleaseTelemetry.status.v11CoveragePct}% ({enhancementReleaseTelemetry.status.meetsV11Coverage ? '✓' : '✕'})
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          Info score {enhancementReleaseTelemetry.status.averageInformationScore} ({enhancementReleaseTelemetry.status.meetsAverageInformationScore ? '✓' : '✕'}) · stale {enhancementReleaseTelemetry.status.staleCountryCount} ({enhancementReleaseTelemetry.status.meetsStaleCountryBudget ? '✓' : '✕'})
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          Confidence floor breaches {enhancementReleaseTelemetry.status.indicatorConfidenceFloorBreaches} ({enhancementReleaseTelemetry.status.meetsIndicatorConfidenceFloor ? '✓' : '✕'}) · avg relationships {enhancementReleaseTelemetry.status.averageRelationshipsPerCountry} ({enhancementReleaseTelemetry.status.meetsRelationshipCompleteness ? '✓' : '✕'})
        </p>
      </section>
      <section className="scenario-meta-card">
        <strong>Operational artifact register</strong>
        <p className="methodology-telemetry-line">
          The files this build actually retrieved and committed — distinct from the source registry
          below, which describes publishers rather than wired feeds. An artifact past its refresh
          budget is withheld from the overlay instead of being served stale.
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          {artifactRegister.artifacts.length} artifacts · fresh {artifactRegister.freshCount} · ageing{' '}
          {artifactRegister.agingCount} · stale {artifactRegister.staleCount} ·{' '}
          {artifactRegister.allWithinBudget ? 'all within budget ✓' : 'refresh required ✕'}
        </p>
        <div className="methodology-priority-grid">
          {artifactRegister.artifacts.map((artifact) => (
            <article
              key={`artifact-${artifact.id}`}
              className="methodology-priority-card"
              data-artifact-status={artifact.status}
            >
              <header>
                <strong>{artifact.title}</strong>
                <span className="methodology-priority-score">
                  {ARTIFACT_STATUS_LABEL[artifact.status]}
                </span>
              </header>
              <p>
                Retrieved {artifact.retrievedOn} · {artifact.ageDays}d of {artifact.budgetDays}d budget
                {artifact.vintage ? ` · ${artifact.vintage}` : ''}
              </p>
              <p>
                {artifact.publisher} · {artifact.coverage}
              </p>
              <p>{artifact.boundary}</p>
              {artifact.status !== 'fresh' && <p>Refresh: {artifact.refreshCommand}</p>}
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Evidence-class legend</strong>
        <p className="methodology-telemetry-line">
          Every indicator is tagged as one of: observed, estimated, derived, or fallback.
        </p>
        <div className="methodology-priority-gaps methodology-evidence-gaps">
          <span>Observed: direct external source signal</span>
          <span>Estimated: curated snapshot with acceptable quality</span>
          <span>Derived: computed from cross-source transforms</span>
          <span>Fallback: stale or low-confidence replacement</span>
        </div>
      </section>
      <ul className="methodology-list">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <section className="scenario-meta-card">
        <strong>Indicator formulas & transform rules</strong>
        <ul className="methodology-mini-list">
          {methodologyFormulas.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>
      <section className="scenario-meta-card">
        <strong>Information quality telemetry</strong>
        <p className="methodology-telemetry-line">
          Runtime assessed {new Date(informationQuality.assessedAt).toLocaleDateString()} · Average score {informationQuality.averageInformationScore}
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          High quality: {informationQuality.highQualityCount} · Low quality: {informationQuality.lowQualityCount} · Stale records: {informationQuality.staleCountryCount}
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          Targets → Avg ≥ {informationQuality.kpiTargets.minimumAverageInformationScore} · Low-quality ≤ {informationQuality.kpiTargets.maximumLowQualityCountries} · Stale ≤ {informationQuality.kpiTargets.maximumStaleCountries}
        </p>
        <div className="methodology-priority-targets">
          <strong className="methodology-priority-label">Priority refresh targets:</strong>{' '}
          {priorityCountries
            .slice(0, 5)
            .map((country) => `${country.displayName} (${country.informationScore})`)
            .join(', ')}
        </div>
        <div className="methodology-priority-grid">
          {priorityCountries.map((country) => (
            <article key={country.countryId} className="methodology-priority-card">
              <header>
                <strong>{country.displayName}</strong>
                <span className="methodology-priority-score">{country.informationScore}</span>
              </header>
              <p>
                Fresh coverage {country.sourceCoverage}% · Completeness {Math.round(country.completeness * 100)}%
                {country.stale ? ` · ${country.yearsStale}y stale` : ''} · Fallback {country.fallbackIndicatorCount} · Low confidence {country.lowConfidenceIndicatorCount}
              </p>
              {country.gaps.length > 0 && (
                <div className="methodology-priority-gaps">
                  {country.gaps.slice(0, 3).map((gap) => (
                    <span key={`${country.countryId}-${gap}`}>{gap}</span>
                  ))}
                </div>
              )}
              {country.remediationDrivers.length > 0 && (
                <p className="methodology-telemetry-line methodology-telemetry-line-tight">
                  {country.remediationDrivers[0]}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Quality output inventory</strong>
        <div className="methodology-priority-grid">
          {informationQualityContract.outputs.map((entry) => (
            <article key={`quality-output-${entry.key}`} className="methodology-priority-card">
              <header>
                <strong>{entry.key}</strong>
                <span className="methodology-priority-score">{entry.origin}</span>
              </header>
              <p>{entry.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Data sources</strong>
        <p className="methodology-telemetry-line">
          Ranked by publishing authority, then by how quickly each source releases. Lag is the
          typical gap between the period a figure describes and its publication.
        </p>
        <div className="methodology-priority-grid">
          {REGISTERED_SOURCES.map((source) => (
            <article key={`source-${source.id}`} className="methodology-priority-card">
              <header>
                <strong>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer noopener">
                      {source.title}
                    </a>
                  ) : (
                    source.title
                  )}
                </strong>
                <span className="methodology-priority-score">{ACCESS_LABEL[source.access]}</span>
              </header>
              <p>
                {source.publisher} · {AUTHORITY_LABEL[source.authorityTier]} · {source.cadence} ·{' '}
                {source.typicalLagMonths === 0 ? 'no lag' : `~${source.typicalLagMonths}mo lag`}
              </p>
              {source.note && <p className="methodology-telemetry-line-tight">{source.note}</p>}
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Source reconciliation priority rules</strong>
        <p className="methodology-telemetry-line">
          Conflicts are resolved by source rank, then confidence, then the period each figure
          describes, preferring reported outturns over projections.
        </p>
        <div className="methodology-priority-grid">
          {pipelineReconciliation.map((entry) => (
            <article key={`indicator-priority-${entry.key}`} className="methodology-priority-card">
              <header>
                <strong>{entry.label}</strong>
                <span className="methodology-priority-score">indicator</span>
              </header>
              <p>{entry.priority.join(' → ')}</p>
            </article>
          ))}
          {relationshipReconciliation.map((entry) => (
            <article key={`relationship-priority-${entry.key}`} className="methodology-priority-card">
              <header>
                <strong>{entry.label}</strong>
                <span className="methodology-priority-score">relationship</span>
              </header>
              <p>{entry.priority.join(' → ')}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Ingest coverage telemetry</strong>
        <p className="methodology-telemetry-line">
          Generated {new Date(ingestTelemetry.generatedAt).toLocaleDateString()} · Average indicator coverage {ingestTelemetry.averageCoveragePct}%
        </p>
        <p className="methodology-telemetry-line methodology-telemetry-line-tight">
          Provider: {ingestTelemetry.provider} · Requested countries: {ingestTelemetry.requestedCountryCount}
        </p>
        <div className="methodology-priority-grid">
          {ingestTelemetry.strongestIndicators.map((indicator) => (
            <article key={`strong-${indicator.snapshotKey}`} className="methodology-priority-card">
              <header>
                <strong>{indicator.label}</strong>
                <span className="methodology-priority-score">{indicator.coverageCount}</span>
              </header>
              <p>Strongest coverage · Missing {indicator.missingCountryCount} · Latest {indicator.newestObservation ?? 'n/a'}</p>
            </article>
          ))}
          {ingestTelemetry.weakestIndicators.map((indicator) => (
            <article key={`weak-${indicator.snapshotKey}`} className="methodology-priority-card">
              <header>
                <strong>{indicator.label}</strong>
                <span className="methodology-priority-score">{indicator.coverageCount}</span>
              </header>
              <p>Weakest coverage · Missing {indicator.missingCountryCount} · Latest {indicator.newestObservation ?? 'n/a'}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Refresh cadence & quality floors</strong>
        <p className="methodology-telemetry-line">
          Quality notices appear when data age exceeds SLA or confidence falls below minimum thresholds.
        </p>
        <div className="methodology-priority-grid">
          {indicatorCadence.map((entry) => (
            <article key={`cadence-indicator-${entry.key}`} className="methodology-priority-card">
              <header>
                <strong>{entry.label}</strong>
                <span className="methodology-priority-score">{entry.cadence}</span>
              </header>
              <p>Stale after {entry.staleAfterDays}d · Minimum confidence {Math.round(entry.minimumConfidence * 100)}%</p>
            </article>
          ))}
          {relationshipCadence.map((entry) => (
            <article key={`cadence-relationship-${entry.key}`} className="methodology-priority-card">
              <header>
                <strong>{entry.label}</strong>
                <span className="methodology-priority-score">{entry.cadence}</span>
              </header>
              <p>Stale after {entry.staleAfterDays}d · Minimum confidence {Math.round(entry.minimumConfidence * 100)}%</p>
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-meta-card">
        <strong>Known limitations</strong>
        <ul className="methodology-mini-list">
          {knownLimitations.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>
      <section className="scenario-meta-card">
        <strong>Data revision changelog</strong>
        {revisionEntries.length === 0 ? (
          <p className="methodology-telemetry-line">No structured revision entries found in methodology notes.</p>
        ) : (
          <div className="methodology-priority-grid">
            {revisionEntries.map((entry) => (
              <article key={`${entry.version}-${entry.scope}`} className="methodology-priority-card">
                <header>
                  <strong>{entry.version}</strong>
                  <span className="methodology-priority-score">{entry.scope}</span>
                </header>
                <p>{entry.detail}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
