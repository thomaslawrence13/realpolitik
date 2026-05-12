import historicalIndicatorSeries from './datasets/historical_indicator_series.json';
import { countryIso2, iso2ToCountryId } from './worldBankClient';
import type {
  HistoricalMetricId,
  HistoricalMetricMetadata,
  HistoricalMetricPoint,
  HistoricalMetricSeries,
} from '../types';

type WorldBankPoint = {
  country: string;
  date: string;
  value: number | null;
};

type WorldBankAuditPayload = {
  fetchedAt: string;
  indicators: Record<string, WorldBankPoint[]>;
};

type IndicatorConfig = {
  metricId: HistoricalMetricId;
  label: string;
  wbCode: string;
  definition: string;
  unit: string;
  methodology: string;
};

const WORLD_BANK_SOURCE_URL = 'https://databank.worldbank.org/source/world-development-indicators';
const WORLD_BANK_SOURCE_TITLE = 'World Development Indicators';

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
    metricId: 'unemployment',
    label: 'Unemployment',
    wbCode: 'SL.UEM.TOTL.ZS',
    definition: 'Share of the labor force that is without work but available for and seeking employment.',
    unit: '% of labor force',
    methodology: 'World Bank WDI modeled ILO estimate, annual frequency.',
  },
];

const payload = historicalIndicatorSeries as WorldBankAuditPayload;
const totalTrackedCountries = Object.keys(countryIso2).length;
const isoToCountryId = new Map(Object.entries(iso2ToCountryId));

const parseYear = (period: string) => {
  const value = Number.parseInt(period, 10);
  return Number.isFinite(value) ? value : Number.NaN;
};

const buildMetadata = (
  config: IndicatorConfig,
  points: WorldBankPoint[],
): HistoricalMetricMetadata => {
  const countryWithData = new Set<string>();
  let newestYear = 0;
  for (const point of points) {
    if (point.value == null) continue;
    const countryId = isoToCountryId.get(point.country.toUpperCase());
    if (!countryId) continue;
    countryWithData.add(countryId);
    const year = parseYear(point.date);
    if (!Number.isNaN(year) && year > newestYear) newestYear = year;
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
    retrievedAt: payload.fetchedAt.slice(0, 10),
    frequency: 'annual',
  };
};

export const historicalSeriesByCountryId: Record<string, HistoricalMetricSeries[]> = (() => {
  const byCountry = new Map<string, HistoricalMetricSeries[]>();

  for (const config of indicatorConfigs) {
    const rawPoints = payload.indicators[config.wbCode] ?? [];
    const metadata = buildMetadata(config, rawPoints);
    const perCountry = new Map<string, HistoricalMetricPoint[]>();

    for (const point of rawPoints) {
      if (point.value == null) continue;
      const countryId = isoToCountryId.get(point.country.toUpperCase());
      if (!countryId) continue;
      const year = parseYear(point.date);
      if (Number.isNaN(year)) continue;
      const existing = perCountry.get(countryId);
      const entry: HistoricalMetricPoint = {
        period: String(year),
        value: point.value,
        retrievalDate: metadata.retrievedAt,
        quality: 'observed',
      };
      if (existing) existing.push(entry);
      else perCountry.set(countryId, [entry]);
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
