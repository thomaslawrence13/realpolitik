import type { InformationQualityContract } from '../../types';

export const INFORMATION_QUALITY_CONTRACT: InformationQualityContract = {
  contractVersion: 'iq-contract-v1.0.0',
  scoringVersion: 'iq-score-v2.0.0',
  scoreWeights: {
    coverage: 0.3,
    completeness: 0.2,
    recency: 0.2,
    evidence: 0.15,
    confidence: 0.15,
  },
  staleThresholdDays: 730,
  lowCoverageThresholdPct: 70,
  warningCoverageThresholdPct: 80,
  minimumIndicatorConfidence: 0.55,
  outputs: [
    {
      key: 'dataQuality',
      origin: 'runtime-live',
      description: 'Per-country indicator-level quality telemetry used for staleness, confidence, and degraded reasons.',
    },
    {
      key: 'informationQualityTelemetry',
      origin: 'runtime-live',
      description: 'Aggregate quality scorecards and weakest/top cohorts produced from reconciled country profiles.',
    },
    {
      key: 'ingestTelemetry',
      origin: 'static-at-build',
      description: 'Ingestion coverage and newest-observation metadata emitted from ingest artifacts.',
    },
    {
      key: 'trustSummary',
      origin: 'runtime-live',
      description: 'UI trust label derived from country dataQuality, coverage, freshness, and evidence class.',
    },
  ],
  kpiTargets: {
    minimumAverageInformationScore: 70,
    maximumLowQualityCountries: 28,
    maximumStaleCountries: 18,
    maximumStaticRuntimeScoreDelta: 8,
  },
};
