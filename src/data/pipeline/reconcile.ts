import type { CountryDataQuality, CountryIndicators, CountryProfile, IndicatorTelemetry, CoverageMetrics } from '../../types';
import { sourceAuthorityRank } from '../sourceRegistry';
import { indicatorQualityRules, indicatorSourcePriority, modelIndicatorKeys } from './rules';
import { isValidIndicatorValue } from './transformers';
import type { IndicatorKey, IndicatorObservation } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysOld = (value: string): number | null => {
  const date = toDate(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
};

const normalizeConfidence = (confidence: number) => Math.max(0, Math.min(1, confidence));

const compareDateDesc = (left: string, right: string) => {
  const leftTs = toDate(left)?.getTime() ?? -Infinity;
  const rightTs = toDate(right)?.getTime() ?? -Infinity;
  return rightTs - leftTs;
};

const sourceRankFor = (indicator: IndicatorKey, sourceId: string): number => {
  const ranking = indicatorSourcePriority[indicator];
  const index = ranking.indexOf(sourceId);
  return index === -1 ? ranking.length + 1 : index;
};

const recencyKeyOf = (observation: { vintage?: string; observedAt: string }): string =>
  /^\d{4}$/.test(observation.vintage ?? '')
    ? `${observation.vintage}-12-31`
    : observation.vintage ?? observation.observedAt;

const sortCandidates = <K extends IndicatorKey>(indicator: K, candidates: IndicatorObservation<K>[]) => {
  return candidates
    .slice()
    .sort((left, right) => {
      const rankDiff = sourceRankFor(indicator, left.sourceId) - sourceRankFor(indicator, right.sourceId);
      if (rankDiff !== 0) return rankDiff;

      const confidenceDiff = normalizeConfidence(right.confidence) - normalizeConfidence(left.confidence);
      if (confidenceDiff !== 0) return confidenceDiff;

      const vintageDiff = compareDateDesc(recencyKeyOf(left), recencyKeyOf(right));
      if (vintageDiff !== 0) return vintageDiff;

      const dateDiff = compareDateDesc(left.observedAt, right.observedAt);
      if (dateDiff !== 0) return dateDiff;

      if (Boolean(left.projection) !== Boolean(right.projection)) {
        return left.projection ? 1 : -1;
      }

      const authorityDiff = sourceAuthorityRank(left.sourceId) - sourceAuthorityRank(right.sourceId);
      if (authorityDiff !== 0) return authorityDiff;

      return left.providerId.localeCompare(right.providerId);
    });
};

const selectObservation = <K extends IndicatorKey>(
  indicator: K,
  candidates: IndicatorObservation<K>[],
): IndicatorObservation<K> | null => {
  const validCandidates = candidates.filter((candidate) => isValidIndicatorValue(indicator, candidate.value));
  if (validCandidates.length === 0) return null;
  return sortCandidates(indicator, validCandidates)[0] ?? null;
};

const dedupeReasons = (reasons: string[]) => Array.from(new Set(reasons));

const classifyEvidence = (
  method: IndicatorTelemetry['method'],
  stale: boolean,
  confidence: number,
  minimumConfidence: number,
): IndicatorTelemetry['evidenceClass'] => {
  if (method === 'derived') return 'derived';
  if (stale || confidence < minimumConfidence) return 'fallback';
  if (method === 'expert-curated') return 'estimated';
  return 'observed';
};

const setIndicatorValue = <K extends IndicatorKey>(
  indicators: CountryIndicators,
  indicator: K,
  value: CountryIndicators[K],
) => {
  (indicators as Record<IndicatorKey, CountryIndicators[IndicatorKey]>)[indicator] = value;
};

export const enrichCountryWithObservations = (
  profile: CountryProfile,
  observations: IndicatorObservation[],
): Pick<CountryProfile, 'indicators' | 'sourceCoverage' | 'lastUpdated' | 'dataQuality'> => {
  const nextIndicators: CountryIndicators = { ...profile.indicators };
  const telemetry: IndicatorTelemetry[] = [];
  const degradedReasons: string[] = [];

  let latestTimestamp = -Infinity;
  let coverageTotal = 0;
  let coveragePresent = 0;
  let observedCoverage = 0;
  let freshCoverage = 0;
  let fallbackCoverage = 0;
  let staleCoverage = 0;
  let lowConfidenceCoverage = 0;

  for (const indicator of modelIndicatorKeys) {
    const rule = indicatorQualityRules[indicator];
    if (rule.includeInCoverage) coverageTotal += 1;

    const candidates = observations.filter(
      (observation): observation is IndicatorObservation<typeof indicator> =>
        observation.indicator === indicator,
    );

    const selected = selectObservation(indicator, candidates);
    if (!selected) {
      if (rule.includeInCoverage) {
        degradedReasons.push(`Missing external data for ${indicator}. Using static fallback.`);
      }
      continue;
    }

    setIndicatorValue(nextIndicators, indicator, selected.value);

    const confidence = normalizeConfidence(selected.confidence);
    const ageDays = daysOld(selected.observedAt);
    const stale = ageDays != null && ageDays > rule.staleAfterDays;
    const evidenceClass = classifyEvidence(selected.method, stale, confidence, rule.minimumConfidence);

    if (stale) {
      degradedReasons.push(
        `${indicator} from ${selected.sourceId} is stale (${ageDays}d old, SLA ${rule.staleAfterDays}d).`,
      );
    }
    if (confidence < rule.minimumConfidence) {
      degradedReasons.push(
        `${indicator} from ${selected.sourceId} below confidence floor (${Math.round(confidence * 100)}% < ${Math.round(rule.minimumConfidence * 100)}%).`,
      );
    }

    telemetry.push({
      indicator,
      sourceId: selected.sourceId,
      observedAt: selected.observedAt,
      retrievedAt: selected.retrievedAt,
      confidence,
      stale,
      method: selected.method,
      evidenceClass,
      ...(selected.vintage ? { vintage: selected.vintage } : {}),
      ...(selected.seriesUpdatedAt ? { seriesUpdatedAt: selected.seriesUpdatedAt } : {}),
      ...(selected.projection ? { projection: true } : {}),
    });

    if (rule.includeInCoverage) {
      coveragePresent += 1;
      if (!stale) freshCoverage += 1;
      if (evidenceClass === 'observed') observedCoverage += 1;
      if (evidenceClass === 'fallback') fallbackCoverage += 1;
      if (stale) staleCoverage += 1;
      if (confidence < rule.minimumConfidence) lowConfidenceCoverage += 1;
    }

    const ts = toDate(selected.observedAt)?.getTime();
    if (ts != null && ts > latestTimestamp) latestTimestamp = ts;
  }

  const computedSourceCoverage = coverageTotal === 0 ? 0 : Math.round((coveragePresent / coverageTotal) * 100);
  const fallbackTimestamp = toDate(profile.lastUpdated)?.getTime() ?? Date.now();
  const computedLastUpdated = new Date(Number.isFinite(latestTimestamp) ? latestTimestamp : fallbackTimestamp)
    .toISOString()
    .slice(0, 10);
  const toPct = (count: number) => coverageTotal === 0 ? 0 : Math.round((count / coverageTotal) * 100);
  const coverage: CoverageMetrics = {
    valuePct: computedSourceCoverage,
    observedPct: toPct(observedCoverage),
    freshPct: toPct(freshCoverage),
    fallbackPct: toPct(fallbackCoverage),
    stalePct: toPct(staleCoverage),
    lowConfidencePct: toPct(lowConfidenceCoverage),
  };

  const dataQuality: CountryDataQuality = {
    computedSourceCoverage,
    computedLastUpdated,
    degradedReasons: dedupeReasons(degradedReasons),
    indicators: telemetry.sort((left, right) => left.indicator.localeCompare(right.indicator)),
    coverage,
  };

  return {
    indicators: nextIndicators,
    sourceCoverage: computedSourceCoverage,
    lastUpdated: computedLastUpdated,
    dataQuality,
  };
};
