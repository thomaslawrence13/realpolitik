/**
 * Merge World Bank (live or ingested) numeric series into profile economic /
 * military snapshots so the inspector and map choropleths stay current even
 * when the static curated stats were stamped earlier.
 */

import type { CountryProfile, EconomicStats, MilitaryStats } from '../../types';
import type { LiveData } from '../worldBankClient';
import { countryIso2 } from '../worldBankClient';
import type { IngestedSnapshot } from './externalProviders';

const hasFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

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
): Pick<CountryProfile, 'economicStats' | 'militaryStats'> => {
  const iso = countryIso2[profile.id];
  const econPatch: Partial<EconomicStats> = {};
  const milPatch: Partial<MilitaryStats> = {};

  if (iso) {
    const growth = live.gdpGrowth[iso];
    const inflation = live.inflation[iso];
    const trade = live.tradePct[iso];
    const milPct = live.militaryExpPct[iso];
    if (hasFinite(growth)) econPatch.gdpGrowthPct = Math.round(growth * 10) / 10;
    if (hasFinite(inflation)) econPatch.inflationPct = Math.round(inflation * 10) / 10;
    if (hasFinite(trade)) econPatch.tradeGdpPct = Math.round(trade * 10) / 10;
    if (hasFinite(milPct)) milPatch.militaryExpGdpPct = Math.round(milPct * 100) / 100;
  }

  if (ingest) {
    const growth = ingest.world_bank_gdp_growth?.[profile.id];
    const inflation = ingest.world_bank_inflation?.[profile.id];
    const trade = ingest.world_bank_trade_pct?.[profile.id];
    const milPct = ingest.world_bank_military_expenditure_pct?.[profile.id];
    if (econPatch.gdpGrowthPct == null && hasFinite(growth)) {
      econPatch.gdpGrowthPct = Math.round(growth * 10) / 10;
    }
    if (econPatch.inflationPct == null && hasFinite(inflation)) {
      econPatch.inflationPct = Math.round(inflation * 10) / 10;
    }
    if (econPatch.tradeGdpPct == null && hasFinite(trade)) {
      econPatch.tradeGdpPct = Math.round(trade * 10) / 10;
    }
    if (milPatch.militaryExpGdpPct == null && hasFinite(milPct)) {
      milPatch.militaryExpGdpPct = Math.round(milPct * 100) / 100;
    }
  }

  // Re-derive nominal defence spend when we have GDP and an updated burden %.
  const economicStats = mergeEconomic(profile.economicStats, econPatch);
  let militaryStats = mergeMilitary(profile.militaryStats, milPatch);
  if (
    militaryStats &&
    economicStats &&
    milPatch.militaryExpGdpPct != null &&
    hasFinite(economicStats.gdpBillionUsd)
  ) {
    militaryStats = {
      ...militaryStats,
      militaryExpBillionUsd:
        Math.round(economicStats.gdpBillionUsd * (militaryStats.militaryExpGdpPct / 100) * 10) / 10,
    };
  }

  return { economicStats, militaryStats };
};
