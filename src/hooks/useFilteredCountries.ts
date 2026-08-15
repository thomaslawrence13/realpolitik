import { useMemo } from 'react';
import type { CountryAssessment, Filters } from '../types';
import { filterCountries, searchCountries, buildVisibleNames } from '../state/selectors';

interface UseFilteredCountriesReturn {
  filtered: CountryAssessment[];
  visibleNames: Set<string>;
  railCountries: CountryAssessment[];
}

export function useFilteredCountries(
  simulated: CountryAssessment[],
  filters: Filters,
  search: string,
): UseFilteredCountriesReturn {
  const filtered = useMemo(() => filterCountries(simulated, filters), [filters, simulated]);
  const visibleNames = useMemo(() => buildVisibleNames(filtered), [filtered]);
  const railCountries = useMemo(() => searchCountries(filtered, search), [filtered, search]);

  return {
    filtered,
    visibleNames,
    railCountries,
  };
}
