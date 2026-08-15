/**
 * What the hover card should say for the currently-selected fill mode.
 *
 * The map colours countries by one variable at a time, but a colour ramp only
 * conveys rank — a reader hovering Nigeria in "Inflation" wants the number, and
 * (because this app takes provenance seriously) who published it and for what
 * year. This module answers both in one place, so adding a fill mode means
 * adding one entry rather than another branch in the hover-card JSX.
 */

import type { CountryProfile, MapFillMode, StatField } from '../../types';
import { describeSource } from '../../data/sourceRegistry';
import { capitalize } from './utils';
import {
  criticalMineralIntensityScore,
  debtVulnerabilityScore,
  demographicPressureScore,
  formatGrowthPct,
} from './countryColors';

export interface FillModeReadout {
  /** Short label for the stat, e.g. "GDP/cap". */
  label: string;
  /** Formatted value, e.g. "$89,991". */
  value: string;
  /**
   * Which profile stat backs this readout, when one does. Present only for
   * externally-sourced numbers — composite scores computed in-app have no
   * single upstream field to cite.
   */
  statField?: StatField;
}

type ReadoutFn = (profile: CountryProfile) => FillModeReadout | null;

const formatPopulation = (millions: number): string =>
  millions >= 1000 ? `${(millions / 1000).toFixed(2)}B` : `${millions.toFixed(0)}M`;

/**
 * Fill modes backed by model output (risk, confidence, shift) are absent here:
 * the hover card always shows risk and confidence, so repeating them would be
 * noise.
 */
const READOUTS: Partial<Record<MapFillMode, ReadoutFn>> = {
  gdpPerCapita: (profile) => {
    const value = profile.economicStats?.gdpPerCapitaUsd;
    return value == null
      ? null
      : { label: 'GDP/cap', value: `$${value.toLocaleString()}`, statField: 'gdpPerCapitaUsd' };
  },
  gdpGrowth: (profile) => {
    const value = profile.economicStats?.gdpGrowthPct;
    return value == null ? null : { label: 'Growth', value: formatGrowthPct(value), statField: 'gdpGrowthPct' };
  },
  inflation: (profile) => {
    const value = profile.economicStats?.inflationPct;
    return value == null ? null : { label: 'Inflation', value: `${value.toFixed(1)}%`, statField: 'inflationPct' };
  },
  tradeOpenness: (profile) => {
    const value = profile.economicStats?.tradeGdpPct;
    return value == null ? null : { label: 'Trade/GDP', value: `${Math.round(value)}%`, statField: 'tradeGdpPct' };
  },
  militaryBurden: (profile) => {
    const value = profile.militaryStats?.militaryExpGdpPct;
    return value == null
      ? null
      : { label: 'Mil.%GDP', value: `${value.toFixed(1)}%`, statField: 'militaryExpGdpPct' };
  },
  nuclearArmed: (profile) => {
    const stats = profile.militaryStats;
    return !stats ? null : { label: 'Nuclear', value: stats.nuclearArmed ? 'Armed' : 'No' };
  },
  regime: (profile) => ({ label: 'Regime', value: capitalize(profile.regimeType) }),
  conflictPressure: (profile) => ({
    label: 'Conflict',
    value: capitalize(profile.indicators.conflictPressure),
  }),
  population: (profile) => {
    const value = profile.demographics?.populationMillions;
    return value == null
      ? null
      : { label: 'Pop', value: formatPopulation(value), statField: 'populationMillions' };
  },
  medianAge: (profile) => {
    const value = profile.demographics?.medianAge;
    return value == null ? null : { label: 'Median age', value: `${value.toFixed(1)}y` };
  },
  energyExports: (profile) => {
    const energy = profile.energy;
    if (!energy) return null;
    const dependence = energy.energyImportDependencePct;
    return {
      label: 'Energy',
      value:
        dependence > 0
          ? `${Math.round(dependence)}% imports`
          : `${Math.round(-dependence)}% exporter`,
    };
  },
  demographicPressure: (profile) => {
    const score = demographicPressureScore(profile);
    return { label: 'Demo pressure', value: score == null ? '—' : `${score}` };
  },
  cyberCapability: (profile) => {
    const cyber = profile.cyber;
    return !cyber
      ? null
      : {
          label: 'Cyber',
          value: `${capitalize(cyber.offensiveTier)}/${capitalize(cyber.defensiveTier)}`,
        };
  },
  internetFreedom: (profile) => {
    const value = profile.cyber?.internetFreedomScore;
    return value == null ? null : { label: 'Net free', value: `${value}/100` };
  },
  foodImportDependence: (profile) => {
    const value = profile.foodWater?.foodImportDependencePct;
    if (value == null) return null;
    return {
      label: 'Food',
      value: value >= 0 ? `${Math.round(value)}% imports` : `${Math.round(-value)}% exporter`,
    };
  },
  waterStress: (profile) => {
    const value = profile.foodWater?.waterStressIndex;
    return value == null ? null : { label: 'Water', value: `${value}/5` };
  },
  debtVulnerability: (profile) => {
    if (!profile.fiscal) return null;
    const score = debtVulnerabilityScore(profile);
    return { label: 'Debt', value: score == null ? '—' : `${score}/100` };
  },
  sovereignRating: (profile) =>
    !profile.fiscal ? null : { label: 'Rating', value: capitalize(profile.fiscal.sovereignRatingTier) },
  unVotingBlocA: (profile) => {
    const value = profile.diplomatic?.unVotingAlignmentBlocA;
    return value == null ? null : { label: 'UN-A', value: `${value}%` };
  },
  unVotingBlocB: (profile) => {
    const value = profile.diplomatic?.unVotingAlignmentBlocB;
    return value == null ? null : { label: 'UN-B', value: `${value}%` };
  },
  criticalMineralIntensity: (profile) => {
    if (!profile.criticalMinerals) return null;
    const score = criticalMineralIntensityScore(profile);
    return { label: 'Minerals', value: score == null ? '—' : `${score}/100` };
  },
  softPower: (profile) => {
    const value = profile.softPower?.reachScore;
    return value == null ? null : { label: 'Soft', value: `${value}/100` };
  },
  defensePactDensity: (profile) =>
    !profile.diplomatic
      ? null
      : { label: 'Pacts', value: `${profile.diplomatic.defensePacts.length}` },
};

export const fillModeReadout = (
  mode: MapFillMode,
  profile: CountryProfile,
): FillModeReadout | null => READOUTS[mode]?.(profile) ?? null;

/**
 * Reader-facing credit for a displayed statistic: "IMF · 2025", or
 * "IMF · 2026 est." when the value is a projection rather than an outturn.
 * Returns null when the field has no recorded provenance, so callers can fall
 * back to the country-level stamp rather than inventing a citation.
 */
export const formatStatProvenance = (
  profile: CountryProfile,
  statField: StatField | undefined,
): string | null => {
  if (!statField) return null;
  const entry = profile.statsProvenance?.[statField];
  if (!entry) return null;
  const publisher = describeSource(entry.sourceId).publisher;
  const period = entry.vintage ? `${entry.vintage}${entry.projection ? ' est.' : ''}` : null;
  return period ? `${publisher} · ${period}` : publisher;
};
