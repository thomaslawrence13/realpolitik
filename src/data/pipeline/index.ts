import type { CountryProfile } from '../../types';
import type { LiveData } from '../worldBankClient';
import { geopoliticalDatasetV1 } from '../datasets/v1';
import {
  buildConflictSnapshotObservations,
  buildCuratedStatsFallbackObservations,
  buildDemographicCohesionObservations,
  buildEnergySanctionsCrossCheckObservations,
  buildGovernanceCrossCheckObservations,
  buildSanctionsSnapshotObservations,
  buildTradeDependenceObservations,
  buildWorldBankObservations,
} from './providers';
import {
  buildDerivedRelationshipObservations,
  buildRelationshipSnapshotObservations,
  buildTradePartnerDependencyObservations,
} from './relationshipProviders';
import { enrichCountryWithObservations } from './reconcile';
import { enrichRelationshipWithObservations } from './reconcileRelationships';
import { buildIngestedObservations } from './externalProviders';
import type { IngestedSnapshot, RawWorldBankAuditPayload } from './externalProviders';
import ingestedSnapshot from '../datasets/ingested_snapshot.json';
import rawWorldBankLatest from '../datasets/raw/world_bank_latest.json';
import type { RelationshipObservation } from './types';
import { applyStatsCoverageEnrichment } from './statsEnrichment';

const groupByCountry = <T extends { countryId: string }>(rows: T[]) => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const existing = map.get(row.countryId);
    if (existing) {
      existing.push(row);
    } else {
      map.set(row.countryId, [row]);
    }
  }
  return map;
};

/** Build a flat lookup of all relationship observations keyed by sourceCountryId. */
const indexRelationshipObservations = (
  observations: RelationshipObservation[],
): Map<string, RelationshipObservation[]> => {
  const map = new Map<string, RelationshipObservation[]>();
  for (const obs of observations) {
    const existing = map.get(obs.sourceCountryId);
    if (existing) {
      existing.push(obs);
    } else {
      map.set(obs.sourceCountryId, [obs]);
    }
  }
  return map;
};

/** Empty live payload used for offline / bootstrap enrichment (ingest-only). */
export const emptyLiveData = (): LiveData => ({
  militaryExpPct: {},
  tradePct: {},
  gdpGrowth: {},
  inflation: {},
  politicalStability: {},
  ruleOfLaw: {},
  unemployment: {},
  diagnostics: {
    totalIndicators: 0,
    succeededIndicators: 0,
    failedIndicators: 0,
    failedCodes: [],
  },
});

export const enrichProfilesWithSourcePipeline = (
  profiles: CountryProfile[],
  live: LiveData,
  options?: {
    ingest?: IngestedSnapshot;
    rawAudit?: RawWorldBankAuditPayload;
  },
): CountryProfile[] => {
  const ingest = options?.ingest ?? (ingestedSnapshot as IngestedSnapshot);
  const rawAudit = options?.rawAudit ?? (rawWorldBankLatest as RawWorldBankAuditPayload);

  // --- Country-level indicator enrichment ---
  // Order: live API → ingest snapshot → curated reaffirmations → stats fallbacks.
  // Reconcile ranks by source priority + confidence, so fallbacks only fill gaps.
  const indicatorObservations = [
    ...buildWorldBankObservations(profiles, live),
    ...buildIngestedObservations(profiles, ingest, rawAudit),
    ...buildConflictSnapshotObservations(profiles),
    ...buildSanctionsSnapshotObservations(profiles),
    ...buildTradeDependenceObservations(profiles),
    ...buildGovernanceCrossCheckObservations(profiles),
    ...buildEnergySanctionsCrossCheckObservations(profiles),
    ...buildDemographicCohesionObservations(profiles),
    ...buildCuratedStatsFallbackObservations(profiles),
  ];

  const byCountry = groupByCountry(indicatorObservations);

  const enrichedProfiles = profiles.map((profile) => {
    const enriched = enrichCountryWithObservations(profile, byCountry.get(profile.id) ?? []);
    const stats = applyStatsCoverageEnrichment(profile, live, ingest);
    return {
      ...profile,
      indicators: enriched.indicators,
      sourceCoverage: enriched.sourceCoverage,
      lastUpdated: enriched.lastUpdated,
      dataQuality: enriched.dataQuality,
      economicStats: stats.economicStats ?? profile.economicStats,
      militaryStats: stats.militaryStats ?? profile.militaryStats,
    };
  });

  // --- Relationship-edge enrichment ---
  // Snapshot observations from static dataset edges + derived signals from enriched country profiles
  const rawEdges = geopoliticalDatasetV1.relationships;
  const relationshipObservations = [
    ...buildRelationshipSnapshotObservations(rawEdges),
    ...buildDerivedRelationshipObservations(enrichedProfiles, rawEdges),
    ...buildTradePartnerDependencyObservations(enrichedProfiles, rawEdges),
  ];

  const relObsBySourceCountry = indexRelationshipObservations(relationshipObservations);

  return enrichedProfiles.map((profile) => {
    const relObs = relObsBySourceCountry.get(profile.id) ?? [];
    const enrichedRelationships = profile.relationships.map((rel) =>
      enrichRelationshipWithObservations(rel, profile.id, relObs),
    );
    return { ...profile, relationships: enrichedRelationships };
  });
};
