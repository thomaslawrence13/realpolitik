import type {
  CountryDataQuality,
  CountryInformationScore,
  CountryProfile,
  InformationQualityKpiStatus,
  InformationQualityTelemetry,
} from '../../types';
import { INFORMATION_QUALITY_CONTRACT } from './contract';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const nowIso = () => new Date().toISOString();

const toDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysOld = (value: string): number | null => {
  const date = toDate(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
};

const bounded = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const average = (values: number[]) => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);

const assessCountryCompleteness = (country: CountryProfile) => {
  const checks = [
    Boolean(country.economicStats),
    Boolean(country.militaryStats),
    Boolean(country.demographics),
    Boolean(country.energy),
    Boolean(country.topTradePartners?.length),
    Boolean(country.geo),
    Boolean(country.cyber),
    Boolean(country.fiscal),
    Boolean(country.foodWater),
    Boolean(country.diplomatic),
    Boolean(country.criticalMinerals),
    Boolean(country.softPower),
  ];
  return checks.filter(Boolean).length / checks.length;
};

const summarizeEvidence = (dataQuality?: CountryDataQuality) => {
  const summary = { observed: 0, estimated: 0, derived: 0, fallback: 0 };
  (dataQuality?.indicators ?? []).forEach((indicator) => {
    summary[indicator.evidenceClass] += 1;
  });
  return summary;
};

export const deriveQualityRemediationDrivers = (country: CountryProfile): string[] => {
  const indicators = country.dataQuality?.indicators ?? [];
  const staleCount = indicators.filter((indicator) => indicator.stale).length;
  const fallbackCount = indicators.filter((indicator) => indicator.evidenceClass === 'fallback').length;
  const lowConfidenceCount = indicators.filter(
    (indicator) => indicator.confidence < INFORMATION_QUALITY_CONTRACT.minimumIndicatorConfidence,
  ).length;
  const drivers: Array<{ label: string; severity: number }> = [];

  if (country.sourceCoverage < INFORMATION_QUALITY_CONTRACT.lowCoverageThresholdPct) {
    drivers.push({
      label: `Raise source coverage from ${country.sourceCoverage}% toward ${INFORMATION_QUALITY_CONTRACT.lowCoverageThresholdPct}%+ baseline.`,
      severity: INFORMATION_QUALITY_CONTRACT.lowCoverageThresholdPct - country.sourceCoverage,
    });
  }
  if (staleCount > 0) {
    drivers.push({
      label: `Refresh ${staleCount} stale indicator${staleCount === 1 ? '' : 's'} exceeding freshness SLA.`,
      severity: staleCount * 8,
    });
  }
  if (fallbackCount > 0) {
    drivers.push({
      label: `Replace ${fallbackCount} fallback indicator${fallbackCount === 1 ? '' : 's'} with observed or higher-confidence evidence.`,
      severity: fallbackCount * 6,
    });
  }
  if (lowConfidenceCount > 0) {
    drivers.push({
      label: `Improve confidence for ${lowConfidenceCount} low-confidence indicator${lowConfidenceCount === 1 ? '' : 's'}.`,
      severity: lowConfidenceCount * 5,
    });
  }
  (country.dataQuality?.degradedReasons ?? []).slice(0, 3).forEach((reason) => {
    drivers.push({ label: reason, severity: 2 });
  });

  return drivers
    .sort((left, right) => right.severity - left.severity || left.label.localeCompare(right.label))
    .map((entry) => entry.label)
    .slice(0, 5);
};

