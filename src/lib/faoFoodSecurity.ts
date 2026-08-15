/**
 * FAOSTAT Suite of Food Security Indicators.
 *
 * `FoodWaterProfile` has been curated since v11 — plausible numbers with no
 * publisher behind them. This wires the FAO's own suite, which is the source
 * the SDG 2.1 indicators are reported from, and keeps two properties the
 * curated layer could not:
 *
 *   - **Reference periods are preserved verbatim.** FAO publishes most food
 *     security prevalences as three-year averages ("2022-2024") precisely
 *     because single-year survey estimates are too noisy. Collapsing that to
 *     "2024" would overstate what the number knows, so the period label travels
 *     with the value.
 *   - **Estimate status is kept.** FAO flags values as official, estimated or
 *     imputed; an imputed prevalence is not a measurement, and the flag is
 *     carried through rather than dropped at the boundary.
 */

import { parseCsv } from './csv';
import type { SeatToIso } from './unVotes';

/**
 * FAOSTAT area names that differ from our slugs. FAO uses formal UN names and
 * its own China breakdown, where "China; mainland" excludes Hong Kong, Macao
 * and Taiwan — so it, not the aggregate "China", is the mainland series.
 */
export const FAO_NAME_ALIASES: Record<string, readonly string[]> = {
  china: ['China; mainland'],
  'cote-divoire': ["Côte d'Ivoire"],
  'dem-rep-congo': ['Democratic Republic of the Congo'],
  kosovo: ['Kosovo'],
  laos: ["Lao People's Democratic Republic"],
  moldova: ['Republic of Moldova'],
  'north-korea': ["Democratic People's Republic of Korea"],
  russia: ['Russian Federation'],
  'south-korea': ['Republic of Korea'],
  syria: ['Syrian Arab Republic'],
  taiwan: ['China; Taiwan Province of'],
  tanzania: ['United Republic of Tanzania'],
  turkey: ['Türkiye', 'Turkey'],
  uae: ['United Arab Emirates'],
  vietnam: ['Viet Nam'],
};

/** The indicators surfaced by the app, keyed by FAOSTAT item code. */
export const FAO_INDICATORS = {
  '210041': { key: 'undernourishmentPct', label: 'Prevalence of undernourishment', unit: '%' },
  '210091': {
    key: 'moderateOrSevereFoodInsecurityPct',
    label: 'Moderate or severe food insecurity',
    unit: '%',
  },
  '210401': { key: 'severeFoodInsecurityPct', label: 'Severe food insecurity', unit: '%' },
  '21010': { key: 'dietaryEnergyAdequacyPct', label: 'Dietary energy supply adequacy', unit: '%' },
  '21047': { key: 'basicDrinkingWaterPct', label: 'Using at least basic drinking water', unit: '%' },
  '21048': { key: 'basicSanitationPct', label: 'Using at least basic sanitation', unit: '%' },
} as const;

export type FaoIndicatorKey = (typeof FAO_INDICATORS)[keyof typeof FAO_INDICATORS]['key'];

/** FAO flag codes worth distinguishing; anything else is treated as reported. */
export const FAO_FLAG_LABEL: Record<string, string> = {
  A: 'official',
  E: 'estimated',
  I: 'imputed',
  X: 'international estimate',
};

export interface FaoObservation {
  value: number;
  /** FAO's own period label, e.g. `2022-2024` for a three-year average. */
  period: string;
  /** Final year of the period — used only for ordering, never for display. */
  periodEndYear: number;
  /** `official` / `estimated` / `imputed`, when FAO published a flag. */
  status: string | null;
}

export type FaoCountrySummary = Partial<Record<FaoIndicatorKey, FaoObservation>>;

export interface FaoIndicatorMeta {
  key: FaoIndicatorKey;
  label: string;
  unit: string;
}

/**
 * Everything the artifact register needs to *date and size* the artifact,
 * without loading the ~115 KB of per-country values behind it.
 *
 * The full payload is only read when a reader opens a country's food security
 * panel, so pulling it into the eager bundle purely to stamp a retrieval date
 * would be the same mistake the historical series sidecar exists to avoid.
 * `validateDataset` checks this summary against the real artifact.
 */
