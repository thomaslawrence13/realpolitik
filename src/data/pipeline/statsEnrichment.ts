/**
 * Merge external numeric series into the profile snapshots that the inspector
 * and map choropleths read, and record where every merged number came from.
 *
 * Precedence is freshest-authoritative-first:
 *   1. IMF WEO ingest      — current-year-adjacent outturns, covers Taiwan
 *   2. World Bank live API — reported outturns, refreshed in the browser
 *   3. World Bank ingest   — same series, committed snapshot (offline fallback)
 *   4. Curated dataset     — whatever the static record already held
 *
 * Every field that gets overwritten also writes a `StatProvenance` entry, so the
 * UI can cite the number it is displaying rather than the dataset as a whole.
 */

import type {
  CountryProfile,
  DemographicStats,
  EconomicStats,
  MilitaryStats,
  StatField,
  StatsProvenance,
} from '../../types';
import type { LiveData, WbIndicator } from '../worldBankClient';
import { countryIso2 } from '../worldBankClient';
import type { WeoObservation } from '../imfWeoClient';
import type { ImfWeoSnapshot, IngestedSnapshot, ObservedAtIndex, SnapshotIndicatorKey } from './externalProviders';

const hasFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * Accumulates field values alongside their provenance, keeping the first writer
 * to claim each field. Callers apply sources in precedence order, so "first
 * write wins" is what implements the precedence chain above.
 */
class StatsAccumulator {
  readonly economic: Partial<EconomicStats> = {};
  readonly military: Partial<MilitaryStats> = {};
  readonly demographic: Partial<DemographicStats> = {};
  readonly provenance: StatsProvenance = {};

  private claim(field: StatField, sourceId: string, vintage?: string, projection?: boolean): boolean {
    if (this.provenance[field]) return false;
    this.provenance[field] = {
      sourceId,
      ...(vintage ? { vintage } : {}),
      ...(projection ? { projection: true } : {}),
    };
    return true;
  }

  economicField<K extends keyof EconomicStats & StatField>(
    field: K,
    value: number | null | undefined,
    sourceId: string,
    options?: { vintage?: string; projection?: boolean; places?: number },
  ): void {
    if (!hasFinite(value)) return;
    if (!this.claim(field, sourceId, options?.vintage, options?.projection)) return;
    this.economic[field] = round(value, options?.places ?? 1) as EconomicStats[K];
  }

  militaryField<K extends keyof MilitaryStats & StatField>(
    field: K,
    value: number | null | undefined,
    sourceId: string,
    options?: { vintage?: string; projection?: boolean; places?: number },
  ): void {
    if (!hasFinite(value)) return;
    if (!this.claim(field, sourceId, options?.vintage, options?.projection)) return;
    this.military[field] = round(value, options?.places ?? 2) as MilitaryStats[K];
  }

  demographicField<K extends keyof DemographicStats & StatField>(
    field: K,
    value: number | null | undefined,
    sourceId: string,
    options?: { vintage?: string; projection?: boolean; places?: number },
  ): void {
    if (!hasFinite(value)) return;
    if (!this.claim(field, sourceId, options?.vintage, options?.projection)) return;
    this.demographic[field] = round(value, options?.places ?? 1) as DemographicStats[K];
  }
}

/** Read a WEO entry, if the snapshot carries one for this country. */
const weoEntry = (
  weo: ImfWeoSnapshot | undefined,
  key: keyof ImfWeoSnapshot,
  countryId: string,
): WeoObservation | undefined => {
  if (!weo) return undefined;
  const series = weo[key];
  if (!series || typeof series !== 'object') return undefined;
  return (series as Record<string, WeoObservation>)[countryId];
};

const applyWeo = (accumulator: StatsAccumulator, weo: ImfWeoSnapshot | undefined, countryId: string): void => {
  const take = (key: keyof ImfWeoSnapshot) => weoEntry(weo, key, countryId);

  const growth = take('imf_gdp_growth');
  const inflation = take('imf_inflation');
  const gdp = take('imf_gdp_usd_billions');
  const gdpPerCapita = take('imf_gdp_per_capita_usd');
  const population = take('imf_population_millions');

  const opts = (entry: WeoObservation | undefined) =>
    entry ? { vintage: entry.year, projection: entry.projection } : undefined;

  accumulator.economicField('gdpGrowthPct', growth?.value, 'imf-weo', opts(growth));
  accumulator.economicField('inflationPct', inflation?.value, 'imf-weo', opts(inflation));
  accumulator.economicField('gdpBillionUsd', gdp?.value, 'imf-weo', { ...opts(gdp), places: 1 });
  accumulator.economicField('gdpPerCapitaUsd', gdpPerCapita?.value, 'imf-weo', {
    ...opts(gdpPerCapita),
    places: 0,
  });
  accumulator.demographicField('populationMillions', population?.value, 'imf-weo', opts(population));
};

const applyWorldBankLive = (
  accumulator: StatsAccumulator,
  live: LiveData,
  countryId: string,
): void => {
  const iso = countryIso2[countryId];
  if (!iso) return;

  const vintageFor = (code: WbIndicator): string | undefined => live.vintages?.[code]?.[iso];

  accumulator.economicField('gdpGrowthPct', live.gdpGrowth[iso], 'world-bank-wdi', {
    vintage: vintageFor('NY.GDP.MKTP.KD.ZG'),
  });
  accumulator.economicField('inflationPct', live.inflation[iso], 'world-bank-wdi', {
    vintage: vintageFor('FP.CPI.TOTL.ZG'),
  });
  accumulator.economicField('tradeGdpPct', live.tradePct[iso], 'world-bank-wdi', {
    vintage: vintageFor('TG.VAL.TOTL.GD.ZS'),
  });
  accumulator.militaryField('militaryExpGdpPct', live.militaryExpPct[iso], 'world-bank-wdi', {
    vintage: vintageFor('MS.MIL.XPND.GD.ZS'),
  });
};

