import type { CountryProfile } from '../../types';
import type { LiveData } from '../worldBankClient';
import {
  buildConflictSnapshotObservations,
  buildGovernanceCrossCheckObservations,
  buildSanctionsSnapshotObservations,
  buildTradeDependenceObservations,
  buildWorldBankObservations,
} from './providers';
import { enrichCountryWithObservations } from './reconcile';

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

export const enrichProfilesWithSourcePipeline = (
  profiles: CountryProfile[],
  live: LiveData,
): CountryProfile[] => {
  const observations = [
    ...buildWorldBankObservations(profiles, live),
    ...buildConflictSnapshotObservations(profiles),
    ...buildSanctionsSnapshotObservations(profiles),
    ...buildTradeDependenceObservations(profiles),
    ...buildGovernanceCrossCheckObservations(profiles),
  ];

  const byCountry = groupByCountry(observations);

  return profiles.map((profile) => {
    const enriched = enrichCountryWithObservations(profile, byCountry.get(profile.id) ?? []);
    return {
      ...profile,
      indicators: enriched.indicators,
      sourceCoverage: enriched.sourceCoverage,
      lastUpdated: enriched.lastUpdated,
      dataQuality: enriched.dataQuality,
    };
  });
};
