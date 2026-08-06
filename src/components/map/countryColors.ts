import type { Alignment, MapFillMode, RegimeType, SimulatedCountry } from '../../types';

// Risk gradient: low (green) → medium (amber) → high (red).
export const RISK_LOW = '#34d399';
export const RISK_MED = '#fbbf24';
export const RISK_HIGH = '#f87171';
export const NEUTRAL = '#1b2538';

// Cache hex-string → [r,g,b] decomposition so lerpColor never re-parses the
// same constant color string on every country-fill render call.
const hexCache = new Map<string, [number, number, number]>();

const parseHex = (hex: string): [number, number, number] => {
  let cached = hexCache.get(hex);
  if (!cached) {
    cached = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    hexCache.set(hex, cached);
  }
  return cached;
};

export const lerpColor = (from: string, to: string, t: number): string => {
  const [fr, fg, fb] = parseHex(from);
  const [tr, tg, tb] = parseHex(to);
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return `rgb(${r}, ${g}, ${b})`;
};

export const riskColor = (risk: number): string => {
  const t = Math.max(0, Math.min(1, risk / 100));
  if (t < 0.5) return lerpColor(RISK_LOW, RISK_MED, t * 2);
  return lerpColor(RISK_MED, RISK_HIGH, (t - 0.5) * 2);
};

export const confidenceColor = (confidence: number): string => {
  // Darker blue (low) to bright cyan (high).
  const t = Math.max(0, Math.min(1, (confidence - 30) / 60));
  return lerpColor('#1e3a8a', '#67e8f9', t);
};

// GDP per capita: log-scale purple (< $1 K) → amber (~$10 K) → green (>$100 K).
export const GDP_POOR = '#581c87';
export const GDP_MID  = '#f59e0b';
export const GDP_RICH = '#22c55e';

export const gdpPerCapitaColor = (gdp: number | undefined): string => {
  if (!gdp) return NEUTRAL;
  // log10 scale: $1 K → 0, $10 K → 0.5, $100 K → 1
  const t = Math.max(0, Math.min(1, (Math.log10(Math.max(1, gdp)) - 3) / 2));
  if (t < 0.5) return lerpColor(GDP_POOR, GDP_MID, t * 2);
  return lerpColor(GDP_MID, GDP_RICH, (t - 0.5) * 2);
};

// Nuclear-armed: vivid yellow (armed) vs deep navy (unarmed).
export const NUCLEAR_YES = '#fef08a';
export const NUCLEAR_NO  = '#1b2d4a';

export const nuclearArmedColor = (armed: boolean | undefined): string => {
  if (armed === undefined) return NEUTRAL;
  return armed ? NUCLEAR_YES : NUCLEAR_NO;
};

// Military burden: sky blue (0 %) → red (≥ 5 % GDP).
export const MIL_LOW  = '#0ea5e9';
export const MIL_HIGH = '#f87171';

export const militaryBurdenColor = (pct: number | undefined): string => {
  if (pct == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, pct / 5));
  return lerpColor(MIL_LOW, MIL_HIGH, t);
};

// Regime type: fixed palette.
export const regimeTypeColor: Record<RegimeType, string> = {
  democracy:     '#22d3ee',
  hybrid:        '#f59e0b',
  authoritarian: '#f87171',
};

// GDP growth: diverging — contraction (red) → 0 % (neutral) → fast growth (green).
// Scale saturates symmetrically at ±8 % to keep the gradient comparable across directions.
export const GROWTH_NEG  = '#f87171';
export const GROWTH_ZERO = '#334155';
export const GROWTH_POS  = '#34d399';
export const GROWTH_SATURATION_PCT = 8;

export const gdpGrowthColor = (growthPct: number | undefined): string => {
  if (growthPct == null) return NEUTRAL;
  if (growthPct < 0) {
    const t = Math.max(0, Math.min(1, -growthPct / GROWTH_SATURATION_PCT));
    return lerpColor(GROWTH_ZERO, GROWTH_NEG, t);
  }
  const t = Math.max(0, Math.min(1, growthPct / GROWTH_SATURATION_PCT));
  return lerpColor(GROWTH_ZERO, GROWTH_POS, t);
};

