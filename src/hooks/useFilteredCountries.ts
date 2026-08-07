import { useMemo } from 'react';
import type { SimulatedCountry, Filters } from '../types';

interface UseFilteredCountriesReturn {
  filtered: SimulatedCountry[];
  visibleNames: Set<string>;
  railCountries: SimulatedCountry[];
}

export function useFilteredCountries(
  simulated: SimulatedCountry[],
  filters: Filters,
  search: string,
): UseFilteredCountriesReturn {
  const filtered = useMemo(() => {
    return simulated.filter((entry) => {
      const riskTier = entry.profile.indicators.riskLevel as Filters['riskLevel'];
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
  }, [filters, simulated]);

  const visibleNames = useMemo(
    () => new Set(filtered.map((entry) => entry.profile.mapName)),
    [filtered]
  );

  const railCountries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return filtered;
    return filtered.filter((entry) => {
      const profile = entry.profile;
      return (
        profile.displayName.toLowerCase().includes(query) ||
        profile.region.toLowerCase().includes(query) ||
        profile.subregion.toLowerCase().includes(query) ||
        profile.mapName.toLowerCase().includes(query)
      );
    });
  }, [filtered, search]);

  return {
    filtered,
    visibleNames,
    railCountries,
  };
}
