import type { CountryProfile, Tier } from '../../types';
import { countryIso2, type LiveData } from '../worldBankClient';
import { observationDateFromYear, WB_INDICATOR_BY_KEY, type WbIndicatorKey } from '../../lib/worldBankFetch';
import type { IndicatorObservation } from './types';
import { toCohesionValue, toMilitaryTier, toRuleOfLawTier, toStabilityTier, toTradeTier } from './transformers';

const pickSource = (profile: CountryProfile, candidates: string[], fallback: string): string => {
  return candidates.find((candidate) => profile.sourceIds.includes(candidate)) ?? fallback;
};

const liveObservationMetadata = (live: LiveData, key: WbIndicatorKey, iso: string) => {
  const metadata = live.indicatorMetadata?.[key];
  const observedAt = observationDateFromYear(metadata?.observedYears[iso]);
  if (!observedAt) return null;
  return { observedAt, retrievedAt: metadata?.retrievedAt ?? undefined };
};

const worldBankSourceId = (key: WbIndicatorKey) =>
  WB_INDICATOR_BY_KEY.get(key)?.provenanceSourceId ?? 'world-bank-wdi';

const regimeTypeToTier: Record<CountryProfile['regimeType'], Tier> = {
  democracy: 'high',
  hybrid: 'medium',
  authoritarian: 'low',
};

export const buildWorldBankObservations = (
  profiles: CountryProfile[],
  live: LiveData,
): IndicatorObservation[] => {
  const observations: IndicatorObservation[] = [];

  for (const profile of profiles) {
    const iso = countryIso2[profile.id];
    if (!iso) continue;

    const military = toMilitaryTier(live.militaryExpPct[iso]);
    const militaryMetadata = liveObservationMetadata(live, 'militaryExpPct', iso);
    if (military !== null && militaryMetadata) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: worldBankSourceId('militaryExpPct'),
        countryId: profile.id,
        indicator: 'militaryTreatyLevel',
        value: military,
        observedAt: militaryMetadata.observedAt,
        retrievedAt: militaryMetadata.retrievedAt,
        method: 'api',
        confidence: 0.86,
      });
    }

    const trade = toTradeTier(live.tradePct[iso]);
    const tradeMetadata = liveObservationMetadata(live, 'tradePct', iso);
    if (trade !== null && tradeMetadata) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: worldBankSourceId('tradePct'),
        countryId: profile.id,
        indicator: 'tradeExposure',
        value: trade,
        observedAt: tradeMetadata.observedAt,
        retrievedAt: tradeMetadata.retrievedAt,
        method: 'api',
        confidence: 0.84,
      });
    }

    const stability = toStabilityTier(live.politicalStability[iso]);
    const stabilityMetadata = liveObservationMetadata(live, 'politicalStability', iso);
    if (stability !== null && stabilityMetadata) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: worldBankSourceId('politicalStability'),
        countryId: profile.id,
        indicator: 'regimeStability',
        value: stability,
        observedAt: stabilityMetadata.observedAt,
        retrievedAt: stabilityMetadata.retrievedAt,
        method: 'api',
        confidence: 0.78,
      });
    }

    const ruleOfLaw = toRuleOfLawTier(live.ruleOfLaw[iso]);
    const ruleOfLawMetadata = liveObservationMetadata(live, 'ruleOfLaw', iso);
    if (ruleOfLaw !== null && ruleOfLawMetadata) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: worldBankSourceId('ruleOfLaw'),
        countryId: profile.id,
        indicator: 'regimeStability',
        value: ruleOfLaw,
        observedAt: ruleOfLawMetadata.observedAt,
        retrievedAt: ruleOfLawMetadata.retrievedAt,
        method: 'api',
        confidence: 0.82,
      });
    }

    const gdpGrowth = live.gdpGrowth[iso];
    const inflation = live.inflation[iso];
    const unemployment = live.unemployment[iso];
    const cohesionMetadata = [
      liveObservationMetadata(live, 'gdpGrowth', iso),
      liveObservationMetadata(live, 'inflation', iso),
      liveObservationMetadata(live, 'unemployment', iso),
    ]
      .filter((metadata): metadata is { observedAt: string; retrievedAt: string | undefined } => Boolean(metadata))
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt))
      .at(-1);
    if ((gdpGrowth != null || inflation != null || unemployment != null) && cohesionMetadata) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: worldBankSourceId('gdpGrowth'),
        countryId: profile.id,
        indicator: 'cohesion',
        value: toCohesionValue(profile.indicators.cohesion, gdpGrowth, inflation, unemployment),
        observedAt: cohesionMetadata.observedAt,
        retrievedAt: cohesionMetadata.retrievedAt,
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
 * `observedAt` carries the country record's real `lastUpdated` stamp (the
 * snapshot reaffirmation date is NOT re-stamped to today). This keeps
 * staleness telemetry honest: an untouched country ages out of its SLA
 * instead of being silently refreshed on every load.
 */
