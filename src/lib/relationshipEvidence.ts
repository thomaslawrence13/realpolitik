import type { CountryRelationship, RelationshipDimensionKey } from '../types';

export const relationshipDimensionLabels: Record<RelationshipDimensionKey, string> = {
  cooperation: 'Cooperation',
  hostility: 'Hostility',
  dependency: 'Dependency',
  deterrence: 'Deterrence',
};

export type RelationshipEvidencePoint = {
  dimension: RelationshipDimensionKey;
  value: number;
  observedAt: string;
  sourceId: string;
  stale: boolean;
  method: string;
};

/** Latest selected evidence per relationship dimension, ordered newest first. */
export const relationshipEvidenceTimeline = (
  relationship: CountryRelationship,
): RelationshipEvidencePoint[] => {
  const telemetry = relationship.dataQuality?.dimensions ?? [];
  const values: Record<RelationshipDimensionKey, number> = {
    cooperation: relationship.cooperation,
    hostility: relationship.hostility,
    dependency: relationship.dependency,
    deterrence: relationship.deterrence,
  };
  return telemetry
    .filter((entry) => Number.isFinite(values[entry.dimension]))
    .map((entry) => ({
      dimension: entry.dimension,
      value: values[entry.dimension],
      observedAt: entry.observedAt,
      sourceId: entry.sourceId,
      stale: entry.stale,
      method: entry.method,
    }))
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt));
};
