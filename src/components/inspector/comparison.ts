import type { CountryAssessment } from '../../types';

export type ComparisonTone = 'positive' | 'negative' | 'neutral';

export interface ComparisonMetric {
  id: 'risk' | 'confidence' | 'gdpPerCapita' | 'gdpGrowth' | 'inflation' | 'militaryBurden' | 'cohesion';
  label: string;
  selectedLabel: string;
  peerLabel: string;
  deltaLabel: string;
  tone: ComparisonTone;
}

type MetricDefinition = {
  id: ComparisonMetric['id'];
  label: string;
  read: (country: CountryAssessment) => number | undefined;
  format: (value: number) => string;
  formatDelta: (delta: number) => string;
  direction: 'higher-positive' | 'higher-negative' | 'context';
};

const signed = (value: number, digits: number) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
const directionalDelta = (delta: number, formatted: string) => {
  if (Math.abs(delta) < 0.005) return 'No difference';
  return `${formatted} ${delta > 0 ? 'higher' : 'lower'}`;
};

const definitions: MetricDefinition[] = [
  {
    id: 'risk', label: 'Stress risk', read: (country) => country.risk,
    format: (value) => `${Math.round(value)}%`,
    formatDelta: (delta) => directionalDelta(delta, `${Math.abs(delta).toFixed(0)}pp`),
    direction: 'higher-negative',
  },
  {
    id: 'confidence', label: 'Data confidence', read: (country) => country.confidence,
    format: (value) => `${Math.round(value)}%`,
    formatDelta: (delta) => directionalDelta(delta, `${Math.abs(delta).toFixed(0)}pp`),
    direction: 'higher-positive',
  },
  {
    id: 'gdpPerCapita', label: 'GDP per capita', read: (country) => country.profile.economicStats?.gdpPerCapitaUsd,
    format: (value) => `$${Math.round(value).toLocaleString()}`,
    formatDelta: (delta) => directionalDelta(delta, `$${Math.round(Math.abs(delta)).toLocaleString()}`),
    direction: 'context',
  },
  {
    id: 'gdpGrowth', label: 'GDP growth', read: (country) => country.profile.economicStats?.gdpGrowthPct,
    format: (value) => `${signed(value, 1)}%`,
    formatDelta: (delta) => directionalDelta(delta, `${Math.abs(delta).toFixed(1)}pp`),
    direction: 'higher-positive',
  },
  {
    id: 'inflation', label: 'Inflation', read: (country) => country.profile.economicStats?.inflationPct,
    format: (value) => `${value.toFixed(1)}%`,
    formatDelta: (delta) => directionalDelta(delta, `${Math.abs(delta).toFixed(1)}pp`),
    direction: 'higher-negative',
  },
  {
    id: 'militaryBurden', label: 'Defence burden', read: (country) => country.profile.militaryStats?.militaryExpGdpPct,
    format: (value) => `${value.toFixed(2)}% GDP`,
    formatDelta: (delta) => directionalDelta(delta, `${Math.abs(delta).toFixed(2)}pp`),
    direction: 'context',
  },
  {
    id: 'cohesion', label: 'Cohesion', read: (country) => country.profile.indicators.cohesion,
    format: (value) => `${Math.round(value)}/100`,
    formatDelta: (delta) => directionalDelta(delta, `${Math.abs(delta).toFixed(0)} points`),
    direction: 'higher-positive',
  },
];

const toneForDelta = (delta: number, direction: MetricDefinition['direction']): ComparisonTone => {
  if (direction === 'context' || Math.abs(delta) < 0.005) return 'neutral';
  if (direction === 'higher-positive') return delta > 0 ? 'positive' : 'negative';
  return delta < 0 ? 'positive' : 'negative';
};

export const buildComparisonMetrics = (
  selected: CountryAssessment,
  peer: CountryAssessment,
): ComparisonMetric[] => definitions.flatMap((definition): ComparisonMetric[] => {
  const selectedValue = definition.read(selected);
  const peerValue = definition.read(peer);
  if (selectedValue === undefined || peerValue === undefined || !Number.isFinite(selectedValue) || !Number.isFinite(peerValue)) return [];
  const delta = selectedValue - peerValue;
  return [{
    id: definition.id,
    label: definition.label,
    selectedLabel: definition.format(selectedValue),
    peerLabel: definition.format(peerValue),
    deltaLabel: definition.formatDelta(delta),
    tone: toneForDelta(delta, definition.direction),
  }];
});

const comparisonDistance = (selected: CountryAssessment, candidate: CountryAssessment): number => {
  const selectedGdp = selected.profile.economicStats?.gdpPerCapitaUsd;
  const candidateGdp = candidate.profile.economicStats?.gdpPerCapitaUsd;
  const geographyPenalty = candidate.profile.region !== selected.profile.region
    ? 20_000
    : candidate.profile.subregion !== selected.profile.subregion
      ? 2_000
      : 0;
  const economyPenalty = selectedGdp && candidateGdp
    ? Math.abs(Math.log(selectedGdp / candidateGdp)) * 500
    : 1_000;
  const riskPenalty = Math.abs(selected.risk - candidate.risk) * 8;
  const regimePenalty = selected.profile.regimeType === candidate.profile.regimeType ? 0 : 150;
  return geographyPenalty + economyPenalty + riskPenalty + regimePenalty;
};

/** Pick a structurally similar peer, prioritizing subregion, economy, risk, and regime. */
export const chooseComparisonPeer = (
  selected: CountryAssessment,
  allCountries: CountryAssessment[],
): CountryAssessment | null => allCountries
  .filter((candidate) => candidate.profile.id !== selected.profile.id)
  .sort((left, right) => comparisonDistance(selected, left) - comparisonDistance(selected, right)
    || left.profile.displayName.localeCompare(right.profile.displayName))[0] ?? null;