export const buildConflictSnapshotObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  return profiles.flatMap((profile) => {
    const sourceId = pickSource(profile, ['ucdp', 'iiss-military-balance'], 'ucdp');
    return [
      {
        providerId: 'conflict-snapshot',
        sourceId,
        countryId: profile.id,
        indicator: 'conflictPressure' as const,
        value: profile.indicators.conflictPressure,
        observedAt: profile.lastUpdated,
        method: 'expert-curated' as const,
        confidence: 0.68,
      },
      {
        providerId: 'conflict-snapshot',
        sourceId,
        countryId: profile.id,
        indicator: 'conflictHistory' as const,
        value: profile.indicators.conflictHistory,
        observedAt: profile.lastUpdated,
        method: 'expert-curated' as const,
        confidence: 0.66,
      },
    ];
  });
};

/**
 * Convert the fresh UCDP organized-violence artifact attached to profiles into
 * historical model observations. This artifact is the finalized annual
 * country-year release, so it must not masquerade as a current-pressure feed;
 * candidate events can fill that role in a separate adapter. A missing/zero
 * row never overrides the curated posture.
 */
export const buildUcdpConflictObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  const observations: IndicatorObservation[] = [];

  for (const profile of profiles) {
    const conflict = profile.conflict;
    if (!conflict) continue;

    const observedAt = `${conflict.lastYear}-12-31`;
    if (conflict.totalDeathsInWindow > 0) {
      const violenceForms = [conflict.stateBased, conflict.nonState, conflict.oneSided]
        .filter(Boolean).length;
      const value: Tier = conflict.totalDeathsInWindow >= 10_000 || violenceForms === 3
        ? 'high'
        : conflict.totalDeathsInWindow >= 100 || violenceForms >= 2
          ? 'medium'
          : 'low';
      observations.push({
        providerId: 'ucdp-organized-violence',
        sourceId: 'ucdp',
        countryId: profile.id,
        indicator: 'conflictHistory',
        value,
        observedAt,
        retrievedAt: conflict.retrievedAt,
        method: 'snapshot',
        confidence: 0.88,
      });
    }
  }

  return observations;
};

export const buildSanctionsSnapshotObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  return profiles.map((profile) => ({
    providerId: 'sanctions-snapshot',
    sourceId: pickSource(profile, ['csis-sanctions', 'imf-direction-of-trade'], 'csis-sanctions'),
    countryId: profile.id,
    indicator: 'sanctionsExposure' as const,
    value: profile.indicators.sanctionsExposure,
    observedAt: profile.lastUpdated,
    method: 'expert-curated' as const,
    confidence: 0.69,
  }));
};

export const buildTradeDependenceObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  return profiles.map((profile) => ({
    providerId: 'trade-dependence-snapshot',
    sourceId: pickSource(profile, ['imf-direction-of-trade', 'wto-profile', 'world-bank-wdi'], 'imf-direction-of-trade'),
    countryId: profile.id,
    indicator: 'tradeDependence' as const,
    value: profile.indicators.tradeDependence,
    observedAt: profile.lastUpdated,
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
          observedAt: profile.lastUpdated,
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
        observedAt: profile.lastUpdated,
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
          observedAt: profile.lastUpdated,
          method: 'expert-curated',
          confidence: 0.57,
        });
      }
    }
  }

  return observations;
};

export const buildGovernanceCrossCheckObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  return profiles.map((profile) => ({
    providerId: 'governance-cross-check',
    sourceId: pickSource(profile, ['freedom-house', 'vdem'], 'freedom-house'),
    countryId: profile.id,
    indicator: 'regimeStability' as const,
    value: regimeTypeToTier[profile.regimeType],
    observedAt: profile.lastUpdated,
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
      observedAt: profile.lastUpdated,
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
      observedAt: profile.lastUpdated,
      method: 'derived',
      confidence: 0.58,
    });
  }

  return observations;
};
