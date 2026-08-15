import { getRiskTier } from '../assessment';
import type { Filters, CountryAssessment } from '../types';

export const filterCountries = (
  rows: CountryAssessment[],
  filters: Filters,
): CountryAssessment[] =>
  rows.filter((entry) => {
    const riskTier = getRiskTier(entry.risk);
    return (
      (filters.allianceNetwork === 'all' || entry.profile.allianceNetwork === filters.allianceNetwork) &&
      (filters.tradeExposure === 'all' || entry.profile.indicators.tradeExposure === filters.tradeExposure) &&
      (filters.militaryTreatyLevel === 'all' ||
        entry.profile.indicators.militaryTreatyLevel === filters.militaryTreatyLevel) &&
      (filters.conflictPressure === 'all' || entry.profile.indicators.conflictPressure === filters.conflictPressure) &&
      (filters.sanctionsExposure === 'all' || entry.profile.indicators.sanctionsExposure === filters.sanctionsExposure) &&
      (filters.regimeType === 'all' || entry.profile.regimeType === filters.regimeType) &&
      (filters.riskLevel === 'all' || riskTier === filters.riskLevel)
    );
  });

export const searchCountries = (
  rows: CountryAssessment[],
  search: string,
): CountryAssessment[] => {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((entry) => {
    const profile = entry.profile;
    return (
      profile.displayName.toLowerCase().includes(query) ||
      profile.region.toLowerCase().includes(query) ||
      profile.subregion.toLowerCase().includes(query) ||
      profile.mapName.toLowerCase().includes(query)
    );
  });
};

export const buildVisibleNames = (rows: CountryAssessment[]) => new Set(rows.map((entry) => entry.profile.mapName));
