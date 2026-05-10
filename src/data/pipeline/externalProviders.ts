import type { CountryProfile } from '../../types';
import type { IndicatorObservation } from './types';
import { toMilitaryTier, toTradeTier } from './transformers';

export interface IngestedSnapshot {
  version: string;
  timestamp: string;
  world_bank_military_expenditure_pct?: Record<string, number>;
  world_bank_trade_pct?: Record<string, number>;
  world_bank_gdp_growth?: Record<string, number>;
  world_bank_inflation?: Record<string, number>;
}

export const buildIngestedObservations = (
  profiles: CountryProfile[],
  snapshot: IngestedSnapshot,
): IndicatorObservation[] => {
  const observations: IndicatorObservation[] = [];
  const observedAt = snapshot.timestamp.slice(0, 10);
  
  if (!snapshot.world_bank_military_expenditure_pct) return observations;

  for (const profile of profiles) {
    const geo = profile.id;

    const militaryExpPct = snapshot.world_bank_military_expenditure_pct[geo];
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
          method: 'api',
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
          method: 'api',
          confidence: 0.88,
        });
      }
    }
  }

  return observations;
};