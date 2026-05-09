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
  tradeExposure: { cadence: 'annual', staleAfterDays: 540, minimumConfidence: 0.55, includeInCoverage: true },
  militaryTreatyLevel: { cadence: 'annual', staleAfterDays: 540, minimumConfidence: 0.55, includeInCoverage: true },
  conflictPressure: { cadence: 'weekly', staleAfterDays: 21, minimumConfidence: 0.55, includeInCoverage: true },
  sanctionsExposure: { cadence: 'weekly', staleAfterDays: 21, minimumConfidence: 0.55, includeInCoverage: true },
  ideology: { cadence: 'annual', staleAfterDays: 730, minimumConfidence: 0.4, includeInCoverage: false },
  borderDisputes: { cadence: 'quarterly', staleAfterDays: 180, minimumConfidence: 0.45, includeInCoverage: false },
  regimeStability: { cadence: 'annual', staleAfterDays: 540, minimumConfidence: 0.55, includeInCoverage: true },
  conflictHistory: { cadence: 'monthly', staleAfterDays: 60, minimumConfidence: 0.55, includeInCoverage: true },
  tradeDependence: { cadence: 'annual', staleAfterDays: 540, minimumConfidence: 0.55, includeInCoverage: true },
  cohesion: { cadence: 'monthly', staleAfterDays: 60, minimumConfidence: 0.5, includeInCoverage: true },
};

export const indicatorSourcePriority: Record<IndicatorKey, string[]> = {
  militaryTreatyLevel: ['world-bank-wdi', 'iiss-military-balance', 'sipri-milex'],
  tradeExposure: ['world-bank-wdi', 'imf-direction-of-trade', 'wto-profile'],
  regimeStability: ['world-bank-wdi', 'freedom-house', 'vdem'],
  cohesion: ['world-bank-wdi', 'imf-direction-of-trade'],
  conflictPressure: ['ucdp', 'iiss-military-balance'],
  conflictHistory: ['ucdp', 'iiss-military-balance'],
  sanctionsExposure: ['csis-sanctions', 'imf-direction-of-trade'],
  tradeDependence: ['imf-direction-of-trade', 'wto-profile', 'world-bank-wdi'],
  ideology: ['vdem', 'freedom-house'],
  borderDisputes: ['iiss-military-balance', 'ucdp'],
};

export const relationshipDimensions: RelationshipDimensionKey[] = [
  'cooperation',
  'hostility',
  'dependency',
  'deterrence',
];

export const relationshipDimensionQualityRules: Record<RelationshipDimensionKey, IndicatorQualityRule> = {
  cooperation: { cadence: 'quarterly', staleAfterDays: 180, minimumConfidence: 0.5, includeInCoverage: true },
  hostility: { cadence: 'quarterly', staleAfterDays: 180, minimumConfidence: 0.5, includeInCoverage: true },
  dependency: { cadence: 'annual', staleAfterDays: 540, minimumConfidence: 0.5, includeInCoverage: true },
  deterrence: { cadence: 'annual', staleAfterDays: 540, minimumConfidence: 0.5, includeInCoverage: true },
};

export const relationshipDimensionSourcePriority: Record<RelationshipDimensionKey, string[]> = {
  cooperation: ['iiss-military-balance', 'imf-direction-of-trade', 'ucdp'],
  hostility: ['ucdp', 'iiss-military-balance'],
  dependency: ['imf-direction-of-trade', 'wto-profile', 'world-bank-wdi'],
  deterrence: ['iiss-military-balance', 'sipri-milex'],
};

export const tierToScore = {
  low: 25,
  medium: 55,
  high: 82,
} satisfies Record<Exclude<CountryIndicators[keyof CountryIndicators], number>, number>;
