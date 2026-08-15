import type { CountryIndicators, RelationshipDimensionKey } from '../../types';

export type IndicatorKey = keyof CountryIndicators;

export type ObservationMethod = 'api' | 'snapshot' | 'expert-curated' | 'derived';

export interface IndicatorObservation<K extends IndicatorKey = IndicatorKey> {
  providerId: string;
  sourceId: string;
  countryId: string;
  indicator: K;
  value: CountryIndicators[K];
  observedAt: string;
  retrievedAt?: string;
  method: ObservationMethod;
  confidence: number;
}

export interface RelationshipObservation {
  providerId: string;
  sourceId: string;
  sourceCountryId: string;
  targetCountryId: string;
  dimension: RelationshipDimensionKey;
  value: number;
  observedAt: string;
  method: ObservationMethod;
  confidence: number;
}

export interface IndicatorQualityRule {
  cadence: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  staleAfterDays: number;
  minimumConfidence: number;
  includeInCoverage: boolean;
}
