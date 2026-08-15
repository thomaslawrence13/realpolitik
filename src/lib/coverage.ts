import type { CoverageMetrics } from '../types';

type CoverageProfile = {
  sourceCoverage: number;
  dataQuality?: {
    coverage?: CoverageMetrics;
  };
};

/** Read explicit runtime coverage, with a compatibility fallback for old stubs/artifacts. */
export const getCoverageMetrics = (profile: CoverageProfile): CoverageMetrics =>
  profile.dataQuality?.coverage ?? {
    valuePct: profile.sourceCoverage,
    observedPct: 0,
    freshPct: profile.sourceCoverage,
    fallbackPct: 0,
    stalePct: 0,
    lowConfidencePct: 0,
  };

export const getFreshCoverage = (profile: CoverageProfile): number => getCoverageMetrics(profile).freshPct;
