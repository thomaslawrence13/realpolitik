import type { CountryProfile, IndicatorTelemetry } from '../types';

export type TrustSummary = {
  tone: 'good' | 'warning' | 'bad';
  label: string;
  detail: string;
};

const HIGH_COVERAGE = 80;
const LOW_COVERAGE = 60;

const evidenceRank = {
  observed: 0,
  estimated: 1,
  derived: 2,
  fallback: 3,
} as const;

const getPrimaryTelemetry = (profile: CountryProfile): IndicatorTelemetry | null => {
  const indicators = profile.dataQuality?.indicators ?? [];
  return indicators
    .slice()
    .sort((left, right) => {
      if (left.stale !== right.stale) return Number(left.stale) - Number(right.stale);
      const evidenceDelta = evidenceRank[left.evidenceClass] - evidenceRank[right.evidenceClass];
      if (evidenceDelta !== 0) return evidenceDelta;
      return right.confidence - left.confidence;
    })[0] ?? null;
};

export const summarizeCountryTrust = (profile: CountryProfile): TrustSummary => {
  const primary = getPrimaryTelemetry(profile);
  const degradedReasons = profile.dataQuality?.degradedReasons ?? [];
  const lowCoverage = profile.sourceCoverage < LOW_COVERAGE;
  const partialCoverage = profile.sourceCoverage < HIGH_COVERAGE;
  const stale = Boolean(primary?.stale);
  const fallback = primary?.evidenceClass === 'fallback';
  const derived = primary?.evidenceClass === 'derived';
  const mismatch = Boolean(
    profile.dataQuality &&
      (profile.dataQuality.computedLastUpdated !== profile.lastUpdated ||
        profile.dataQuality.computedSourceCoverage !== profile.sourceCoverage),
  );

  if (lowCoverage || stale || fallback || mismatch) {
    return {
      tone: 'bad',
      label: mismatch ? 'Telemetry mismatch' : lowCoverage ? 'Low coverage' : stale ? 'Stale data' : 'Fallback data',
      detail: degradedReasons[0] ?? `${profile.sourceCoverage}% coverage · updated ${profile.lastUpdated}`,
    };
  }

  if (partialCoverage || derived || degradedReasons.length > 0) {
    return {
      tone: 'warning',
      label: partialCoverage ? 'Partial coverage' : derived ? 'Derived signal' : 'Quality notice',
      detail: degradedReasons[0] ?? `${profile.sourceCoverage}% coverage · updated ${profile.lastUpdated}`,
    };
  }

  return {
    tone: 'good',
    label: 'Observed data',
    detail: primary
      ? `${profile.sourceCoverage}% coverage · ${primary.sourceId} · ${primary.observedAt}`
      : `${profile.sourceCoverage}% coverage · updated ${profile.lastUpdated}`,
  };
};

export function TrustTag({ summary }: { summary: TrustSummary }) {
  return <span className={`trust-tag trust-tag-${summary.tone}`}>{summary.label}</span>;
}