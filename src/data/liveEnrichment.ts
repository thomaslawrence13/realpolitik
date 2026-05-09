/**
 * Live data enrichment layer.
 *
 * Merges World Bank API readings into the static country profiles, replacing
 * indicator dimensions that have a direct quantitative API analog. Expert-
 * curated political, historical, and sanctions indicators are left untouched.
 *
 * Mapping:
 *   MS.MIL.XPND.GD.ZS  → indicators.militaryTreatyLevel
 *   TG.VAL.TOTL.GD.ZS   → indicators.tradeExposure
 *   PV.EST               → indicators.regimeStability
 *   NY.GDP.MKTP.KD.ZG
 *     + FP.CPI.TOTL.ZG   → indicators.cohesion (blended adjustment, not replacement)
 */

import type { CountryProfile, Tier } from '../types';
import { countryIso2 } from './worldBankClient';
import type { LiveData } from './worldBankClient';

type TierThresholds = [lowMax: number, highMin: number];

/** Map a continuous value to low/medium/high using inclusive thresholds. */
const toTier = (value: number | null | undefined, [lowMax, highMin]: TierThresholds): Tier | null => {
  if (value == null) return null;
  if (value <= lowMax) return 'low';
  if (value >= highMin) return 'high';
  return 'medium';
};

/**
 * Military expenditure as % of GDP → militaryTreatyLevel.
 * low <1.2 %   · medium 1.2–3 %   · high ≥3 %
 */
const toMilitaryTier = (v: number | null | undefined): Tier | null => toTier(v, [1.2, 3.0]);

/**
 * Trade (imports + exports) as % of GDP → tradeExposure.
 * A higher ratio means greater exposure to external trade shocks.
 * low <35 %   · medium 35–80 %   · high ≥80 %
 */
const toTradeTier = (v: number | null | undefined): Tier | null => toTier(v, [35, 80]);

/**
 * World Bank Political Stability (PV.EST, –2.5 to +2.5) → regimeStability.
 * low <–0.5   · medium –0.5–0.5   · high ≥0.5
 */
const toStabilityTier = (v: number | null | undefined): Tier | null => toTier(v, [-0.5, 0.5]);

/**
 * Derive a cohesion point adjustment (approximately –15 to +10) from
 * GDP growth and consumer price inflation.
 *
 * Strong growth adds cohesion; recession and high inflation both subtract.
 * The result is blended into the existing cohesion score rather than
 * replacing it, keeping expert-curated baselines as the anchor.
 */
const toCohesionDelta = (
  gdpGrowth: number | null | undefined,
  inflation: number | null | undefined,
): number => {
  let delta = 0;
  if (gdpGrowth != null) {
    // 5 % growth ≈ +8 pts; –5 % contraction ≈ –8 pts (linear, clamped)
    delta += Math.max(-10, Math.min(8, gdpGrowth * 1.6));
  }
  if (inflation != null) {
    // Below 10 % is broadly tolerable; each point above 10 % costs 0.6 cohesion pts
    const excess = Math.max(0, inflation - 10);
    delta -= Math.min(12, excess * 0.6);
  }
  return delta;
};

/**
 * Enrich an array of country profiles with live World Bank data.
 *
 * Countries without ISO mappings or without any live data are returned
 * unchanged. Enrichment is non-destructive: the original profiles array
 * and its objects are never mutated.
 */
export const enrichProfiles = (
  profiles: CountryProfile[],
  live: LiveData,
): CountryProfile[] =>
  profiles.map((profile) => {
    const iso = countryIso2[profile.id];
    if (!iso) return profile;

    const milTier   = toMilitaryTier(live.militaryExpPct[iso]);
    const tradeTier = toTradeTier(live.tradePct[iso]);
    const stabTier  = toStabilityTier(live.politicalStability[iso]);
    const cohAdj    = toCohesionDelta(live.gdpGrowth[iso], live.inflation[iso]);

    // Skip entirely if WB returned nothing useful for this country.
    if (milTier === null && tradeTier === null && stabTier === null && cohAdj === 0) {
      return profile;
    }

    return {
      ...profile,
      indicators: {
        ...profile.indicators,
        ...(milTier   !== null ? { militaryTreatyLevel: milTier }   : {}),
        ...(tradeTier !== null ? { tradeExposure: tradeTier }        : {}),
        ...(stabTier  !== null ? { regimeStability: stabTier }       : {}),
        cohesion: Math.round(Math.min(100, Math.max(0, profile.indicators.cohesion + cohAdj))),
      },
    };
  });
