import type { CountryDataQuality, CountryIndicators, CountryProfile, IndicatorTelemetry } from '../../types';
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

const sortCandidates = <K extends IndicatorKey>(indicator: K, candidates: IndicatorObservation<K>[]) => {
  return candidates
    .slice()
    .sort((left, right) => {
      const rankDiff = sourceRankFor(indicator, left.sourceId) - sourceRankFor(indicator, right.sourceId);
      if (rankDiff !== 0) return rankDiff;

      const confidenceDiff = normalizeConfidence(right.confidence) - normalizeConfidence(left.confidence);
      if (confidenceDiff !== 0) return confidenceDiff;

      const dateDiff = compareDateDesc(left.observedAt, right.observedAt);
      if (dateDiff !== 0) return dateDiff;

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

  let latestTimestamp = toDate(profile.lastUpdated)?.getTime() ?? Date.now();
  let coverageTotal = 0;
  let coveragePresent = 0;

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
        degradedReasons.push(`Missing external data for ${indicator}; using static fallback.`);
      }
      continue;
    }

    setIndicatorValue(nextIndicators, indicator, selected.value);

    const confidence = normalizeConfidence(selected.confidence);
    const ageDays = daysOld(selected.observedAt);
    const stale = ageDays != null && ageDays > rule.staleAfterDays;

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
      confidence,
      stale,
      method: selected.method,
    });

    if (rule.includeInCoverage) coveragePresent += 1;

    const ts = toDate(selected.observedAt)?.getTime();
    if (ts != null && ts > latestTimestamp) latestTimestamp = ts;
  }

  const computedSourceCoverage = coverageTotal === 0 ? 0 : Math.round((coveragePresent / coverageTotal) * 100);
  const computedLastUpdated = new Date(latestTimestamp).toISOString().slice(0, 10);

  const dataQuality: CountryDataQuality = {
    computedSourceCoverage,
    computedLastUpdated,
    degradedReasons: dedupeReasons(degradedReasons),
    indicators: telemetry.sort((left, right) => left.indicator.localeCompare(right.indicator)),
  };

  return {
    indicators: nextIndicators,
    sourceCoverage: computedSourceCoverage,
    lastUpdated: computedLastUpdated,
    dataQuality,
  };
};
