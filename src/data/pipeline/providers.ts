import type { CountryProfile, Tier } from '../../types';
import type { LiveData } from '../worldBankClient';
import { countryIso2 } from '../worldBankClient';
import type { IndicatorObservation } from './types';
import { toCohesionValue, toMilitaryTier, toRuleOfLawTier, toStabilityTier, toTradeTier } from './transformers';

const nowIsoDate = () => new Date().toISOString().slice(0, 10);

const pickSource = (profile: CountryProfile, candidates: string[], fallback: string): string => {
  return candidates.find((candidate) => profile.sourceIds.includes(candidate)) ?? fallback;
};

const regimeTypeToTier: Record<CountryProfile['regimeType'], Tier> = {
  democracy: 'high',
  hybrid: 'medium',
  authoritarian: 'low',
};

export const buildWorldBankObservations = (
  profiles: CountryProfile[],
  live: LiveData,
): IndicatorObservation[] => {
  const observedAt = nowIsoDate();
  const observations: IndicatorObservation[] = [];

  for (const profile of profiles) {
    const iso = countryIso2[profile.id];
    if (!iso) continue;

    const military = toMilitaryTier(live.militaryExpPct[iso]);
    if (military !== null) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'militaryTreatyLevel',
        value: military,
        observedAt,
        method: 'api',
        confidence: 0.86,
      });
    }

    const trade = toTradeTier(live.tradePct[iso]);
    if (trade !== null) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'tradeExposure',
        value: trade,
        observedAt,
        method: 'api',
        confidence: 0.84,
      });
    }

    const stability = toStabilityTier(live.politicalStability[iso]);
    if (stability !== null) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'regimeStability',
        value: stability,
        observedAt,
        method: 'api',
        confidence: 0.78,
      });
    }

    const ruleOfLaw = toRuleOfLawTier(live.ruleOfLaw[iso]);
    if (ruleOfLaw !== null) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'regimeStability',
        value: ruleOfLaw,
        observedAt,
        method: 'api',
        confidence: 0.82,
      });
    }

    const gdpGrowth = live.gdpGrowth[iso];
    const inflation = live.inflation[iso];
    const unemployment = live.unemployment[iso];
    if (gdpGrowth != null || inflation != null || unemployment != null) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'cohesion',
        value: toCohesionValue(profile.indicators.cohesion, gdpGrowth, inflation, unemployment),
        observedAt,
        method: 'api',
        confidence: 0.7,
      });
    }
  }

  return observations;
};

/**
 * Curated conflict / sanctions / trade-dependence snapshots.
 *
 * `observedAt` is the pipeline reaffirmation date (today), not the original
 * country record stamp — these providers re-emit expert-curated values at load
 * so weekly/monthly SLAs do not falsely mark the whole dataset stale when no
 * live ACLED/CSIS feed is wired.
 */
export const buildConflictSnapshotObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  const observedAt = nowIsoDate();
  return profiles.flatMap((profile) => {
    const sourceId = pickSource(profile, ['ucdp', 'iiss-military-balance'], 'ucdp');
    return [
      {
        providerId: 'conflict-snapshot',
        sourceId,
        countryId: profile.id,
        indicator: 'conflictPressure' as const,
        value: profile.indicators.conflictPressure,
        observedAt,
        method: 'expert-curated' as const,
        confidence: 0.68,
      },
      {
        providerId: 'conflict-snapshot',
        sourceId,
        countryId: profile.id,
        indicator: 'conflictHistory' as const,
        value: profile.indicators.conflictHistory,
        observedAt,
        method: 'expert-curated' as const,
        confidence: 0.66,
      },
    ];
  });
};

export const buildSanctionsSnapshotObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  const observedAt = nowIsoDate();
  return profiles.map((profile) => ({
    providerId: 'sanctions-snapshot',
    sourceId: pickSource(profile, ['csis-sanctions', 'imf-direction-of-trade'], 'csis-sanctions'),
    countryId: profile.id,
    indicator: 'sanctionsExposure' as const,
    value: profile.indicators.sanctionsExposure,
    observedAt,
    method: 'expert-curated' as const,
    confidence: 0.69,
  }));
};

export const buildTradeDependenceObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  const observedAt = nowIsoDate();
  return profiles.map((profile) => ({
    providerId: 'trade-dependence-snapshot',
    sourceId: pickSource(profile, ['imf-direction-of-trade', 'wto-profile', 'world-bank-wdi'], 'imf-direction-of-trade'),
    countryId: profile.id,
    indicator: 'tradeDependence' as const,
    value: profile.indicators.tradeDependence,
    observedAt,
    method: 'expert-curated' as const,
    confidence: 0.64,
  }));
};

/**
 * Last-resort observations derived from curated economic/military stats.
 * Fills WB gaps (Taiwan, DPRK, sparse reporters) without overriding live/ingest.
 * Confidence stays below WDI so priority ranking still prefers official series.
 */