/** Format a GDP growth percentage for display (e.g. "+3.1%" or "−1.4%"). */
export const formatGrowthPct = (pct: number) => `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;

// Inflation: low (cool green) → moderate (amber) → high (hot red).
export const INFL_LOW  = '#34d399';
export const INFL_MED  = '#fbbf24';
export const INFL_HIGH = '#f87171';

export const inflationColor = (inflPct: number | undefined): string => {
  if (inflPct == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, inflPct / 20)); // saturates at 20 %
  if (t < 0.25) return lerpColor(INFL_LOW, INFL_MED, t * 4);
  return lerpColor(INFL_MED, INFL_HIGH, Math.min(1, (t - 0.25) * (1 / 0.75)));
};

// Trade openness: navy (closed) → bright sky-blue (very open, > 150 % GDP).
export const TRADE_LOW  = '#1e3a5f';
export const TRADE_HIGH = '#38bdf8';

export const tradeOpennessColor = (tradePct: number | undefined): string => {
  if (tradePct == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, tradePct / 150));
  return lerpColor(TRADE_LOW, TRADE_HIGH, t);
};

// Conflict pressure tier: three-stop scale.
export const CONFLICT_LOW  = '#34d399';
export const CONFLICT_MED  = '#fbbf24';
export const CONFLICT_HIGH = '#f87171';

export const conflictPressureColor: Record<string, string> = {
  low:    CONFLICT_LOW,
  medium: CONFLICT_MED,
  high:   CONFLICT_HIGH,
};

// Population: log-scale charcoal (< 1 M) → cyan (~ 50 M) → magenta (> 1 B).
export const POP_LOW = '#0f172a';
export const POP_MID = '#22d3ee';
export const POP_HIGH = '#e879f9';

export const populationColor = (popMillions: number | undefined): string => {
  if (popMillions == null) return NEUTRAL;
  // log10 scale: 1 M → 0, 50 M → 0.5, 1 B → 1
  const t = Math.max(0, Math.min(1, (Math.log10(Math.max(1, popMillions)) - 0) / 3));
  if (t < 0.5) return lerpColor(POP_LOW, POP_MID, t * 2);
  return lerpColor(POP_MID, POP_HIGH, (t - 0.5) * 2);
};

// Median age: green (very young, ≤ 22) → amber (~33) → indigo (very aged, ≥ 48).
export const AGE_YOUNG = '#34d399';
export const AGE_MID   = '#f59e0b';
export const AGE_OLD   = '#6366f1';

export const medianAgeColor = (age: number | undefined): string => {
  if (age == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, (age - 22) / 26));
  if (t < 0.5) return lerpColor(AGE_YOUNG, AGE_MID, t * 2);
  return lerpColor(AGE_MID, AGE_OLD, (t - 0.5) * 2);
};

// Energy exports: red (heavy importer) → slate (balanced) → green (heavy exporter).
// Scale uses energyImportDependencePct: positive = importer, negative = exporter.
export const ENERGY_IMPORTER = '#f87171';
export const ENERGY_BALANCED = '#475569';
export const ENERGY_EXPORTER = '#22c55e';

export const energyExportsColor = (depPct: number | undefined): string => {
  if (depPct == null) return NEUTRAL;
  if (depPct > 0) {
    const t = Math.max(0, Math.min(1, depPct / 90));
    return lerpColor(ENERGY_BALANCED, ENERGY_IMPORTER, t);
  }
  const t = Math.max(0, Math.min(1, -depPct / 200));
  return lerpColor(ENERGY_BALANCED, ENERGY_EXPORTER, t);
};

// Demographic pressure score, derived from youth share, aging, and net migration.
// Higher score = more pressure on stability and labour-market absorption.
const demographicPressureScore = (profile: SimulatedCountry['profile']): number | null => {
  const demo = profile.demographics;
  if (!demo) return null;
  let score = 0;
  if (demo.youthSharePct > 25) score += (demo.youthSharePct - 25) * 4;
  if (demo.medianAge > 45) score += (demo.medianAge - 45) * 3;
  if (demo.netMigrationPer1000 != null && demo.netMigrationPer1000 < -3) {
    score += Math.abs(demo.netMigrationPer1000 + 3) * 5;
  }
  return Math.min(100, Math.round(score));
};

export const DEMO_LOW  = '#0ea5e9';
export const DEMO_HIGH = '#dc2626';

export const demographicPressureColor = (profile: SimulatedCountry['profile']): string => {
  const score = demographicPressureScore(profile);
  if (score == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, score / 60));
  return lerpColor(DEMO_LOW, DEMO_HIGH, t);
};

export const CYBER_LOW = '#132238';
export const CYBER_HIGH = '#38bdf8';

export const cyberCapabilityColor = (profile: SimulatedCountry['profile']): string => {
  if (!profile.cyber) return NEUTRAL;
  const tierScore = { low: 20, medium: 55, high: 90 } as const;
  const score = (tierScore[profile.cyber.offensiveTier] * 0.6) + (tierScore[profile.cyber.defensiveTier] * 0.4);
  return lerpColor(CYBER_LOW, CYBER_HIGH, score / 100);
};

export const INTERNET_UNFREE = '#991b1b';
export const INTERNET_MID = '#f59e0b';
export const INTERNET_FREE = '#34d399';

export const internetFreedomColor = (score: number | undefined): string => {
  if (score == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, score / 100));
  if (t < 0.5) return lerpColor(INTERNET_UNFREE, INTERNET_MID, t * 2);
  return lerpColor(INTERNET_MID, INTERNET_FREE, (t - 0.5) * 2);
};

export const FOOD_EXPORTER = '#22c55e';
export const FOOD_BALANCED = '#475569';
export const FOOD_IMPORTER = '#f97316';

export const foodImportDependenceColor = (dependencePct: number | undefined): string => {
  if (dependencePct == null) return NEUTRAL;
  if (dependencePct > 0) {
    const t = Math.max(0, Math.min(1, dependencePct / 90));
    return lerpColor(FOOD_BALANCED, FOOD_IMPORTER, t);
  }
  const t = Math.max(0, Math.min(1, -dependencePct / 120));
  return lerpColor(FOOD_BALANCED, FOOD_EXPORTER, t);
};

export const WATER_LOW = '#38bdf8';
export const WATER_MID = '#fbbf24';
export const WATER_HIGH = '#ef4444';

export const waterStressColor = (index: number | undefined): string => {
  if (index == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, (index - 1) / 4));
  if (t < 0.5) return lerpColor(WATER_LOW, WATER_MID, t * 2);
  return lerpColor(WATER_MID, WATER_HIGH, (t - 0.5) * 2);
};

export const DEBT_LOW = '#22c55e';
export const DEBT_MID = '#f59e0b';
export const DEBT_HIGH = '#ef4444';

const debtVulnerabilityScore = (profile: SimulatedCountry['profile']): number | null => {
  const fiscal = profile.fiscal;
  if (!fiscal) return null;
  const ratingBase = fiscal.sovereignRatingTier === 'investment'
    ? 15
    : fiscal.sovereignRatingTier === 'speculative'
      ? 50
      : 80;
  const debtPressure = Math.min(25, Math.max(0, (fiscal.externalDebtGdpPct - 50) * 0.4));
  const reserveStress = Math.min(25, Math.max(0, (6 - fiscal.fxReservesMonthsImports) * 5));
  return Math.round(Math.min(100, Math.max(0, ratingBase + debtPressure + reserveStress)));
};

export const debtVulnerabilityColor = (profile: SimulatedCountry['profile']): string => {
  const score = debtVulnerabilityScore(profile);
  if (score == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, score / 100));
  if (t < 0.5) return lerpColor(DEBT_LOW, DEBT_MID, t * 2);
  return lerpColor(DEBT_MID, DEBT_HIGH, (t - 0.5) * 2);
};

export const sovereignRatingColor: Record<NonNullable<SimulatedCountry['profile']['fiscal']>['sovereignRatingTier'], string> = {
  investment: '#22c55e',
  speculative: '#f59e0b',
  distressed: '#ef4444',
};

const criticalMineralIntensityScore = (profile: SimulatedCountry['profile']): number | null => {
  const entries = profile.criticalMinerals;
  if (!entries || entries.length === 0) return null;
  const roleWeight = {
    producer: 1,
    processor: 1.2,
    reserves: 0.8,
    consumer: 0.4,
  } as const;
  const weightedShare = entries.reduce((sum, entry) => {
    return sum + (entry.globalSharePct ?? 8) * roleWeight[entry.role];
  }, 0);
  return Math.round(Math.min(100, Math.max(0, weightedShare / 2)));
};

export const MINERAL_LOW = '#1f2937';
export const MINERAL_HIGH = '#eab308';

export const criticalMineralIntensityColor = (profile: SimulatedCountry['profile']): string => {
  const score = criticalMineralIntensityScore(profile);
  if (score == null) return NEUTRAL;
  return lerpColor(MINERAL_LOW, MINERAL_HIGH, score / 100);
};

export const SOFT_LOW = '#1e293b';
export const SOFT_HIGH = '#ec4899';

export const softPowerColor = (reachScore: number | undefined): string => {
  if (reachScore == null) return NEUTRAL;
  return lerpColor(SOFT_LOW, SOFT_HIGH, Math.max(0, Math.min(1, reachScore / 100)));
};

export const PACT_LOW = '#334155';
export const PACT_HIGH = '#a78bfa';

export const defensePactDensityColor = (count: number | undefined): string => {
  if (count == null) return NEUTRAL;
  return lerpColor(PACT_LOW, PACT_HIGH, Math.max(0, Math.min(1, count / 5)));
};

type FillResolverArgs = {
  simulated: SimulatedCountry;
  baseline?: SimulatedCountry;
  alignmentColor: Record<Alignment, string>;
};

export const resolveFill = (mode: MapFillMode, args: FillResolverArgs): string => {
  const { simulated, baseline, alignmentColor } = args;
  if (mode === 'alignment') return alignmentColor[simulated.alignment];
  if (mode === 'risk') return riskColor(simulated.risk);
  if (mode === 'confidence') return confidenceColor(simulated.confidence);
  if (mode === 'gdpPerCapita') return gdpPerCapitaColor(simulated.profile.economicStats?.gdpPerCapitaUsd);
  if (mode === 'gdpGrowth') return gdpGrowthColor(simulated.profile.economicStats?.gdpGrowthPct);
  if (mode === 'inflation') return inflationColor(simulated.profile.economicStats?.inflationPct);
  if (mode === 'tradeOpenness') return tradeOpennessColor(simulated.profile.economicStats?.tradeGdpPct);
  if (mode === 'nuclearArmed') return nuclearArmedColor(simulated.profile.militaryStats?.nuclearArmed);
  if (mode === 'militaryBurden') return militaryBurdenColor(simulated.profile.militaryStats?.militaryExpGdpPct);
  if (mode === 'regime') return regimeTypeColor[simulated.profile.regimeType];
  if (mode === 'conflictPressure')
    return conflictPressureColor[simulated.profile.indicators.conflictPressure] ?? NEUTRAL;
  if (mode === 'population') return populationColor(simulated.profile.demographics?.populationMillions);
  if (mode === 'medianAge') return medianAgeColor(simulated.profile.demographics?.medianAge);
  if (mode === 'energyExports') return energyExportsColor(simulated.profile.energy?.energyImportDependencePct);
  if (mode === 'demographicPressure') return demographicPressureColor(simulated.profile);
  if (mode === 'cyberCapability') return cyberCapabilityColor(simulated.profile);
  if (mode === 'internetFreedom') return internetFreedomColor(simulated.profile.cyber?.internetFreedomScore);
  if (mode === 'foodImportDependence') return foodImportDependenceColor(simulated.profile.foodWater?.foodImportDependencePct);
  if (mode === 'waterStress') return waterStressColor(simulated.profile.foodWater?.waterStressIndex);
  if (mode === 'debtVulnerability') return debtVulnerabilityColor(simulated.profile);
  if (mode === 'sovereignRating') {
    const rating = simulated.profile.fiscal?.sovereignRatingTier;
    return rating ? sovereignRatingColor[rating] : NEUTRAL;
  }
  if (mode === 'unVotingBlocA') {
    const score = simulated.profile.diplomatic?.unVotingAlignmentBlocA;
    return score == null ? NEUTRAL : lerpColor(NEUTRAL, alignmentColor.blocA, Math.max(0, Math.min(1, score / 100)));
  }
  if (mode === 'unVotingBlocB') {
    const score = simulated.profile.diplomatic?.unVotingAlignmentBlocB;
    return score == null ? NEUTRAL : lerpColor(NEUTRAL, alignmentColor.blocB, Math.max(0, Math.min(1, score / 100)));
  }
  if (mode === 'criticalMineralIntensity') return criticalMineralIntensityColor(simulated.profile);
  if (mode === 'softPower') return softPowerColor(simulated.profile.softPower?.reachScore);
  if (mode === 'defensePactDensity') return defensePactDensityColor(simulated.profile.diplomatic?.defensePacts.length);
  // shift: highlight countries whose risk or alignment diverged from baseline.
  if (!baseline) return alignmentColor[simulated.alignment];
  const alignmentChanged = simulated.alignment !== baseline.alignment;
  const riskGap = simulated.risk - baseline.risk;
  if (alignmentChanged) return alignmentColor[simulated.alignment];
  if (Math.abs(riskGap) < 4) return NEUTRAL;
  return riskGap > 0 ? lerpColor(NEUTRAL, RISK_HIGH, Math.min(1, riskGap / 30))
    : lerpColor(NEUTRAL, RISK_LOW, Math.min(1, -riskGap / 30));
};