export interface FaoFoodSecurityMeta {
  fetchedAt: string;
  sourceTitle: string;
  sourceUrl: string;
  indicators: FaoIndicatorMeta[];
  countryCount: number;
  /** Newest period end-year present anywhere in the artifact. */
  newestPeriodEndYear: number;
}

export interface FaoFoodSecurityArtifact extends FaoFoodSecurityMeta {
  perCountry: Record<string, FaoCountrySummary>;
}

/** Reduce a full artifact to its sidecar summary — the single definition both writers use. */
export const summarizeFaoArtifact = (artifact: FaoFoodSecurityArtifact): FaoFoodSecurityMeta => ({
  fetchedAt: artifact.fetchedAt,
  sourceTitle: artifact.sourceTitle,
  sourceUrl: artifact.sourceUrl,
  indicators: artifact.indicators,
  countryCount: Object.keys(artifact.perCountry).length,
  newestPeriodEndYear: artifact.newestPeriodEndYear,
});

/**
 * The final year of a FAO period label. `2022-2024` → 2024, `2024` → 2024.
 * Returns null for anything unparseable so a malformed row is skipped rather
 * than silently sorted to the beginning of time.
 */
export const periodEndYear = (period: string): number | null => {
  const years = period.match(/\d{4}/g);
  if (!years || years.length === 0) return null;
  const last = Number.parseInt(years[years.length - 1]!, 10);
  return Number.isFinite(last) ? last : null;
};

export interface FaoRow {
  area: string;
  itemCode: string;
  period: string;
  value: number;
  flag: string | null;
}

/**
 * Parse the normalized FAOSTAT CSV, keeping only the selected indicators.
 *
 * The full file is ~50 MB of long-format rows across 68 indicators; filtering
 * during the row scan keeps peak memory near the size of what is kept rather
 * than the size of the download.
 */
export const parseFaoFoodSecurityCsv = (text: string): FaoRow[] => {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((name) => name.trim());
  const index = new Map(header.map((name, position) => [name, position]));

  const iArea = index.get('Area');
  const iItem = index.get('Item Code');
  const iYear = index.get('Year');
  const iValue = index.get('Value');
  const iFlag = index.get('Flag');
  if (iArea === undefined || iItem === undefined || iYear === undefined || iValue === undefined) {
    throw new Error('FAOSTAT food security extract missing expected columns');
  }

  const wanted = new Set(Object.keys(FAO_INDICATORS));
  const out: FaoRow[] = [];
  for (const raw of rows.slice(1)) {
    const itemCode = (raw[iItem] ?? '').trim();
    if (!wanted.has(itemCode)) continue;
    const value = Number.parseFloat((raw[iValue] ?? '').trim());
    if (!Number.isFinite(value)) continue;
    out.push({
      area: (raw[iArea] ?? '').trim(),
      itemCode,
      period: (raw[iYear] ?? '').trim(),
      value,
      flag: iFlag !== undefined ? (raw[iFlag] ?? '').trim() || null : null,
    });
  }
  return out;
};

/**
 * Reduce rows to the newest observation per country and indicator.
 *
 * "Newest" is decided by the period's final year. FAO republishes back-series
 * every release, so taking the last row encountered would depend on file order
 * rather than on recency.
 */
export const aggregateFaoFoodSecurity = (
  rows: FaoRow[],
  nameToIso: SeatToIso,
): { perCountry: Record<string, FaoCountrySummary>; newestPeriodEndYear: number } => {
  const perCountry: Record<string, FaoCountrySummary> = {};
  let newest = 0;

  for (const row of rows) {
    const iso = nameToIso.get(row.area);
    if (!iso) continue;
    const indicator = FAO_INDICATORS[row.itemCode as keyof typeof FAO_INDICATORS];
    if (!indicator) continue;
    const endYear = periodEndYear(row.period);
    if (endYear === null) continue;

    const summary = perCountry[iso] ?? {};
    const existing = summary[indicator.key];
    if (!existing || endYear > existing.periodEndYear) {
      summary[indicator.key] = {
        value: row.value,
        period: row.period,
        periodEndYear: endYear,
        status: row.flag ? (FAO_FLAG_LABEL[row.flag] ?? null) : null,
      };
      perCountry[iso] = summary;
      if (endYear > newest) newest = endYear;
    }
  }

  return { perCountry, newestPeriodEndYear: newest };
};
