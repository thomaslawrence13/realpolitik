import type { CountryProfile, IndicatorTelemetry, SimulatedCountry } from '../types';
import { INFORMATION_QUALITY_CONTRACT } from '../data/quality/contract';

export type TrustSummary = {
  tone: 'good' | 'warning' | 'bad';
  label: string;
  detail: string;
};

const HIGH_COVERAGE = INFORMATION_QUALITY_CONTRACT.warningCoverageThresholdPct;
const LOW_COVERAGE = INFORMATION_QUALITY_CONTRACT.lowCoverageThresholdPct;

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

export function TrustTag({ summary, compact = false }: { summary: TrustSummary; compact?: boolean }) {
  if (compact) {
    return <span className={`trust-dot trust-dot-${summary.tone}`} title={summary.label} aria-label={summary.label} />;
  }
  return <span className={`trust-tag trust-tag-${summary.tone}`}>{summary.label}</span>;
}

export type GlobalDataWarning = {
  type: 'stale-world-bank' | 'low-coverage' | 'other';
  message: string;
  countryCount: number;
  countryExamples: string[];
};

export const aggregateGlobalDataWarnings = (countries: SimulatedCountry[]): GlobalDataWarning[] => {
  const warnings = new Map<string, { count: Set<string>; examples: Set<string> }>();

  countries.forEach((country) => {
    const reasons = country.profile.dataQuality?.degradedReasons ?? [];
    reasons.forEach((reason) => {
      // Categorize the warning
      let category: GlobalDataWarning['type'] = 'other';
      if (reason.includes('world-bank') || reason.includes('WDI')) {
        category = 'stale-world-bank';
      } else if (reason.includes('coverage')) {
        category = 'low-coverage';
      }

      if (!warnings.has(category)) {
        warnings.set(category, { count: new Set(), examples: new Set() });
      }
      const entry = warnings.get(category)!;
      entry.count.add(country.profile.mapName);
      if (entry.examples.size < 3) {
        entry.examples.add(country.profile.displayName);
      }
    });
  });

  const result: GlobalDataWarning[] = [];

  // Stale World Bank data
  if (warnings.has('stale-world-bank')) {
    const data = warnings.get('stale-world-bank')!;
    result.push({
      type: 'stale-world-bank',
      message: `World Bank WDI data is stale for ${data.count.size} ${data.count.size === 1 ? 'country' : 'countries'}`,
      countryCount: data.count.size,
      countryExamples: Array.from(data.examples),
    });
  }

  // Low coverage
  if (warnings.has('low-coverage')) {
    const data = warnings.get('low-coverage')!;
    result.push({
      type: 'low-coverage',
      message: `${data.count.size} ${data.count.size === 1 ? 'country has' : 'countries have'} low source coverage`,
      countryCount: data.count.size,
      countryExamples: Array.from(data.examples),
    });
  }

  return result.sort((a, b) => b.countryCount - a.countryCount);
};
