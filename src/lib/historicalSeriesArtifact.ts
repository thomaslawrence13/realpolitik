import {
  normalizeWorldBankPointIso,
  type WbDataPoint,
  type WbIndicatorCode,
} from './worldBankFetch';

export const HISTORICAL_SERIES_CODES = [
  'NY.GDP.MKTP.KD.ZG',
  'MS.MIL.XPND.CD',
  'NY.GDP.MKTP.CD',
  'NY.GDP.PCAP.CD',
  'FP.CPI.TOTL.ZG',
  'TG.VAL.TOTL.GD.ZS',
  'MS.MIL.XPND.GD.ZS',
  'SL.UEM.TOTL.ZS',
] as const satisfies readonly WbIndicatorCode[];

export type HistoricalSeriesCode = (typeof HISTORICAL_SERIES_CODES)[number];
export type CompactHistoricalPoint = [year: string, value: number];
export type CompactHistoricalIndicator = Record<string, CompactHistoricalPoint[]>;

export interface HistoricalSeriesArtifact {
  schema: 2;
  fetchedAt: string;
  indicators: Partial<Record<HistoricalSeriesCode, CompactHistoricalIndicator>>;
}

/**
 * Convert verbose World Bank response rows into a stable browser artifact.
 * Country and field names are stored once, observations are sorted, and a
 * duplicate country/year keeps the last numeric value deterministically.
 */
export const buildHistoricalSeriesArtifact = (
  fetchedAt: string,
  indicators: Partial<Record<WbIndicatorCode, WbDataPoint[]>>,
): HistoricalSeriesArtifact => {
  const compact: HistoricalSeriesArtifact['indicators'] = {};

  for (const code of HISTORICAL_SERIES_CODES) {
    const byIso = new Map<string, Map<string, number>>();
    for (const point of indicators[code] ?? []) {
      if (point.value == null || !Number.isFinite(point.value)) continue;
      const iso = normalizeWorldBankPointIso(point);
      const year = String(point.date ?? '').slice(0, 4);
      if (!iso || !/^\d{4}$/.test(year)) continue;
      const byYear = byIso.get(iso) ?? new Map<string, number>();
      byYear.set(year, point.value);
      byIso.set(iso, byYear);
    }

    compact[code] = Object.fromEntries(
      [...byIso.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([iso, byYear]) => [
          iso,
          [...byYear.entries()].sort(([left], [right]) => left.localeCompare(right)),
        ]),
    );
  }

  return { schema: 2, fetchedAt, indicators: compact };
};

/**
 * Sidecar metadata for the historical series artifact.
 *
 * The artifact itself is ~677 KB and is deliberately code-split so it loads
 * only when a reader opens a history chart. The artifact register needs the
 * artifact's *age and reach*, not its observations, so it reads this summary
 * instead — otherwise dating the artifact would drag the whole payload into
 * the eager bundle. `validateDataset` checks the summary against the full
 * artifact so the two cannot drift.
 */
export interface HistoricalSeriesMeta {
  schema: 2;
  fetchedAt: string;
  indicatorCodes: HistoricalSeriesCode[];
  countryCount: number;
  observationCount: number;
}

export const summarizeHistoricalSeriesArtifact = (
  artifact: HistoricalSeriesArtifact,
): HistoricalSeriesMeta => {
  const countries = new Set<string>();
  let observationCount = 0;

  for (const series of Object.values(artifact.indicators)) {
    for (const [iso, points] of Object.entries(series ?? {})) {
      countries.add(iso);
      observationCount += points.length;
    }
  }

  return {
    schema: 2,
    fetchedAt: artifact.fetchedAt,
    indicatorCodes: Object.keys(artifact.indicators) as HistoricalSeriesCode[],
    countryCount: countries.size,
    observationCount,
  };
};
