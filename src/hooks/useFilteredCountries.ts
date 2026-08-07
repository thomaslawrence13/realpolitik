import { useMemo } from 'react';
import type { SimulatedCountry, Filters } from '../types';
import { filterCountries, searchCountries, buildVisibleNames } from '../state/selectors';

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
  const filtered = useMemo(() => filterCountries(simulated, filters), [filters, simulated]);
  const visibleNames = useMemo(() => buildVisibleNames(filtered), [filtered]);
  const railCountries = useMemo(() => searchCountries(filtered, search), [filtered, search]);

  return {
    filtered,
    visibleNames,
    railCountries,
  };
}