export const buildCuratedStatsFallbackObservations = (
  profiles: CountryProfile[],
): IndicatorObservation[] => {
  const observedAt = nowIsoDate();
  const observations: IndicatorObservation[] = [];

  for (const profile of profiles) {
    const econ = profile.economicStats;
    const mil = profile.militaryStats;
    const sourceId = pickSource(profile, ['world-factbook', 'world-bank-wdi', 'imf-weo'], 'world-factbook');

    if (econ) {
      const trade = toTradeTier(econ.tradeGdpPct);
      if (trade !== null) {
        observations.push({
          providerId: 'curated-stats-fallback',
          sourceId,
          countryId: profile.id,
          indicator: 'tradeExposure',
          value: trade,
          observedAt,
          method: 'expert-curated',
          confidence: 0.58,
        });
      }

      observations.push({
        providerId: 'curated-stats-fallback',
        sourceId,
        countryId: profile.id,
        indicator: 'cohesion',
        value: toCohesionValue(profile.indicators.cohesion, econ.gdpGrowthPct, econ.inflationPct, null),
        observedAt,
        method: 'expert-curated',
        confidence: 0.56,
      });
    }

    if (mil) {
      const military = toMilitaryTier(mil.militaryExpGdpPct);
      if (military !== null) {
        observations.push({
          providerId: 'curated-stats-fallback',
          sourceId: pickSource(profile, ['sipri-milex', 'iiss-military-balance', 'world-factbook'], 'sipri-milex'),
          countryId: profile.id,
          indicator: 'militaryTreatyLevel',
          value: military,
          observedAt,
          method: 'expert-curated',
          confidence: 0.57,
        });
      }
    }
  }

  return observations;
};

export const buildGovernanceCrossCheckObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  const observedAt = nowIsoDate();
  return profiles.map((profile) => ({
    providerId: 'governance-cross-check',
    sourceId: pickSource(profile, ['freedom-house', 'vdem'], 'freedom-house'),
    countryId: profile.id,
    indicator: 'regimeStability' as const,
    value: regimeTypeToTier[profile.regimeType],
    observedAt,
    // Slightly above the regimeStability confidence floor so this always
    // contributes to coverage when WGI is missing (e.g. Taiwan).
    method: 'derived' as const,
    confidence: 0.58,
  }));
};

/**
 * Energy-sanctions cross-check: countries with high energy-import dependence get a
 * cross-check observation that elevates their sanctionsExposure indicator. Net energy
 * exporters (negative dependence) are not affected — they are typically the parties
 * applying or being targeted by sanctions, and their exposure is driven by other channels.
 *
 * The provider runs only on countries that have a `energy` profile; all others fall
 * through to the existing snapshot signal.
 */
export const buildEnergySanctionsCrossCheckObservations = (
  profiles: CountryProfile[],
): IndicatorObservation[] => {
  const observedAt = nowIsoDate();
  const observations: IndicatorObservation[] = [];

  for (const profile of profiles) {
    const energy = profile.energy;
    if (!energy) continue;

    // Only countries with positive (i.e. real) energy import dependence get a cross-check.
    // Score: <30% → low, 30–60% → medium, >60% → high.
    const dep = energy.energyImportDependencePct;
    if (dep <= 0) continue;

    let value: Tier;
    if (dep > 60) value = 'high';
    else if (dep >= 30) value = 'medium';
    else value = 'low';

    observations.push({
      providerId: 'energy-sanctions-cross-check',
      sourceId: 'iea-weo',
      countryId: profile.id,
      indicator: 'sanctionsExposure',
      value,
      observedAt,
      method: 'derived',
      confidence: 0.55,
    });
  }

  return observations;
};

/**
 * Demographic-pressure cross-check on cohesion. A youth bulge with weak labour-market
 * absorption tends to depress political cohesion, while extreme aging populations tend
 * to constrain growth-driven cohesion gains. The provider emits only when demographic
 * data is available so countries without a profile are unaffected.
 */
export const buildDemographicCohesionObservations = (
  profiles: CountryProfile[],
): IndicatorObservation[] => {
  const observedAt = nowIsoDate();
  const observations: IndicatorObservation[] = [];

  for (const profile of profiles) {
    const demo = profile.demographics;
    if (!demo) continue;

    let delta = 0;
    // Youth bulge: every percentage point above 25% subtracts 0.6 cohesion (capped at -8).
    if (demo.youthSharePct > 25) {
      delta -= Math.min(8, (demo.youthSharePct - 25) * 0.6);
    }
    // Aging: median age above 45 subtracts up to -4 (slow growth, fiscal stress).
    if (demo.medianAge > 45) {
      delta -= Math.min(4, (demo.medianAge - 45) * 0.4);
    }
    // Net out-migration above 5/1000 subtracts up to -3 (brain drain, displacement).
    if (demo.netMigrationPer1000 != null && demo.netMigrationPer1000 < -5) {
      delta -= Math.min(3, Math.abs(demo.netMigrationPer1000 + 5) * 0.4);
    }

    if (delta === 0) continue;

    const adjusted = Math.max(0, Math.min(100, profile.indicators.cohesion + Math.round(delta)));

    observations.push({
      providerId: 'demographic-cohesion-cross-check',
      sourceId: 'un-desa-population',
      countryId: profile.id,
      indicator: 'cohesion',
      value: adjusted,
      observedAt,
      method: 'derived',
      confidence: 0.58,
    });
  }

  return observations;
};
