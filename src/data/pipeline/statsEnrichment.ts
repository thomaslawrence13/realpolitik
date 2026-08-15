/**
 * Merge World Bank (live or ingested) numeric series into profile economic /
 * military snapshots so the inspector and map choropleths stay current even
 * when the static curated stats were stamped earlier.
 */

import type {
  CountryProfile,
  DemographicStats,
  EconomicMetricKey,
  EconomicStats,
  MetricProvenance,
  MilitaryMetricKey,
  MilitaryStats,
  StatField,
  StatsProvenance,
} from '../../types';
import type { LiveData } from '../worldBankClient';
import { countryIso2 } from '../worldBankClient';
import { observationDateFromYear, type WbIndicatorKey } from '../../lib/worldBankFetch';
import type {
  ImfWeoSnapshot,
  IngestedSnapshot,
  ObservedAtIndex,
  SnapshotIndicatorKey,
} from './externalProviders';
import type { WeoObservation } from '../imfWeoClient';

const hasFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const sourceIdFor = (profile: CountryProfile, preferred: string): string =>
  profile.sourceIds.includes(preferred) ? preferred : profile.sourceIds[0] ?? preferred;

const staticProvenance = (
  profile: CountryProfile,
  preferredSource: string,
): MetricProvenance => ({
  sourceId: sourceIdFor(profile, preferredSource),
  observedAt: profile.lastUpdated,
  retrievedAt: profile.lastUpdated,
  evidenceClass: profile.sourceCoverage < 70 ? 'fallback' : 'estimated',
  confidence: Math.max(0.35, Math.min(0.95, profile.sourceCoverage / 100)),
});

const liveProvenance = (
  live: LiveData,
  key: WbIndicatorKey,
  iso: string,
  confidence: number,
): MetricProvenance | null => {
  const metadata = live.indicatorMetadata?.[key];
  const observedAt = observationDateFromYear(metadata?.observedYears[iso]);
  if (!observedAt) return null;
  return {
    sourceId: 'world-bank-wdi',
    observedAt,
    retrievedAt: metadata?.retrievedAt ?? live.refreshedAt ?? undefined,
    evidenceClass: 'observed',
    confidence,
  };
};

const ingestProvenance = (
  profile: CountryProfile,
  ingest: IngestedSnapshot,
  snapshotKey: SnapshotIndicatorKey,
  confidence: number,
  observedAtByIndicator?: ObservedAtIndex,
): MetricProvenance => {
  const observedAtRaw =
    ingest.observation_dates?.[snapshotKey]?.[profile.id] ??
    ingest.observationYears?.[snapshotKey]?.[profile.id] ??
    observedAtByIndicator?.[snapshotKey]?.[profile.id] ??
    profile.lastUpdated;
  const observedAt = /^\d{4}$/.test(observedAtRaw)
    ? observationDateFromYear(observedAtRaw) ?? observedAtRaw
    : observedAtRaw;
  return {
    sourceId: 'world-bank-wdi',
    observedAt,
    retrievedAt: ingest.timestamp,
    evidenceClass:
      ingest.observationYears?.[snapshotKey]?.[profile.id] || observedAtByIndicator?.[snapshotKey]?.[profile.id]
        ? 'observed'
        : 'fallback',
    confidence,
    vintage: observedAt.slice(0, 4),
  };
};

const weoProvenance = (
  weo: ImfWeoSnapshot,
  entry: WeoObservation,
): MetricProvenance => ({
  sourceId: 'imf-weo',
  observedAt: `${entry.year}-12-31`,
  retrievedAt: weo.timestamp,
  evidenceClass: entry.projection ? 'estimated' : 'observed',
  confidence: entry.projection ? 0.82 : 0.92,
  vintage: entry.year,
  ...(entry.projection ? { projection: true } : {}),
});

const withEconomicProvenance = (
  profile: CountryProfile,
  stats: EconomicStats | undefined,
  patch: Partial<Record<EconomicMetricKey, MetricProvenance>>,
): EconomicStats | undefined => {
  if (!stats) return undefined;
  const defaults: Partial<Record<EconomicMetricKey, MetricProvenance>> = {
    gdpBillionUsd: staticProvenance(profile, 'imf-weo'),
    gdpGrowthPct: staticProvenance(profile, 'world-bank-wdi'),
    gdpPerCapitaUsd: staticProvenance(profile, 'world-bank-wdi'),
    inflationPct: staticProvenance(profile, 'world-bank-wdi'),
    tradeGdpPct: staticProvenance(profile, 'world-bank-wdi'),
  };
  return {
    ...stats,
    provenance: { ...defaults, ...stats.provenance, ...patch },
  };
};

