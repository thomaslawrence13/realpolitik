import type { CountryAssessment } from '../../types';

export type BenchmarkTone = 'positive' | 'negative' | 'neutral';

export interface CountryBenchmark {
  id: 'risk' | 'confidence' | 'gdpPerCapita' | 'gdpGrowth' | 'militaryBurden';
  label: string;
  value: number;
  valueLabel: string;
  regionalMedian: number;
  regionalMedianLabel: string;
  percentile: number;
  comparison: string;
  tone: BenchmarkTone;
}

export interface CountryBenchmarkSummary {
  countryCount: number;
  regionalPeerCount: number;
  riskRank: number;
  metrics: CountryBenchmark[];
}

type MetricDefinition = {
  id: CountryBenchmark['id'];
  label: string;
  read: (country: CountryAssessment) => number | undefined;
  format: (value: number) => string;
  direction: 'higher-positive' | 'higher-negative' | 'context';
};

const metricDefinitions: MetricDefinition[] = [
  {
    id: 'risk',
    label: 'Stress risk',
    read: (country) => country.risk,
    format: (value) => `${Math.round(value)}%`,
    direction: 'higher-negative',
  },
  {
    id: 'gdpPerCapita',
    label: 'GDP per capita',
    read: (country) => country.profile.economicStats?.gdpPerCapitaUsd,
    format: (value) => `$${Math.round(value).toLocaleString()}`,
    direction: 'context',
  },
  {
    id: 'gdpGrowth',
    label: 'GDP growth',
    read: (country) => country.profile.economicStats?.gdpGrowthPct,
    format: (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`,
    direction: 'higher-positive',
  },
  {
    id: 'militaryBurden',
    label: 'Defence burden',
    read: (country) => country.profile.militaryStats?.militaryExpGdpPct,
    format: (value) => `${value.toFixed(2)}%`,
    direction: 'context',
  },
  {
    id: 'confidence',
    label: 'Data confidence',
    read: (country) => country.confidence,
    format: (value) => `${Math.round(value)}%`,
    direction: 'higher-positive',
  },
];

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1]! + sorted[midpoint]!) / 2
    : sorted[midpoint]!;
};

const percentile = (value: number, values: number[]): number => {
  const atOrBelow = values.filter((candidate) => candidate <= value).length;
  return Math.round((atOrBelow / values.length) * 100);
};

const comparisonLabel = (value: number, regionalMedian: number): string => {
  if (Math.abs(value - regionalMedian) < 0.005) return 'At regional median';
  return `${value > regionalMedian ? 'Above' : 'Below'} regional median`;
};

const comparisonTone = (
  value: number,
  regionalMedian: number,
  direction: MetricDefinition['direction'],
): BenchmarkTone => {
  if (direction === 'context' || Math.abs(value - regionalMedian) < 0.005) return 'neutral';
  const above = value > regionalMedian;
  if (direction === 'higher-positive') return above ? 'positive' : 'negative';
  return above ? 'negative' : 'positive';
};

export const buildCountryBenchmarks = (
  selected: CountryAssessment,
  allCountries: CountryAssessment[],
): CountryBenchmarkSummary => {
  const countries = allCountries.some((country) => country.profile.id === selected.profile.id)
    ? allCountries
    : [...allCountries, selected];
  const regionalPeers = countries.filter((country) => country.profile.region === selected.profile.region);

  const metrics = metricDefinitions.flatMap((definition): CountryBenchmark[] => {
    const value = definition.read(selected);
    const globalValues = countries.map(definition.read).filter((candidate): candidate is number => Number.isFinite(candidate));
    const regionalValues = regionalPeers.map(definition.read).filter((candidate): candidate is number => Number.isFinite(candidate));
    if (value === undefined || !Number.isFinite(value) || globalValues.length === 0 || regionalValues.length === 0) return [];

    const regionalMedian = median(regionalValues);
    return [{
      id: definition.id,
      label: definition.label,
      value,
      valueLabel: definition.format(value),
      regionalMedian,
      regionalMedianLabel: definition.format(regionalMedian),
      percentile: percentile(value, globalValues),
      comparison: comparisonLabel(value, regionalMedian),
      tone: comparisonTone(value, regionalMedian, definition.direction),
    }];
  });

  return {
    countryCount: countries.length,
    regionalPeerCount: regionalPeers.length,
    riskRank: 1 + countries.filter((country) => country.risk > selected.risk).length,
    metrics,
  };
};
