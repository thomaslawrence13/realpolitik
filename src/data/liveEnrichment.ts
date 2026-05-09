/**
 * Live + curated data enrichment layer.
 *
 * Static dataset profiles are treated as the reliable baseline. Runtime providers
 * contribute normalized indicator observations with provenance/confidence metadata.
 * A deterministic reconciliation pass picks the best value per indicator while
 * preserving static fallbacks when observations are missing or stale.
 */

import type { CountryProfile } from '../types';
import type { LiveData } from './worldBankClient';
import { enrichProfilesWithSourcePipeline } from './pipeline';

export const enrichProfiles = (
  profiles: CountryProfile[],
  live: LiveData,
): CountryProfile[] => enrichProfilesWithSourcePipeline(profiles, live);