const withMilitaryProvenance = (
  profile: CountryProfile,
  stats: MilitaryStats | undefined,
  patch: Partial<Record<MilitaryMetricKey, MetricProvenance>>,
): MilitaryStats | undefined => {
  if (!stats) return undefined;
  const defaults: Partial<Record<MilitaryMetricKey, MetricProvenance>> = {
    militaryExpBillionUsd: staticProvenance(profile, 'sipri-milex'),
    militaryExpGdpPct: staticProvenance(profile, 'sipri-milex'),
    activePersonnelThousands: staticProvenance(profile, 'iiss-military-balance'),
    nuclearArmed: staticProvenance(profile, 'iiss-military-balance'),
  };
  return {
    ...stats,
    provenance: { ...defaults, ...stats.provenance, ...patch },
  };
};

const mergeEconomic = (
  base: EconomicStats | undefined,
  patch: Partial<EconomicStats>,
): EconomicStats | undefined => {
  if (!base && Object.keys(patch).length === 0) return base;
  if (!base) {
    // Do not invent a full economic snapshot from partial live fields alone.
    return undefined;
  }
  return { ...base, ...patch };
};

const mergeMilitary = (
  base: MilitaryStats | undefined,
  patch: Partial<MilitaryStats>,
): MilitaryStats | undefined => {
  if (!base && Object.keys(patch).length === 0) return base;
  if (!base) return undefined;
  const next = { ...base, ...patch };
  // Keep spend level coherent when %GDP updates and we know nominal GDP.
  return next;
};

/**
 * Apply live ISO-keyed WB maps first, then fill remaining gaps from the
 * country-id-keyed ingest snapshot.
 */
