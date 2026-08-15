import historicalIndicatorSeries from './datasets/historical_indicator_series.json';
import { countryIso2, iso2ToCountryId } from './worldBankClient';
import type {
  CompactHistoricalIndicator,
  HistoricalSeriesCode,
  HistoricalSeriesArtifact,
} from '../lib/historicalSeriesArtifact';
import type {
  HistoricalMetricId,
  HistoricalMetricMetadata,
  HistoricalMetricPoint,
  HistoricalMetricSeries,
} from '../types';

type IndicatorConfig = {
  metricId: HistoricalMetricId;
  label: string;
  wbCode: HistoricalSeriesCode;
  definition: string;
  unit: string;
  methodology: string;
  /** Optional normalization for display (e.g. raw dollars → billions). */
  scale?: number;
};

const WORLD_BANK_SOURCE_URL = 'https://databank.worldbank.org/source/world-development-indicators';
const WORLD_BANK_SOURCE_TITLE = 'World Development Indicators';
const ISO_DATE_LENGTH = 10;

const indicatorConfigs: IndicatorConfig[] = [
  {
    metricId: 'gdpGrowth',
    label: 'GDP growth',
    wbCode: 'NY.GDP.MKTP.KD.ZG',
    definition: 'Annual percentage growth rate of GDP at market prices based on constant local currency.',
    unit: '% annual',
    methodology: 'World Bank WDI annual release; latest non-null observations by country.',
  },
  {
    metricId: 'gdpNominal',
    label: 'GDP (nominal)',
    wbCode: 'NY.GDP.MKTP.CD',
    definition: 'Gross domestic product at purchaser prices in current US dollars.',
    unit: ' bn USD',
    methodology: 'World Bank WDI current-US-dollar annual series; latest non-null observations by country.',
    scale: 1 / 1_000_000_000,
  },
  {
    metricId: 'gdpPerCapita',
    label: 'GDP per capita',
    wbCode: 'NY.GDP.PCAP.CD',
    definition: 'Gross domestic product divided by midyear population in current US dollars.',
    unit: ' USD',
    methodology: 'World Bank WDI current-US-dollar per-capita annual series; latest non-null observations by country.',
  },
  {
    metricId: 'inflation',
    label: 'Inflation',
    wbCode: 'FP.CPI.TOTL.ZG',
    definition: 'Annual percentage change in the cost to the average consumer of acquiring a basket of goods and services.',
    unit: '% annual',
    methodology: 'World Bank WDI CPI annual series; latest non-null observations by country.',
  },
  {
    metricId: 'tradeOpenness',
    label: 'Trade openness',
    wbCode: 'TG.VAL.TOTL.GD.ZS',
    definition: 'Sum of exports and imports of goods and services measured as a share of GDP.',
    unit: '% of GDP',
    methodology: 'World Bank WDI annual trade ratio; latest non-null observations by country.',
  },
  {
    metricId: 'militaryBurden',
    label: 'Military expenditure burden',
    wbCode: 'MS.MIL.XPND.GD.ZS',
    definition: 'Military expenditure as a percentage of gross domestic product.',
    unit: '% of GDP',
    methodology: 'World Bank WDI/SIPRI-backed annual burden estimate; latest non-null observations by country.',
  },
  {
    metricId: 'militarySpend',
    label: 'Military expenditure',
    wbCode: 'MS.MIL.XPND.CD',
    definition: 'Military expenditure in current US dollars.',
    unit: ' bn USD',
    methodology: 'World Bank WDI series sourced from the SIPRI Military Expenditure Database; latest non-null observations by country.',
    scale: 1 / 1_000_000_000,
  },
  {
    metricId: 'unemployment',
    label: 'Unemployment',
    wbCode: 'SL.UEM.TOTL.ZS',
    definition: 'Share of the labor force that is without work but available for and seeking employment.',
    unit: '% of labor force',
    methodology: 'World Bank WDI modeled ILO estimate, annual frequency.',
  },
];

const payload = historicalIndicatorSeries as unknown as HistoricalSeriesArtifact;
const totalTrackedCountries = Object.keys(countryIso2).length;
const fallbackRetrievedDate = '1970-01-01';
const parsedRetrievedDate = new Date(payload.fetchedAt);
const retrievedDate = Number.isNaN(parsedRetrievedDate.getTime())
  ? fallbackRetrievedDate
  : parsedRetrievedDate.toISOString().slice(0, ISO_DATE_LENGTH);

const parseYear = (period: string) => {
  const value = Number.parseInt(period, 10);
  return Number.isFinite(value) ? value : Number.NaN;
};

const buildMetadata = (
  config: IndicatorConfig,
  pointsByIso: CompactHistoricalIndicator,
): HistoricalMetricMetadata => {
  const countryWithData = new Set<string>();
  let newestYear = 0;
  for (const [iso, points] of Object.entries(pointsByIso)) {
    if (!iso2ToCountryId[iso] || points.length === 0) continue;
    countryWithData.add(iso);
    for (const [period] of points) {
      const year = parseYear(period);
      if (!Number.isNaN(year) && year > newestYear) newestYear = year;
    }
  }

  const coveragePct = totalTrackedCountries === 0
    ? 0
    : Math.round((countryWithData.size / totalTrackedCountries) * 100);
  const nowYear = new Date().getUTCFullYear();
  const confidenceFlags: string[] = [];
  if (coveragePct < 70) confidenceFlags.push('low coverage');
  if (newestYear > 0 && nowYear - newestYear > 2) confidenceFlags.push('stale');
  if (confidenceFlags.length === 0) confidenceFlags.push('good coverage');

  return {
    sourceId: 'world-bank-wdi',
    sourceTitle: WORLD_BANK_SOURCE_TITLE,
    sourceUrl: WORLD_BANK_SOURCE_URL,
    definition: config.definition,
    unit: config.unit,
    methodology: config.methodology,
    lastUpdated: newestYear > 0 ? String(newestYear) : 'unknown',
    coverage: `${coveragePct}% of tracked countries`,
    confidenceFlags,
    retrievedAt: retrievedDate,
    frequency: 'annual',
  };
};

export const historicalSeriesByCountryId: Record<string, HistoricalMetricSeries[]> = (() => {
  const byCountry = new Map<string, HistoricalMetricSeries[]>();

  for (const config of indicatorConfigs) {
    const compactPoints = payload.indicators[config.wbCode] ?? {};
    const metadata = buildMetadata(config, compactPoints);
    const perCountry = new Map<string, HistoricalMetricPoint[]>();

    for (const [iso, points] of Object.entries(compactPoints)) {
      const countryId = iso2ToCountryId[iso];
      if (!countryId) continue;
      const normalized = points.flatMap(([period, value]) => {
        const year = parseYear(period);
        if (Number.isNaN(year) || !Number.isFinite(value)) return [];
        return [{
          period: String(year),
          value: value * (config.scale ?? 1),
          retrievalDate: metadata.retrievedAt,
          quality: 'observed' as const,
        }];
      });
      if (normalized.length > 0) perCountry.set(countryId, normalized);
    }

    perCountry.forEach((points, countryId) => {
      const sortedPoints = points
        .slice()
        .sort((left, right) => parseYear(left.period) - parseYear(right.period));
      if (sortedPoints.length === 0) return;
      const series: HistoricalMetricSeries = {
        metricId: config.metricId,
        label: config.label,
        points: sortedPoints,
        metadata,
      };
      const existing = byCountry.get(countryId);
      if (existing) existing.push(series);
      else byCountry.set(countryId, [series]);
    });
  }

  return Object.fromEntries(byCountry);
})();
