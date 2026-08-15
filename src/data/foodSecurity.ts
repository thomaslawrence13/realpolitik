/**
 * Lazy entry point for FAOSTAT food security values.
 *
 * This module is the *only* importer of the full artifact, which is what lets
 * the bundler split it into its own chunk. `FoodSecuritySection` imports this
 * module dynamically when a reader opens a country, so the per-country values
 * never load for someone who only looks at the map — the same arrangement the
 * historical series uses.
 *
 * Nothing else may import this module statically: a single eager import
 * anywhere would pull the payload back into the main chunk and silently undo
 * the split.
 */

import faoArtifact from './datasets/fao_food_security.json';
import type { FaoCountrySummary, FaoFoodSecurityArtifact } from '../lib/faoFoodSecurity';
import { countryIso2 } from '../lib/worldBankFetch';

const artifact = faoArtifact as unknown as FaoFoodSecurityArtifact;

export interface FoodSecurityObservation {
  key: string;
  label: string;
  unit: string;
  value: number;
  /** FAO's own period label — a range means a multi-year average. */
  period: string;
  /** `official` / `estimated` / `imputed`, when FAO published a flag. */
  status: string | null;
}

export interface FoodSecurityView {
  observations: FoodSecurityObservation[];
  sourceTitle: string;
  sourceUrl: string;
  retrievedAt: string;
}

/**
 * Build the display rows for one country, in the artifact's indicator order.
 *
 * Indicators FAO did not publish for the country are absent rather than shown
 * as zero or "n/a": an unreported prevalence is not a low prevalence.
 */
export const foodSecurityForCountry = (countryId: string): FoodSecurityView | null => {
  const iso = countryIso2[countryId];
  if (!iso) return null;
  const summary: FaoCountrySummary | undefined = artifact.perCountry[iso];
  if (!summary) return null;

  const observations: FoodSecurityObservation[] = [];
  for (const indicator of artifact.indicators) {
    const observation = summary[indicator.key];
    if (!observation) continue;
    observations.push({
      key: indicator.key,
      label: indicator.label,
      unit: indicator.unit,
      value: observation.value,
      period: observation.period,
      status: observation.status,
    });
  }

  if (observations.length === 0) return null;
  return {
    observations,
    sourceTitle: artifact.sourceTitle,
    sourceUrl: artifact.sourceUrl,
    retrievedAt: artifact.fetchedAt.slice(0, 10),
  };
};