export const applyStatsCoverageEnrichment = (
  profile: CountryProfile,
  live: LiveData,
  ingest?: IngestedSnapshot,
  weo?: ImfWeoSnapshot,
  observedAtByIndicator?: ObservedAtIndex,
): Pick<CountryProfile, 'economicStats' | 'militaryStats' | 'demographics' | 'statsProvenance'> => {
  const iso = countryIso2[profile.id];
  const econPatch: Partial<EconomicStats> = {};
  const milPatch: Partial<MilitaryStats> = {};
  const demographicPatch: Partial<DemographicStats> = {};
  const econProvenancePatch: Partial<Record<EconomicMetricKey, MetricProvenance>> = {};
  const milProvenancePatch: Partial<Record<MilitaryMetricKey, MetricProvenance>> = {};

  const applyWeoEconomic = (
    entry: WeoObservation | undefined,
    field: EconomicMetricKey,
    value: number | undefined,
  ) => {
    if (!weo || !entry || !hasFinite(value)) return;
    (econPatch as Record<string, number>)[field] = value;
    econProvenancePatch[field] = weoProvenance(weo, entry);
  };

  if (weo) {
    const growth = weo.imf_gdp_growth?.[profile.id];
    const inflation = weo.imf_inflation?.[profile.id];
    const gdp = weo.imf_gdp_usd_billions?.[profile.id];
    const gdpPerCapita = weo.imf_gdp_per_capita_usd?.[profile.id];
    const population = weo.imf_population_millions?.[profile.id];
    applyWeoEconomic(growth, 'gdpGrowthPct', growth && Math.round(growth.value * 10) / 10);
    applyWeoEconomic(inflation, 'inflationPct', inflation && Math.round(inflation.value * 10) / 10);
    applyWeoEconomic(gdp, 'gdpBillionUsd', gdp && Math.round(gdp.value * 10) / 10);
    applyWeoEconomic(gdpPerCapita, 'gdpPerCapitaUsd', gdpPerCapita && Math.round(gdpPerCapita.value));
    if (population && hasFinite(population.value)) {
      demographicPatch.populationMillions = Math.round(population.value * 10) / 10;
    }
  }

  if (iso) {
    const growth = live.gdpGrowth[iso];
    const gdpNominalUsd = live.gdpNominalUsd[iso];
    const gdpPerCapitaUsd = live.gdpPerCapitaUsd[iso];
    const inflation = live.inflation[iso];
    const trade = live.tradePct[iso];
    const milPct = live.militaryExpPct[iso];
    const milUsd = live.militaryExpUsd[iso];
    const growthProvenance = liveProvenance(live, 'gdpGrowth', iso, 0.9);
    const gdpNominalProvenance = liveProvenance(live, 'gdpNominalUsd', iso, 0.9);
    const gdpPerCapitaProvenance = liveProvenance(live, 'gdpPerCapitaUsd', iso, 0.9);
    const inflationProvenance = liveProvenance(live, 'inflation', iso, 0.9);
    const tradeProvenance = liveProvenance(live, 'tradePct', iso, 0.88);
    const militaryProvenance = liveProvenance(live, 'militaryExpPct', iso, 0.86);
    const militarySpendProvenance = liveProvenance(live, 'militaryExpUsd', iso, 0.9);
    if (econPatch.gdpGrowthPct == null && hasFinite(growth) && growthProvenance) {
      econPatch.gdpGrowthPct = Math.round(growth * 10) / 10;
      econProvenancePatch.gdpGrowthPct = growthProvenance;
    }
    if (econPatch.gdpBillionUsd == null && hasFinite(gdpNominalUsd) && gdpNominalProvenance) {
      econPatch.gdpBillionUsd = Math.round((gdpNominalUsd / 1_000_000_000) * 10) / 10;
      econProvenancePatch.gdpBillionUsd = gdpNominalProvenance;
    }
    if (econPatch.gdpPerCapitaUsd == null && hasFinite(gdpPerCapitaUsd) && gdpPerCapitaProvenance) {
      econPatch.gdpPerCapitaUsd = Math.round(gdpPerCapitaUsd);
      econProvenancePatch.gdpPerCapitaUsd = gdpPerCapitaProvenance;
    }
    if (econPatch.inflationPct == null && hasFinite(inflation) && inflationProvenance) {
      econPatch.inflationPct = Math.round(inflation * 10) / 10;
      econProvenancePatch.inflationPct = inflationProvenance;
    }
    if (hasFinite(trade) && tradeProvenance) {
      econPatch.tradeGdpPct = Math.round(trade * 10) / 10;
      econProvenancePatch.tradeGdpPct = tradeProvenance;
    }
    if (hasFinite(milPct) && militaryProvenance) {
      milPatch.militaryExpGdpPct = Math.round(milPct * 100) / 100;
      milProvenancePatch.militaryExpGdpPct = militaryProvenance;
    }
    if (hasFinite(milUsd) && militarySpendProvenance) {
      milPatch.militaryExpBillionUsd = Math.round((milUsd / 1_000_000_000) * 10) / 10;
      milProvenancePatch.militaryExpBillionUsd = militarySpendProvenance;
    }
  }

  if (ingest) {
    const growth = ingest.world_bank_gdp_growth?.[profile.id];
    const gdpNominalUsd =
      ingest.world_bank_gdp_usd?.[profile.id] ?? ingest.world_bank_gdp_nominal_usd?.[profile.id];
    const gdpPerCapitaUsd = ingest.world_bank_gdp_per_capita_usd?.[profile.id];
    const inflation = ingest.world_bank_inflation?.[profile.id];
    const trade = ingest.world_bank_trade_pct?.[profile.id];
    const milPct = ingest.world_bank_military_expenditure_pct?.[profile.id];
    const milUsd = ingest.world_bank_military_expenditure_usd?.[profile.id];
    const population = ingest.world_bank_population?.[profile.id];
    const urbanization = ingest.world_bank_urban_pct?.[profile.id];
    if (econPatch.gdpGrowthPct == null && hasFinite(growth)) {
      econPatch.gdpGrowthPct = Math.round(growth * 10) / 10;
      econProvenancePatch.gdpGrowthPct = ingestProvenance(profile, ingest, 'world_bank_gdp_growth', 0.9, observedAtByIndicator);
    }
    if (econPatch.gdpBillionUsd == null && hasFinite(gdpNominalUsd)) {
      econPatch.gdpBillionUsd = Math.round((gdpNominalUsd / 1_000_000_000) * 10) / 10;
      econProvenancePatch.gdpBillionUsd = ingestProvenance(profile, ingest, 'world_bank_gdp_nominal_usd', 0.9, observedAtByIndicator);
    }
    if (econPatch.gdpPerCapitaUsd == null && hasFinite(gdpPerCapitaUsd)) {
      econPatch.gdpPerCapitaUsd = Math.round(gdpPerCapitaUsd);
      econProvenancePatch.gdpPerCapitaUsd = ingestProvenance(profile, ingest, 'world_bank_gdp_per_capita_usd', 0.9, observedAtByIndicator);
    }
    if (econPatch.inflationPct == null && hasFinite(inflation)) {
      econPatch.inflationPct = Math.round(inflation * 10) / 10;
      econProvenancePatch.inflationPct = ingestProvenance(profile, ingest, 'world_bank_inflation', 0.9, observedAtByIndicator);
    }
    if (econPatch.tradeGdpPct == null && hasFinite(trade)) {
      econPatch.tradeGdpPct = Math.round(trade * 10) / 10;
      econProvenancePatch.tradeGdpPct = ingestProvenance(profile, ingest, 'world_bank_trade_pct', 0.88, observedAtByIndicator);
    }
    if (milPatch.militaryExpGdpPct == null && hasFinite(milPct)) {
      milPatch.militaryExpGdpPct = Math.round(milPct * 100) / 100;
      milProvenancePatch.militaryExpGdpPct = ingestProvenance(profile, ingest, 'world_bank_military_expenditure_pct', 0.9, observedAtByIndicator);
    }
    if (milPatch.militaryExpBillionUsd == null && hasFinite(milUsd)) {
      milPatch.militaryExpBillionUsd = Math.round((milUsd / 1_000_000_000) * 10) / 10;
      milProvenancePatch.militaryExpBillionUsd = ingestProvenance(profile, ingest, 'world_bank_military_expenditure_usd', 0.9, observedAtByIndicator);
    }
    if (demographicPatch.populationMillions == null && hasFinite(population)) {
      demographicPatch.populationMillions = Math.round((population / 1_000_000) * 10) / 10;
    }
    if (hasFinite(urbanization)) {
      demographicPatch.urbanizationPct = Math.round(urbanization * 10) / 10;
    }
  }

  // Re-derive nominal defence spend when we have GDP and an updated burden %.
  const economicStats = withEconomicProvenance(
    profile,
    mergeEconomic(profile.economicStats, econPatch),
    econProvenancePatch,
  );
  const demographics = profile.demographics
    ? { ...profile.demographics, ...demographicPatch }
    : undefined;
  let militaryStats = withMilitaryProvenance(
    profile,
    mergeMilitary(profile.militaryStats, milPatch),
    milProvenancePatch,
  );
  if (
    militaryStats &&
    economicStats &&
    milPatch.militaryExpGdpPct != null &&
    milPatch.militaryExpBillionUsd == null &&
    hasFinite(economicStats.gdpBillionUsd)
  ) {
    militaryStats = {
      ...militaryStats,
      militaryExpBillionUsd:
        Math.round(economicStats.gdpBillionUsd * (militaryStats.militaryExpGdpPct / 100) * 10) / 10,
      provenance: {
        ...militaryStats.provenance,
        militaryExpBillionUsd: {
          ...(milProvenancePatch.militaryExpGdpPct ?? militaryStats.provenance?.militaryExpGdpPct ?? staticProvenance(profile, 'sipri-milex')),
          evidenceClass: 'derived',
        },
      },
    };
  }

  const statsProvenance: StatsProvenance = {};
  const addStatProvenance = (field: StatField, entry: MetricProvenance | undefined) => {
    if (!entry) return;
    statsProvenance[field] = {
      sourceId: entry.sourceId,
      vintage: entry.vintage ?? entry.observedAt.slice(0, 4),
      ...(entry.projection ? { projection: true } : {}),
    };
  };
  if (economicStats) {
    for (const [field, entry] of Object.entries(econProvenancePatch)) {
      addStatProvenance(field as EconomicMetricKey, entry);
    }
  }
  if (militaryStats) {
    for (const [field, entry] of Object.entries(milProvenancePatch)) {
      if (field === 'militaryExpGdpPct' || field === 'militaryExpBillionUsd') {
        addStatProvenance(field, entry);
      }
    }
  }
  if (demographics && demographicPatch.populationMillions != null) {
    const entry = weo?.imf_population_millions?.[profile.id];
    statsProvenance.populationMillions = entry
      ? { sourceId: 'imf-weo', vintage: entry.year, ...(entry.projection ? { projection: true } : {}) }
      : {
          sourceId: 'world-bank-wdi',
          vintage:
            observedAtByIndicator?.world_bank_population?.[profile.id]?.slice(0, 4) ??
            ingest?.timestamp.slice(0, 4),
        };
  }
  if (demographics && demographicPatch.urbanizationPct != null) {
    statsProvenance.urbanizationPct = {
      sourceId: 'world-bank-wdi',
      vintage:
        observedAtByIndicator?.world_bank_urban_pct?.[profile.id]?.slice(0, 4) ??
        ingest?.timestamp.slice(0, 4),
    };
  }

  return {
    economicStats,
    militaryStats,
    demographics,
    ...(Object.keys(statsProvenance).length > 0 ? { statsProvenance } : {}),
  };
};
