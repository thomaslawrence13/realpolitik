import type { CountryProfile } from '../../types';
import type { IndicatorObservation } from './types';
import { toCohesionValue, toMilitaryTier, toRuleOfLawTier, toStabilityTier, toTradeTier } from './transformers';

export interface IngestedSnapshot {
  version: string;
  timestamp: string;
  countryCountRequested?: number;
  world_bank_military_expenditure_pct?: Record<string, number>;
  world_bank_trade_pct?: Record<string, number>;
  world_bank_gdp_growth?: Record<string, number>;
  world_bank_inflation?: Record<string, number>;
  world_bank_political_stability?: Record<string, number>;
  world_bank_rule_of_law?: Record<string, number>;
  world_bank_unemployment?: Record<string, number>;
}

export const buildIngestedObservations = (
  profiles: CountryProfile[],
  snapshot: IngestedSnapshot,
): IndicatorObservation[] => {
  const observations: IndicatorObservation[] = [];
  const observedAt = snapshot.timestamp.slice(0, 10);

  for (const profile of profiles) {
    const geo = profile.id;

    const militaryExpPct = snapshot.world_bank_military_expenditure_pct?.[geo];
    if (militaryExpPct !== undefined) {
      const military = toMilitaryTier(militaryExpPct);
      if (military !== null) {
        observations.push({
          providerId: 'wb-military-ingest',
          sourceId: 'world-bank-wdi',
          countryId: profile.id,
          indicator: 'militaryTreatyLevel', // Fallback proxy for treaty level for now
          value: military,
          observedAt,
          method: 'snapshot',
          confidence: 0.90, // High confidence for official data
        });
      }
    }

    const tradePct = snapshot.world_bank_trade_pct?.[geo];
    if (tradePct !== undefined) {
      const trade = toTradeTier(tradePct);
      if (trade !== null) {
        observations.push({
          providerId: 'wb-trade-ingest',
          sourceId: 'world-bank-wdi',
          countryId: profile.id,
          indicator: 'tradeExposure',
          value: trade,
          observedAt,
          method: 'snapshot',
          confidence: 0.88,
        });
      }
    }

    const politicalStability = snapshot.world_bank_political_stability?.[geo];
    const stability = toStabilityTier(politicalStability);
    if (stability !== null) {
      observations.push({
        providerId: 'wb-governance-ingest',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'regimeStability',
        value: stability,
        observedAt,
        method: 'snapshot',
        confidence: 0.8,
      });
    }

    const ruleOfLaw = snapshot.world_bank_rule_of_law?.[geo];
    const ruleOfLawTier = toRuleOfLawTier(ruleOfLaw);
    if (ruleOfLawTier !== null) {
      observations.push({
        providerId: 'wb-governance-ingest',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'regimeStability',
        value: ruleOfLawTier,
        observedAt,
        method: 'snapshot',
        confidence: 0.84,
      });
    }

    const gdpGrowth = snapshot.world_bank_gdp_growth?.[geo];
    const inflation = snapshot.world_bank_inflation?.[geo];
    const unemployment = snapshot.world_bank_unemployment?.[geo];
    if (gdpGrowth != null || inflation != null || unemployment != null) {
      observations.push({
        providerId: 'wb-cohesion-ingest',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'cohesion',
        value: toCohesionValue(profile.indicators.cohesion, gdpGrowth, inflation, unemployment),
        observedAt,
        method: 'snapshot',
        confidence: 0.74,
      });
    }
  }

  return observations;
};