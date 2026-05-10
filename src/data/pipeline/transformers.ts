import type { CountryIndicators, Tier } from '../../types';

type TierThresholds = [lowMax: number, highMin: number];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const GDP_GROWTH_MULTIPLIER = 1.6;
const MIN_GDP_DELTA = -10;
const MAX_GDP_DELTA = 8;
const INFLATION_SAFE_BAND = 10;
const INFLATION_PENALTY_RATE = 0.6;
const MAX_INFLATION_PENALTY = 12;
const UNEMPLOYMENT_SAFE_BAND = 5;
const UNEMPLOYMENT_PENALTY_RATE = 0.4;
const MAX_UNEMPLOYMENT_PENALTY = 10;

export const toTier = (value: number | null | undefined, [lowMax, highMin]: TierThresholds): Tier | null => {
  if (value == null) return null;
  if (value <= lowMax) return 'low';
  if (value >= highMin) return 'high';
  return 'medium';
};

export const toMilitaryTier = (value: number | null | undefined): Tier | null => toTier(value, [1.2, 3.0]);

export const toTradeTier = (value: number | null | undefined): Tier | null => toTier(value, [35, 80]);

/** Political Stability WGI score (–2.5 to +2.5) → Tier */
export const toStabilityTier = (value: number | null | undefined): Tier | null => toTier(value, [-0.5, 0.5]);

/** Rule of Law WGI score (–2.5 to +2.5) → Tier for regimeStability. */
export const toRuleOfLawTier = (value: number | null | undefined): Tier | null => toTier(value, [-0.75, 0.75]);

export const toCohesionDelta = (
  gdpGrowth: number | null | undefined,
  inflation: number | null | undefined,
  unemployment?: number | null,
): number => {
  let delta = 0;
  if (gdpGrowth != null) {
    delta += clamp(gdpGrowth * GDP_GROWTH_MULTIPLIER, MIN_GDP_DELTA, MAX_GDP_DELTA);
  }
  if (inflation != null) {
    const excess = Math.max(0, inflation - INFLATION_SAFE_BAND);
    delta -= Math.min(MAX_INFLATION_PENALTY, excess * INFLATION_PENALTY_RATE);
  }
  if (unemployment != null) {
    const excess = Math.max(0, unemployment - UNEMPLOYMENT_SAFE_BAND);
    delta -= Math.min(MAX_UNEMPLOYMENT_PENALTY, excess * UNEMPLOYMENT_PENALTY_RATE);
  }
  return delta;
};

export const toCohesionValue = (
  baseline: CountryIndicators['cohesion'],
  gdpGrowth: number | null | undefined,
  inflation: number | null | undefined,
  unemployment?: number | null,
): CountryIndicators['cohesion'] => {
  return Math.round(clamp(baseline + toCohesionDelta(gdpGrowth, inflation, unemployment), 0, 100));
};

export const isValidIndicatorValue = <K extends keyof CountryIndicators>(
  indicator: K,
  value: CountryIndicators[K],
): boolean => {
  switch (indicator) {
    case 'cohesion':
      return Number.isFinite(value as number) && (value as number) >= 0 && (value as number) <= 100;
    case 'tradeExposure':
    case 'militaryTreatyLevel':
    case 'conflictPressure':
    case 'sanctionsExposure':
    case 'ideology':
    case 'borderDisputes':
    case 'regimeStability':
    case 'conflictHistory':
    case 'tradeDependence':
      return value === 'low' || value === 'medium' || value === 'high';
    default:
      return false;
  }
};
