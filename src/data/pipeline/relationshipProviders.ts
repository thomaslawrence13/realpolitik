import type { CountryProfile, RelationshipDimensionKey, Tier } from '../../types';
import type { RelationshipEdge } from '../../types';
import type { RelationshipObservation } from './types';
import { tierToScore } from './rules';

/** Pick the best matching source for an edge from available sources, falling back to the first listed.
 *  Returns 'unknown' only when the edge has no sourceIds at all — callers should treat this as a
 *  data-quality gap rather than a hard error.
 */
const pickEdgeSource = (edge: RelationshipEdge, candidates: string[]): string =>
  candidates.find((candidate) => edge.sourceIds.includes(candidate)) ?? (edge.sourceIds[0] ?? 'unknown');

const tierScore = (tier: Tier): number => tierToScore[tier];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const avg = (...values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;

/** Wraps existing expert-curated edge dimension values as snapshot observations. */
export const buildRelationshipSnapshotObservations = (
  edges: RelationshipEdge[],
): RelationshipObservation[] => {
  const observations: RelationshipObservation[] = [];

  const dimensionSourceMap: Record<RelationshipDimensionKey, string[]> = {
    cooperation: ['iiss-military-balance', 'imf-direction-of-trade'],
    hostility: ['ucdp', 'iiss-military-balance'],
    dependency: ['imf-direction-of-trade', 'wto-profile'],
    deterrence: ['iiss-military-balance', 'sipri-milex'],
  };

  for (const edge of edges) {
    const dimensions: Array<[RelationshipDimensionKey, number]> = [
      ['cooperation', edge.cooperation],
      ['hostility', edge.hostility],
      ['dependency', edge.dependency],
      ['deterrence', edge.deterrence],
    ];

    for (const [dimension, value] of dimensions) {
      const sourceId = pickEdgeSource(edge, dimensionSourceMap[dimension]);
      const baseObs: Omit<RelationshipObservation, 'sourceCountryId' | 'targetCountryId'> = {
        providerId: 'relationship-snapshot',
        sourceId,
        dimension,
        value,
        observedAt: edge.lastUpdated,
        method: 'snapshot',
        confidence: 0.74,
      };
      // Emit in both directions so that each profile sees the observation regardless of which side is being enriched
      observations.push({ ...baseObs, sourceCountryId: edge.sourceCountryId, targetCountryId: edge.targetCountryId });
      observations.push({ ...baseObs, sourceCountryId: edge.targetCountryId, targetCountryId: edge.sourceCountryId });
    }
  }

  return observations;
};

/**
 * Derives bilateral relationship signals from reconciled country-indicator cross-products.
 *
 * These signals are cross-checks on the expert-curated snapshots — lower confidence (0.52) so
 * they will only override snapshot values when the snapshot is missing or stale.
 */
export const buildDerivedRelationshipObservations = (
  profiles: CountryProfile[],
  edges: RelationshipEdge[],
): RelationshipObservation[] => {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const observedAt = new Date().toISOString().slice(0, 10);
  const observations: RelationshipObservation[] = [];

  for (const edge of edges) {
    const a = profileById.get(edge.sourceCountryId);
    const b = profileById.get(edge.targetCountryId);
    if (!a || !b) continue;

    const aConflict = tierScore(a.indicators.conflictPressure);
    const bConflict = tierScore(b.indicators.conflictPressure);
    const aBorder = tierScore(a.indicators.borderDisputes);
    const bBorder = tierScore(b.indicators.borderDisputes);
    const aTrade = tierScore(a.indicators.tradeDependence);
    const bTrade = tierScore(b.indicators.tradeDependence);
    const aMilitary = tierScore(a.indicators.militaryTreatyLevel);
    const bMilitary = tierScore(b.indicators.militaryTreatyLevel);
    const aStability = tierScore(a.indicators.regimeStability);
    const bStability = tierScore(b.indicators.regimeStability);

    // Hostility: driven by conflict pressure on both sides and border dispute intensity
    const BORDER_WEIGHT = 0.3;
    const CONFLICT_WEIGHT = 1 - BORDER_WEIGHT;
    const derivedHostility = clamp(
      Math.round(avg(aConflict, bConflict) * CONFLICT_WEIGHT + avg(aBorder, bBorder) * BORDER_WEIGHT),
      0,
      100,
    );

    // Cooperation: inversely correlated with hostility; shared democratic stability adds a fixed
    // bonus of 8 points based on empirical cross-national research showing democracies exhibit
    // substantially higher bilateral cooperation levels than mixed or non-democratic dyads.
    const stabilityBonus = a.regimeType === 'democracy' && b.regimeType === 'democracy' ? 8 : 0;
    const derivedCooperation = clamp(Math.round(100 - derivedHostility * 0.7 + stabilityBonus), 0, 100);

    // Dependency: mean trade dependence of both sides
    const derivedDependency = clamp(Math.round(avg(aTrade, bTrade)), 0, 100);

    // Deterrence: mean military treaty level of both sides plus stability weight
    const derivedDeterrence = clamp(Math.round(avg(aMilitary, bMilitary) * 0.8 + avg(aStability, bStability) * 0.2), 0, 100);

    const derived: Array<[RelationshipDimensionKey, number]> = [
      ['hostility', derivedHostility],
      ['cooperation', derivedCooperation],
      ['dependency', derivedDependency],
      ['deterrence', derivedDeterrence],
    ];

    for (const [dimension, value] of derived) {
      const baseObs: Omit<RelationshipObservation, 'sourceCountryId' | 'targetCountryId'> = {
        providerId: 'country-indicator-derived',
        sourceId: 'vdem', // governance/conflict indicators sourced via v-dem/ucdp reconciled values
        dimension,
        value,
        observedAt,
        method: 'derived',
        confidence: 0.52,
      };
      observations.push({ ...baseObs, sourceCountryId: edge.sourceCountryId, targetCountryId: edge.targetCountryId });
      observations.push({ ...baseObs, sourceCountryId: edge.targetCountryId, targetCountryId: edge.sourceCountryId });
    }
  }

  return observations;
};