const toCountryInformationScore = (country: CountryProfile): CountryInformationScore => {
  const weights = INFORMATION_QUALITY_CONTRACT.scoreWeights;
  const indicators = country.dataQuality?.indicators ?? [];
  const evidenceSummary = summarizeEvidence(country.dataQuality);
  const totalIndicators = indicators.length;
  const staleIndicatorCount = indicators.filter((indicator) => indicator.stale).length;
  const fallbackIndicatorCount = indicators.filter((indicator) => indicator.evidenceClass === 'fallback').length;
  const lowConfidenceIndicatorCount = indicators.filter(
    (indicator) => indicator.confidence < INFORMATION_QUALITY_CONTRACT.minimumIndicatorConfidence,
  ).length;
  const completeness = assessCountryCompleteness(country);
  const averageIndicatorConfidence = average(indicators.map((indicator) => indicator.confidence));
  const staleRatio = totalIndicators === 0 ? 1 : staleIndicatorCount / totalIndicators;
  const yearsStale = Math.max(0, Math.floor((daysOld(country.lastUpdated) ?? 0) / 365));
  const evidenceRatio =
    totalIndicators === 0
      ? 0
      : (
          evidenceSummary.observed * 1 +
          evidenceSummary.estimated * 0.75 +
          evidenceSummary.derived * 0.5 +
          evidenceSummary.fallback * 0.2
        ) / totalIndicators;

  const coverageScore = bounded(country.sourceCoverage);
  const completenessScore = bounded(completeness * 100);
  const recencyScore = bounded((1 - staleRatio) * 100);
  const evidenceScore = bounded(evidenceRatio * 100);
  const confidenceScore = bounded(averageIndicatorConfidence * 100);
  const informationScore = Math.round(
    coverageScore * weights.coverage +
      completenessScore * weights.completeness +
      recencyScore * weights.recency +
      evidenceScore * weights.evidence +
      confidenceScore * weights.confidence,
  );
  const stale = staleIndicatorCount > 0 || (daysOld(country.lastUpdated) ?? 0) > INFORMATION_QUALITY_CONTRACT.staleThresholdDays;
  const gaps = [
    !country.demographics && 'demographics',
    !country.energy && 'energy',
    !country.topTradePartners?.length && 'tradePartners',
    !country.cyber && 'cyber',
    !country.fiscal && 'fiscal',
    !country.foodWater && 'foodWater',
    !country.diplomatic && 'diplomatic',
    !country.softPower && 'softPower',
  ].filter((gap): gap is string => Boolean(gap));

  return {
    countryId: country.id,
    displayName: country.displayName,
    informationScore: bounded(informationScore),
    yearsStale,
    staleIndicatorCount,
    fallbackIndicatorCount,
    lowConfidenceIndicatorCount,
    sourceCoverage: country.sourceCoverage,
    completeness: Number(completeness.toFixed(2)),
    stale,
    gaps,
    remediationDrivers: deriveQualityRemediationDrivers(country),
    averageIndicatorConfidence: Number(averageIndicatorConfidence.toFixed(3)),
    evidenceSummary,
  };
};

const toKpiStatus = (
  telemetry: Omit<InformationQualityTelemetry, 'kpiStatus'>,
  staticReferenceAverageScore?: number,
): InformationQualityKpiStatus => {
  const targets = telemetry.kpiTargets;
  const staticRuntimeScoreDelta =
    staticReferenceAverageScore == null ? null : Math.round(Math.abs(telemetry.averageInformationScore - staticReferenceAverageScore) * 10) / 10;
  return {
    averageInformationScoreWithinTarget: telemetry.averageInformationScore >= targets.minimumAverageInformationScore,
    lowQualityCountWithinTarget: telemetry.lowQualityCount <= targets.maximumLowQualityCountries,
    staleCountryCountWithinTarget: telemetry.staleCountryCount <= targets.maximumStaleCountries,
    staticRuntimeScoreDeltaWithinTarget:
      staticRuntimeScoreDelta == null || staticRuntimeScoreDelta <= targets.maximumStaticRuntimeScoreDelta,
    staticRuntimeScoreDelta,
  };
};

export const buildInformationQualityTelemetry = (
  countries: CountryProfile[],
  options?: {
    layer?: InformationQualityTelemetry['layer'];
    assessedAt?: string;
    staticReferenceAverageScore?: number;
  },
): InformationQualityTelemetry => {
  const layer = options?.layer ?? 'runtime-live';
  const scored = countries
    .map((country) => toCountryInformationScore(country))
    .sort((left, right) => right.informationScore - left.informationScore || left.displayName.localeCompare(right.displayName));

  const baseTelemetry: Omit<InformationQualityTelemetry, 'kpiStatus'> = {
    layer,
    assessedAt: options?.assessedAt ?? nowIso(),
    scoringVersion: INFORMATION_QUALITY_CONTRACT.scoringVersion,
    scoreWeights: INFORMATION_QUALITY_CONTRACT.scoreWeights,
    kpiTargets: INFORMATION_QUALITY_CONTRACT.kpiTargets,
    averageInformationScore: Number(average(scored.map((country) => country.informationScore)).toFixed(1)),
    staleCountryCount: scored.filter((country) => country.stale).length,
    highQualityCount: scored.filter((country) => country.informationScore >= 80).length,
    lowQualityCount: scored.filter((country) => country.informationScore < 55).length,
    topInformationCountries: scored.slice(0, 15),
    weakestInformationCountries: scored.slice(-15).reverse(),
  };

  return {
    ...baseTelemetry,
    kpiStatus: toKpiStatus(baseTelemetry, options?.staticReferenceAverageScore),
  };
};
