import { getRiskTier } from '../simulation';
import type { Alignment, Filters, SimulatedCountry } from '../types';

const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${value}%`;

export const buildByNameIndex = (rows: SimulatedCountry[]) =>
  new Map(rows.map((entry) => [entry.profile.mapName, entry]));

export const filterCountries = (rows: SimulatedCountry[], filters: Filters): SimulatedCountry[] =>
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

export const searchCountries = (rows: SimulatedCountry[], search: string): SimulatedCountry[] => {
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

export const buildVisibleNames = (rows: SimulatedCountry[]) => new Set(rows.map((entry) => entry.profile.mapName));

export const selectCountryOrFallback = (
  byName: Map<string, SimulatedCountry>,
  rows: SimulatedCountry[],
  mapName: string,
): SimulatedCountry | null => byName.get(mapName) ?? rows[0] ?? null;

export const buildEventFeed = ({
  filtered,
  baselineByName,
  scenarioTimeline,
  timelineIndex,
  alignmentLabel,
}: {
  filtered: SimulatedCountry[];
  baselineByName: Map<string, SimulatedCountry>;
  scenarioTimeline: string[];
  timelineIndex: number;
  alignmentLabel: Record<Alignment, string>;
}): Array<{ title: string; detail: string; tone: 'low' | 'medium' | 'high' }> =>
  filtered
    .slice()
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 5)
    .map((entry) => {
      const topPressure = entry.profile.relationships.reduce<
        typeof entry.profile.relationships[number] | null
      >(
        (best, rel) => (!best || rel.tension > best.tension ? rel : best),
        null,
      );
      const baselineEntry = baselineByName.get(entry.profile.mapName);
      const riskDelta = baselineEntry ? Math.round(entry.risk - baselineEntry.risk) : 0;
      const tone = getRiskTier(entry.risk);
      return {
        title: `${scenarioTimeline[timelineIndex]} · ${entry.profile.displayName}`,
        detail: `${alignmentLabel[entry.alignment]} at ${entry.confidence}% confidence and ${entry.risk}% modeled escalation risk (${formatSignedPercent(
          riskDelta,
        )} vs baseline)${topPressure ? `. Top pressure: ${topPressure.displayName}.` : '.'}`,
        tone,
      };
    });
