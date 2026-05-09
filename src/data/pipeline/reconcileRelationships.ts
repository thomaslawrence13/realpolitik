import type {
  CountryRelationship,
  RelationshipDataQuality,
  RelationshipDimensionKey,
  RelationshipDimensionTelemetry,
} from '../../types';
import {
  relationshipDimensionQualityRules,
  relationshipDimensionSourcePriority,
  relationshipDimensions,
} from './rules';
import type { RelationshipObservation } from './types';

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

const compareDate = (left: string, right: string) => {
  const leftTs = toDate(left)?.getTime() ?? -Infinity;
  const rightTs = toDate(right)?.getTime() ?? -Infinity;
  return rightTs - leftTs;
};

const sourceRankFor = (dimension: RelationshipDimensionKey, sourceId: string): number => {
  const ranking = relationshipDimensionSourcePriority[dimension];
  const index = ranking.indexOf(sourceId);
  return index === -1 ? ranking.length + 1 : index;
};

const sortCandidates = (
  dimension: RelationshipDimensionKey,
  candidates: RelationshipObservation[],
): RelationshipObservation[] =>
  candidates.slice().sort((left, right) => {
    const rankDiff = sourceRankFor(dimension, left.sourceId) - sourceRankFor(dimension, right.sourceId);
    if (rankDiff !== 0) return rankDiff;

    const confidenceDiff = normalizeConfidence(right.confidence) - normalizeConfidence(left.confidence);
    if (confidenceDiff !== 0) return confidenceDiff;

    const dateDiff = compareDate(left.observedAt, right.observedAt);
    if (dateDiff !== 0) return dateDiff;

    return left.providerId.localeCompare(right.providerId);
  });

const selectObservation = (
  dimension: RelationshipDimensionKey,
  candidates: RelationshipObservation[],
): RelationshipObservation | null => {
  const valid = candidates.filter(
    (c) => Number.isFinite(c.value) && c.value >= 0 && c.value <= 100,
  );
  if (valid.length === 0) return null;
  return sortCandidates(dimension, valid)[0] ?? null;
};

const dedupeReasons = (reasons: string[]) => Array.from(new Set(reasons));

/** Edge key that is independent of direction */
export const edgeKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);

/**
 * Enriches a `CountryRelationship` using multi-source observations for each bilateral dimension.
 * The static snapshot values are used as the reliable baseline; derived signals can only override
 * them when no valid snapshot observation is available.
 */
export const enrichRelationshipWithObservations = (
  relationship: CountryRelationship,
  currentCountryId: string,
  observations: RelationshipObservation[],
): CountryRelationship => {
  const relevant = observations.filter(
    (obs) =>
      obs.sourceCountryId === currentCountryId && obs.targetCountryId === relationship.countryId,
  );

  const telemetry: RelationshipDimensionTelemetry[] = [];
  const degradedReasons: string[] = [];

  let latestTimestamp = toDate(relationship.lastUpdated)?.getTime() ?? Date.now();

  const nextDimensions: Partial<Record<RelationshipDimensionKey, number>> = {};

  for (const dimension of relationshipDimensions) {
    const rule = relationshipDimensionQualityRules[dimension];
    const candidates = relevant.filter((obs) => obs.dimension === dimension);
    const selected = selectObservation(dimension, candidates);

    if (!selected) {
      if (rule.includeInCoverage) {
        degradedReasons.push(`Missing external data for ${dimension}. Using static fallback.`);
      }
      continue;
    }

    nextDimensions[dimension] = selected.value;

    const confidence = normalizeConfidence(selected.confidence);
    const ageDays = daysOld(selected.observedAt);
    const stale = ageDays != null && ageDays > rule.staleAfterDays;

    if (stale) {
      degradedReasons.push(
        `${dimension} from ${selected.sourceId} is stale (${ageDays}d old, SLA ${rule.staleAfterDays}d).`,
      );
    }
    if (confidence < rule.minimumConfidence) {
      degradedReasons.push(
        `${dimension} from ${selected.sourceId} below confidence floor (${Math.round(confidence * 100)}% < ${Math.round(rule.minimumConfidence * 100)}%).`,
      );
    }

    telemetry.push({
      dimension,
      sourceId: selected.sourceId,
      observedAt: selected.observedAt,
      confidence,
      stale,
      method: selected.method,
    });

    const ts = toDate(selected.observedAt)?.getTime();
    if (ts != null && ts > latestTimestamp) latestTimestamp = ts;
  }

  const computedLastUpdated = new Date(latestTimestamp).toISOString().slice(0, 10);

  const dataQuality: RelationshipDataQuality = {
    computedLastUpdated,
    degradedReasons: dedupeReasons(degradedReasons),
    dimensions: telemetry.sort((left, right) => left.dimension.localeCompare(right.dimension)),
  };

  const cooperation = nextDimensions.cooperation ?? relationship.cooperation;
  const hostility = nextDimensions.hostility ?? relationship.hostility;
  const dependency = nextDimensions.dependency ?? relationship.dependency;
  const deterrence = nextDimensions.deterrence ?? relationship.deterrence;

  return {
    ...relationship,
    cooperation,
    hostility,
    dependency,
    deterrence,
    tension: Math.round((hostility + deterrence) / 2),
    dataQuality,
  };
};
