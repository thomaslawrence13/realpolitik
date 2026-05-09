import type { CountryProfile, Tier } from '../../types';
import type { LiveData } from '../worldBankClient';
import { countryIso2 } from '../worldBankClient';
import type { IndicatorObservation } from './types';
import { toCohesionValue, toMilitaryTier, toStabilityTier, toTradeTier } from './transformers';

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

    const gdpGrowth = live.gdpGrowth[iso];
    const inflation = live.inflation[iso];
    if (gdpGrowth != null || inflation != null) {
      observations.push({
        providerId: 'world-bank-live',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'cohesion',
        value: toCohesionValue(profile.indicators.cohesion, gdpGrowth, inflation),
        observedAt,
        method: 'api',
        confidence: 0.7,
      });
    }
  }

  return observations;
};

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
        method: 'snapshot' as const,
        confidence: 0.68,
      },
      {
        providerId: 'conflict-snapshot',
        sourceId,
        countryId: profile.id,
        indicator: 'conflictHistory' as const,
        value: profile.indicators.conflictHistory,
        observedAt: profile.lastUpdated,
        method: 'snapshot' as const,
        confidence: 0.66,
      },
    ];
  });
};

export const buildSanctionsSnapshotObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  return profiles.map((profile) => ({
    providerId: 'sanctions-snapshot',
    sourceId: pickSource(profile, ['csis-sanctions', 'imf-direction-of-trade'], 'csis-sanctions'),
    countryId: profile.id,
    indicator: 'sanctionsExposure' as const,
    value: profile.indicators.sanctionsExposure,
    observedAt: profile.lastUpdated,
    method: 'snapshot' as const,
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
    method: 'snapshot' as const,
    confidence: 0.64,
  }));
};

export const buildGovernanceCrossCheckObservations = (profiles: CountryProfile[]): IndicatorObservation[] => {
  return profiles.map((profile) => ({
    providerId: 'governance-cross-check',
    sourceId: pickSource(profile, ['freedom-house', 'vdem'], 'freedom-house'),
    countryId: profile.id,
    indicator: 'regimeStability' as const,
    value: regimeTypeToTier[profile.regimeType],
    observedAt: profile.lastUpdated,
    method: 'derived' as const,
    confidence: 0.48,
  }));
};
