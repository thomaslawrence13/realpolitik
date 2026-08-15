/**
 * Merge World Bank (live or ingested) numeric series into profile economic /
 * military snapshots so the inspector and map choropleths stay current even
 * when the static curated stats were stamped earlier.
 */

import type {
  CountryProfile,
  EconomicMetricKey,
  EconomicStats,
  MetricProvenance,
  MilitaryMetricKey,
  MilitaryStats,
} from '../../types';
import type { LiveData } from '../worldBankClient';
import { countryIso2 } from '../worldBankClient';
import { observationDateFromYear, type WbIndicatorKey } from '../../lib/worldBankFetch';
import type { IngestedSnapshot, ObservedAtIndex, SnapshotIndicatorKey } from './externalProviders';

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
  };
};

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
  observedAtByIndicator?: ObservedAtIndex,
): Pick<CountryProfile, 'economicStats' | 'militaryStats'> => {
  const iso = countryIso2[profile.id];
  const econPatch: Partial<EconomicStats> = {};
  const milPatch: Partial<MilitaryStats> = {};
  const econProvenancePatch: Partial<Record<EconomicMetricKey, MetricProvenance>> = {};
  const milProvenancePatch: Partial<Record<MilitaryMetricKey, MetricProvenance>> = {};

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
    if (hasFinite(growth) && growthProvenance) {
      econPatch.gdpGrowthPct = Math.round(growth * 10) / 10;
      econProvenancePatch.gdpGrowthPct = growthProvenance;
    }
    if (hasFinite(gdpNominalUsd) && gdpNominalProvenance) {
      econPatch.gdpBillionUsd = Math.round((gdpNominalUsd / 1_000_000_000) * 10) / 10;
      econProvenancePatch.gdpBillionUsd = gdpNominalProvenance;
    }
    if (hasFinite(gdpPerCapitaUsd) && gdpPerCapitaProvenance) {
      econPatch.gdpPerCapitaUsd = Math.round(gdpPerCapitaUsd);
      econProvenancePatch.gdpPerCapitaUsd = gdpPerCapitaProvenance;
    }
    if (hasFinite(inflation) && inflationProvenance) {
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
    const gdpNominalUsd = ingest.world_bank_gdp_nominal_usd?.[profile.id];
    const gdpPerCapitaUsd = ingest.world_bank_gdp_per_capita_usd?.[profile.id];
    const inflation = ingest.world_bank_inflation?.[profile.id];
    const trade = ingest.world_bank_trade_pct?.[profile.id];
    const milPct = ingest.world_bank_military_expenditure_pct?.[profile.id];
    const milUsd = ingest.world_bank_military_expenditure_usd?.[profile.id];
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
  }

  // Re-derive nominal defence spend when we have GDP and an updated burden %.
  const economicStats = withEconomicProvenance(
    profile,
    mergeEconomic(profile.economicStats, econPatch),
    econProvenancePatch,
  );
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

  return { economicStats, militaryStats };
};