const applyWorldBankIngest = (
  accumulator: StatsAccumulator,
  ingest: IngestedSnapshot | undefined,
  observedAt: ObservedAtIndex | undefined,
  countryId: string,
): void => {
  if (!ingest) return;

  /**
   * Reference year of this country's newest observation for a series. Falls back
   * to the ingest year only when the raw audit is unavailable — never claim a
   * series is more current than the observation behind it.
   */
  const vintageFor = (key: SnapshotIndicatorKey): string | undefined =>
    observedAt?.[key]?.[countryId]?.slice(0, 4) ?? ingest.timestamp?.slice(0, 4);

  accumulator.economicField('gdpGrowthPct', ingest.world_bank_gdp_growth?.[countryId], 'world-bank-wdi', {
    vintage: vintageFor('world_bank_gdp_growth'),
  });
  accumulator.economicField('inflationPct', ingest.world_bank_inflation?.[countryId], 'world-bank-wdi', {
    vintage: vintageFor('world_bank_inflation'),
  });
  accumulator.economicField('tradeGdpPct', ingest.world_bank_trade_pct?.[countryId], 'world-bank-wdi', {
    vintage: vintageFor('world_bank_trade_pct'),
  });
  accumulator.economicField(
    'gdpPerCapitaUsd',
    ingest.world_bank_gdp_per_capita_usd?.[countryId],
    'world-bank-wdi',
    { vintage: vintageFor('world_bank_gdp_per_capita_usd'), places: 0 },
  );
  // WDI reports GDP in dollars; the profile carries billions.
  const gdpUsd = ingest.world_bank_gdp_usd?.[countryId];
  accumulator.economicField(
    'gdpBillionUsd',
    hasFinite(gdpUsd) ? gdpUsd / 1_000_000_000 : undefined,
    'world-bank-wdi',
    { vintage: vintageFor('world_bank_gdp_usd') },
  );
  accumulator.militaryField(
    'militaryExpGdpPct',
    ingest.world_bank_military_expenditure_pct?.[countryId],
    'world-bank-wdi',
    { vintage: vintageFor('world_bank_military_expenditure_pct') },
  );
  // WDI reports headcount; the profile carries millions.
  const population = ingest.world_bank_population?.[countryId];
  accumulator.demographicField(
    'populationMillions',
    hasFinite(population) ? population / 1_000_000 : undefined,
    'world-bank-wdi',
    { vintage: vintageFor('world_bank_population') },
  );
  accumulator.demographicField('urbanizationPct', ingest.world_bank_urban_pct?.[countryId], 'world-bank-wdi', {
    vintage: vintageFor('world_bank_urban_pct'),
  });
};

/**
 * Merge external series over the curated snapshots.
 *
 * A partial external payload never conjures a snapshot that did not exist: the
 * curated record defines which countries have economic/military/demographic
 * profiles at all, and this only refreshes fields within them.
 */
export const applyStatsCoverageEnrichment = (
  profile: CountryProfile,
  live: LiveData,
  ingest?: IngestedSnapshot,
  weo?: ImfWeoSnapshot,
  observedAt?: ObservedAtIndex,
): Pick<CountryProfile, 'economicStats' | 'militaryStats' | 'demographics' | 'statsProvenance'> => {
  const accumulator = new StatsAccumulator();

  // Precedence order — first writer per field wins.
  applyWeo(accumulator, weo, profile.id);
  applyWorldBankLive(accumulator, live, profile.id);
  applyWorldBankIngest(accumulator, ingest, observedAt, profile.id);

  const economicStats = profile.economicStats
    ? { ...profile.economicStats, ...accumulator.economic }
    : undefined;
  const demographics = profile.demographics
    ? { ...profile.demographics, ...accumulator.demographic }
    : undefined;
  let militaryStats = profile.militaryStats
    ? { ...profile.militaryStats, ...accumulator.military }
    : undefined;

  // Re-derive nominal defence spend when we have GDP and an updated burden %.
  if (
    militaryStats &&
    economicStats &&
    accumulator.military.militaryExpGdpPct != null &&
    hasFinite(economicStats.gdpBillionUsd)
  ) {
    militaryStats = {
      ...militaryStats,
      militaryExpBillionUsd: round(
        economicStats.gdpBillionUsd * (militaryStats.militaryExpGdpPct / 100),
        1,
      ),
    };
    const burdenProvenance = accumulator.provenance.militaryExpGdpPct;
    if (burdenProvenance) accumulator.provenance.militaryExpBillionUsd = burdenProvenance;
  }

  // Only report provenance for fields that actually survived onto a snapshot —
  // claiming a source for a value the reader cannot see would be noise.
  const statsProvenance: StatsProvenance = {};
  for (const [field, entry] of Object.entries(accumulator.provenance) as Array<
    [StatField, StatsProvenance[StatField]]
  >) {
    if (!entry) continue;
    const surfaced =
      (economicStats && field in economicStats && field in accumulator.economic) ||
      (militaryStats && field in militaryStats && field in accumulator.military) ||
      (demographics && field in demographics && field in accumulator.demographic) ||
      (militaryStats && field === 'militaryExpBillionUsd');
    if (surfaced) statsProvenance[field] = entry;
  }

  return {
    economicStats,
    militaryStats,
    demographics,
    ...(Object.keys(statsProvenance).length > 0 ? { statsProvenance } : {}),
  };
};
