import type { CountryIndicators, RelationshipDimensionKey } from '../../types';
import type { IndicatorKey, IndicatorQualityRule } from './types';

export const modelIndicatorKeys: IndicatorKey[] = [
  'tradeExposure',
  'militaryTreatyLevel',
  'conflictPressure',
  'sanctionsExposure',
  'ideology',
  'borderDisputes',
  'regimeStability',
  'conflictHistory',
  'tradeDependence',
  'cohesion',
];

export const indicatorQualityRules: Record<IndicatorKey, IndicatorQualityRule> = {
  // WDI/WGI series often publish with a 1–3 year lag — keep SLAs realistic.
  tradeExposure: { cadence: 'annual', staleAfterDays: 1200, minimumConfidence: 0.56, includeInCoverage: true },
  militaryTreatyLevel: { cadence: 'annual', staleAfterDays: 1200, minimumConfidence: 0.56, includeInCoverage: true },
  // Conflict/sanctions are expert-curated in this build (no live ACLED/CSIS wire).
  // SLAs match quarterly reaffirmation rather than true weekly feeds.
  conflictPressure: { cadence: 'quarterly', staleAfterDays: 120, minimumConfidence: 0.56, includeInCoverage: true },
  sanctionsExposure: { cadence: 'quarterly', staleAfterDays: 120, minimumConfidence: 0.56, includeInCoverage: true },
  ideology: { cadence: 'annual', staleAfterDays: 730, minimumConfidence: 0.4, includeInCoverage: false },
  borderDisputes: { cadence: 'quarterly', staleAfterDays: 180, minimumConfidence: 0.45, includeInCoverage: false },
  regimeStability: { cadence: 'annual', staleAfterDays: 1200, minimumConfidence: 0.56, includeInCoverage: true },
  conflictHistory: { cadence: 'quarterly', staleAfterDays: 120, minimumConfidence: 0.56, includeInCoverage: true },
  tradeDependence: { cadence: 'annual', staleAfterDays: 1200, minimumConfidence: 0.56, includeInCoverage: true },
  cohesion: { cadence: 'annual', staleAfterDays: 1200, minimumConfidence: 0.52, includeInCoverage: true },
};

export const indicatorSourcePriority: Record<IndicatorKey, string[]> = {
  militaryTreatyLevel: ['world-bank-wdi', 'iiss-military-balance', 'sipri-milex', 'world-factbook'],
  tradeExposure: ['world-bank-wdi', 'un-comtrade', 'imf-direction-of-trade', 'wto-profile'],
  regimeStability: ['world-bank-wdi', 'transparency-intl', 'freedom-house', 'vdem'],
  cohesion: ['world-bank-wdi', 'imf-direction-of-trade', 'un-comtrade'],
  conflictPressure: ['acled', 'ucdp', 'icg-crisiswatch', 'iiss-military-balance'],
  conflictHistory: ['acled', 'ucdp', 'icg-crisiswatch', 'iiss-military-balance'],
  sanctionsExposure: ['csis-sanctions', 'imf-direction-of-trade'],
  tradeDependence: ['un-comtrade', 'imf-direction-of-trade', 'wto-profile', 'world-bank-wdi'],
  ideology: ['transparency-intl', 'vdem', 'freedom-house'],
  borderDisputes: ['iiss-military-balance', 'ucdp', 'icg-crisiswatch'],
};

export const relationshipDimensions: RelationshipDimensionKey[] = [
  'cooperation',
  'hostility',
  'dependency',
  'deterrence',
];

export const relationshipDimensionQualityRules: Record<RelationshipDimensionKey, IndicatorQualityRule> = {
  cooperation: { cadence: 'quarterly', staleAfterDays: 180, minimumConfidence: 0.52, includeInCoverage: true },
  hostility: { cadence: 'quarterly', staleAfterDays: 180, minimumConfidence: 0.52, includeInCoverage: true },
  dependency: { cadence: 'annual', staleAfterDays: 540, minimumConfidence: 0.52, includeInCoverage: true },
  deterrence: { cadence: 'annual', staleAfterDays: 540, minimumConfidence: 0.52, includeInCoverage: true },
};

export const relationshipDimensionSourcePriority: Record<RelationshipDimensionKey, string[]> = {
  cooperation: ['iiss-military-balance', 'imf-direction-of-trade', 'un-comtrade', 'ucdp'],
  hostility: ['acled', 'ucdp', 'icg-crisiswatch', 'iiss-military-balance'],
  dependency: ['un-comtrade', 'imf-direction-of-trade', 'wto-profile', 'world-bank-wdi'],
  deterrence: ['iiss-military-balance', 'sipri-milex'],
};

export const tierToScore = {
  low: 25,
  medium: 55,
  high: 82,
} satisfies Record<Exclude<CountryIndicators[keyof CountryIndicators], number>, number>;
