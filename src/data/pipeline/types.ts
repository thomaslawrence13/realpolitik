import type { CountryIndicators, RelationshipDimensionKey } from '../../types';

export type IndicatorKey = keyof CountryIndicators;

export type ObservationMethod = 'api' | 'snapshot' | 'expert-curated' | 'derived';

/**
 * Provenance an observation can carry beyond "who said it".
 *
 * `observedAt` answers "when did the pipeline last affirm this value?" — curated
 * providers re-emit at load time so SLA checks stay meaningful. That is a
 * pipeline-internal timestamp and must never be shown as the age of the data.
 * `vintage` is the honest answer to "what period does this number describe?",
 * which is what a reader actually wants to know.
 */
export interface ObservationProvenance {
  /**
   * Reference period of the underlying data — a year (`"2025"`) or an ISO date.
   * Absent when the source does not pin one down.
   */
  vintage?: string;
  /** When the publisher last refreshed the series (not the reference period). */
  seriesUpdatedAt?: string;
  /** True when the value is a forecast or staff estimate, not a reported outturn. */
  projection?: boolean;
}

export interface IndicatorObservation<K extends IndicatorKey = IndicatorKey>
  extends ObservationProvenance {
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
