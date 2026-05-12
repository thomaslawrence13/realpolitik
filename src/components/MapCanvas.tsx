import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import type {
  Alignment,
  MapFillMode,
  OverlayMode,
  RegimeType,
  RelationshipDimension,
  SimulatedCountry,
} from '../types';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  countries,
  countryCentroids,
  countryPathStrings,
} from '../lib/map';
import { getRiskTier } from '../simulation';
import { IconButton, SvgIcon } from './ui';
import { summarizeCountryTrust, TrustTag } from './provenance';

// Factors used to normalize WheelEvent.deltaY across different deltaMode values
const WHEEL_LINE_PX = 17;  // approximate pixels per "line" scroll unit
const WHEEL_PAGE_PX = 500; // approximate pixels per "page" scroll unit
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.3;
// How much of the map (in SVG viewBox units) must remain on-screen when panning
const PAN_MARGIN = 80;
// Approximate pixel height of the main hover card (used to clamp card position near the bottom edge)
const HOVER_CARD_HEIGHT = 115;
// Country label rendering constants — used when zoom ≥ LABELS_ZOOM_THRESHOLD
const LABELS_ZOOM_THRESHOLD = 2.5;
const LABEL_BASE_FONT_SIZE = 4.5; // SVG units; divided by zoom to stay constant on screen
const LABEL_STROKE_WIDTH = 0.8;   // SVG units; divided by zoom to stay constant on screen

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Capitalise the first letter of a string (used in hover card labels). */
const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

/** Prevent the map from being dragged completely off-screen. */
function clampOffset(offset: { x: number; y: number }, zoom: number) {
  return {
    x: clamp(offset.x, -(MAP_WIDTH * zoom - PAN_MARGIN), MAP_WIDTH - PAN_MARGIN),
    y: clamp(offset.y, -(MAP_HEIGHT * zoom - PAN_MARGIN), MAP_HEIGHT - PAN_MARGIN),
  };
}

const overlayLabel: Record<RelationshipDimension, string> = {
  cooperation: 'Cooperation',
  hostility: 'Hostility',
  dependency: 'Dependency',
  deterrence: 'Deterrence',
};

const overlayColor: Record<RelationshipDimension, string> = {
  cooperation: '#38bdf8',
  hostility: '#fb7185',
  dependency: '#f59e0b',
  deterrence: '#a78bfa',
};

const overlayKeys: RelationshipDimension[] = ['cooperation', 'hostility', 'dependency', 'deterrence'];

const fillModeGroups: ReadonlyArray<{ label: string; options: ReadonlyArray<{ value: MapFillMode; label: string; hint: string }> }> = [
  {
    label: 'Core Alignment',
    options: [
      { value: 'alignment', label: 'Alignment', hint: 'Color by current bloc alignment' },
      { value: 'risk', label: 'Risk', hint: 'Green → red as escalation risk rises' },
      { value: 'confidence', label: 'Confidence', hint: 'Brighter = higher confidence' },
      { value: 'shift', label: 'Shift', hint: 'Highlights countries that diverge from baseline' },
    ],
  },
  {
    label: 'Macroeconomics',
    options: [
      { value: 'gdpPerCapita', label: 'GDP per capita', hint: 'Choropleth by GDP per capita (USD)' },
      { value: 'gdpGrowth', label: 'GDP Growth', hint: 'GDP growth rate — red for contraction, green for fast growth' },
      { value: 'inflation', label: 'Inflation', hint: 'Consumer price inflation — green (low) → red (high)' },
      { value: 'tradeOpenness', label: 'Trade Openness', hint: 'Total trade as % of GDP — economic openness' },
      { value: 'debtVulnerability', label: 'Debt Vulnerability', hint: 'Composite fiscal vulnerability from rating, debt load, and FX cushion' },
      { value: 'sovereignRating', label: 'Sovereign Rating', hint: 'Sovereign credit tier' },
    ],
  },
  {
    label: 'Security & State',
    options: [
      { value: 'nuclearArmed', label: 'Nuclear Armed', hint: 'Highlight nuclear-armed states' },
      { value: 'militaryBurden', label: 'Military % GDP', hint: 'Military expenditure as % of GDP' },
      { value: 'regime', label: 'Regime Type', hint: 'Color by regime type (democracy / hybrid / authoritarian)' },
      { value: 'conflictPressure', label: 'Conflict Pressure', hint: 'Indicator-based conflict pressure (low / medium / high)' },
      { value: 'defensePactDensity', label: 'Defense Pacts', hint: 'Active defense-pact density' },
    ],
  },
  {
    label: 'Demographics & Resources',
    options: [
      { value: 'population', label: 'Population', hint: 'Total population (millions, log-scaled)' },
      { value: 'medianAge', label: 'Median Age', hint: 'Median age — young (green) → aged (indigo)' },
      { value: 'demographicPressure', label: 'Demo Pressure', hint: 'Composite demographic pressure score (youth bulge + aging + migration)' },
      { value: 'energyExports', label: 'Energy Exports', hint: 'Net energy exports — green (exporter) → red (importer)' },
      { value: 'foodImportDependence', label: 'Food Dependency', hint: 'Food import dependence — exporter → importer' },
      { value: 'waterStress', label: 'Water Stress', hint: 'Water stress index — low → extreme' },
      { value: 'criticalMineralIntensity', label: 'Critical Minerals', hint: 'Weighted critical-mineral supply-chain footprint' },
    ],
  },
  {
    label: 'Information & Soft Power',
    options: [
      { value: 'unVotingBlocA', label: 'UN-A Alignment', hint: 'UN voting alignment with bloc A anchor' },
      { value: 'unVotingBlocB', label: 'UN-B Alignment', hint: 'UN voting alignment with bloc B anchor' },
      { value: 'softPower', label: 'Soft Power', hint: 'Soft-power reach score' },
      { value: 'cyberCapability', label: 'Cyber Capability', hint: 'Composite offensive and defensive cyber capability' },
      { value: 'internetFreedom', label: 'Internet Freedom', hint: 'Internet freedom score — controlled → open' },
    ],
  },
];

// Risk gradient: low (green) → medium (amber) → high (red).
const RISK_LOW = '#34d399';
const RISK_MED = '#fbbf24';
const RISK_HIGH = '#f87171';
const NEUTRAL = '#1b2538';

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

const lerpColor = (from: string, to: string, t: number): string => {
  const [fr, fg, fb] = parseHex(from);
  const [tr, tg, tb] = parseHex(to);
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return `rgb(${r}, ${g}, ${b})`;
};

const riskColor = (risk: number): string => {
  const t = Math.max(0, Math.min(1, risk / 100));
  if (t < 0.5) return lerpColor(RISK_LOW, RISK_MED, t * 2);
  return lerpColor(RISK_MED, RISK_HIGH, (t - 0.5) * 2);
};

const confidenceColor = (confidence: number): string => {
  // Darker blue (low) to bright cyan (high).
  const t = Math.max(0, Math.min(1, (confidence - 30) / 60));
  return lerpColor('#1e3a8a', '#67e8f9', t);
};

// GDP per capita: log-scale purple (< $1 K) → amber (~$10 K) → green (>$100 K).
const GDP_POOR = '#581c87';
const GDP_MID  = '#f59e0b';
const GDP_RICH = '#22c55e';
const gdpPerCapitaColor = (gdp: number | undefined): string => {
  if (!gdp) return NEUTRAL;
  // log10 scale: $1 K → 0, $10 K → 0.5, $100 K → 1
  const t = Math.max(0, Math.min(1, (Math.log10(Math.max(1, gdp)) - 3) / 2));
  if (t < 0.5) return lerpColor(GDP_POOR, GDP_MID, t * 2);
  return lerpColor(GDP_MID, GDP_RICH, (t - 0.5) * 2);
};

// Nuclear-armed: vivid yellow (armed) vs deep navy (unarmed).
const NUCLEAR_YES = '#fef08a';
const NUCLEAR_NO  = '#1b2d4a';
const nuclearArmedColor = (armed: boolean | undefined): string => {
  if (armed === undefined) return NEUTRAL;
  return armed ? NUCLEAR_YES : NUCLEAR_NO;
};

// Military burden: sky blue (0 %) → red (≥ 5 % GDP).
const MIL_LOW  = '#0ea5e9';
const MIL_HIGH = '#f87171';
const militaryBurdenColor = (pct: number | undefined): string => {
  if (pct == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, pct / 5));
  return lerpColor(MIL_LOW, MIL_HIGH, t);
};

// Regime type: fixed palette.
const regimeTypeColor: Record<RegimeType, string> = {
  democracy:     '#22d3ee',
  hybrid:        '#f59e0b',
  authoritarian: '#f87171',
};

// GDP growth: diverging — contraction (red) → 0 % (neutral) → fast growth (green).
// Scale saturates symmetrically at ±8 % to keep the gradient comparable across directions.
const GROWTH_NEG  = '#f87171';
const GROWTH_ZERO = '#334155';
const GROWTH_POS  = '#34d399';
const GROWTH_SATURATION_PCT = 8; // ± % at which the gradient is fully saturated
const gdpGrowthColor = (growthPct: number | undefined): string => {
  if (growthPct == null) return NEUTRAL;
  if (growthPct < 0) {
    const t = Math.max(0, Math.min(1, -growthPct / GROWTH_SATURATION_PCT));
    return lerpColor(GROWTH_ZERO, GROWTH_NEG, t);
  }
  const t = Math.max(0, Math.min(1, growthPct / GROWTH_SATURATION_PCT));
  return lerpColor(GROWTH_ZERO, GROWTH_POS, t);
};

/** Format a GDP growth percentage for display (e.g. "+3.1%" or "−1.4%"). */
const formatGrowthPct = (pct: number) => `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;

// Inflation: low (cool green) → moderate (amber) → high (hot red).
const INFL_LOW  = '#34d399';
const INFL_MED  = '#fbbf24';
const INFL_HIGH = '#f87171';
const inflationColor = (inflPct: number | undefined): string => {
  if (inflPct == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, inflPct / 20)); // saturates at 20 %
  if (t < 0.25) return lerpColor(INFL_LOW, INFL_MED, t * 4);
  return lerpColor(INFL_MED, INFL_HIGH, Math.min(1, (t - 0.25) * (1 / 0.75)));
};

// Trade openness: navy (closed) → bright sky-blue (very open, > 150 % GDP).
const TRADE_LOW  = '#1e3a5f';
const TRADE_HIGH = '#38bdf8';
const tradeOpennessColor = (tradePct: number | undefined): string => {
  if (tradePct == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, tradePct / 150));
  return lerpColor(TRADE_LOW, TRADE_HIGH, t);
};

// Conflict pressure tier: three-stop scale.
const CONFLICT_LOW  = '#34d399';
const CONFLICT_MED  = '#fbbf24';
const CONFLICT_HIGH = '#f87171';
const conflictPressureColor: Record<string, string> = {
  low:    CONFLICT_LOW,
  medium: CONFLICT_MED,
  high:   CONFLICT_HIGH,
};

// Population: log-scale charcoal (< 1 M) → cyan (~ 50 M) → magenta (> 1 B).
const POP_LOW = '#0f172a';
const POP_MID = '#22d3ee';
const POP_HIGH = '#e879f9';
const populationColor = (popMillions: number | undefined): string => {
  if (popMillions == null) return NEUTRAL;
  // log10 scale: 1 M → 0, 50 M → 0.5, 1 B → 1
  const t = Math.max(0, Math.min(1, (Math.log10(Math.max(1, popMillions)) - 0) / 3));
  if (t < 0.5) return lerpColor(POP_LOW, POP_MID, t * 2);
  return lerpColor(POP_MID, POP_HIGH, (t - 0.5) * 2);
};

// Median age: green (very young, ≤ 22) → amber (~33) → indigo (very aged, ≥ 48).
const AGE_YOUNG = '#34d399';
const AGE_MID   = '#f59e0b';
const AGE_OLD   = '#6366f1';
const medianAgeColor = (age: number | undefined): string => {
  if (age == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, (age - 22) / 26));
  if (t < 0.5) return lerpColor(AGE_YOUNG, AGE_MID, t * 2);
  return lerpColor(AGE_MID, AGE_OLD, (t - 0.5) * 2);
};

// Energy exports: red (heavy importer) → slate (balanced) → green (heavy exporter).
// Scale uses energyImportDependencePct: positive = importer, negative = exporter.
const ENERGY_IMPORTER = '#f87171';
const ENERGY_BALANCED = '#475569';
const ENERGY_EXPORTER = '#22c55e';
const energyExportsColor = (depPct: number | undefined): string => {
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
const DEMO_LOW  = '#0ea5e9';
const DEMO_HIGH = '#dc2626';
const demographicPressureColor = (profile: SimulatedCountry['profile']): string => {
  const score = demographicPressureScore(profile);
  if (score == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, score / 60));
  return lerpColor(DEMO_LOW, DEMO_HIGH, t);
};

const CYBER_LOW = '#132238';
const CYBER_HIGH = '#38bdf8';
const cyberCapabilityColor = (profile: SimulatedCountry['profile']): string => {
  if (!profile.cyber) return NEUTRAL;
  const tierScore = { low: 20, medium: 55, high: 90 } as const;
  const score = (tierScore[profile.cyber.offensiveTier] * 0.6) + (tierScore[profile.cyber.defensiveTier] * 0.4);
  return lerpColor(CYBER_LOW, CYBER_HIGH, score / 100);
};

const INTERNET_UNFREE = '#991b1b';
const INTERNET_MID = '#f59e0b';
const INTERNET_FREE = '#34d399';
const internetFreedomColor = (score: number | undefined): string => {
  if (score == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, score / 100));
  if (t < 0.5) return lerpColor(INTERNET_UNFREE, INTERNET_MID, t * 2);
  return lerpColor(INTERNET_MID, INTERNET_FREE, (t - 0.5) * 2);
};

const FOOD_EXPORTER = '#22c55e';
const FOOD_BALANCED = '#475569';
const FOOD_IMPORTER = '#f97316';
const foodImportDependenceColor = (dependencePct: number | undefined): string => {
  if (dependencePct == null) return NEUTRAL;
  if (dependencePct > 0) {
    const t = Math.max(0, Math.min(1, dependencePct / 90));
    return lerpColor(FOOD_BALANCED, FOOD_IMPORTER, t);
  }
  const t = Math.max(0, Math.min(1, -dependencePct / 120));
  return lerpColor(FOOD_BALANCED, FOOD_EXPORTER, t);
};

const WATER_LOW = '#38bdf8';
const WATER_MID = '#fbbf24';
const WATER_HIGH = '#ef4444';
const waterStressColor = (index: number | undefined): string => {
  if (index == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, (index - 1) / 4));
  if (t < 0.5) return lerpColor(WATER_LOW, WATER_MID, t * 2);
  return lerpColor(WATER_MID, WATER_HIGH, (t - 0.5) * 2);
};

const DEBT_LOW = '#22c55e';
const DEBT_MID = '#f59e0b';
const DEBT_HIGH = '#ef4444';
const debtVulnerabilityScore = (profile: SimulatedCountry['profile']): number | null => {
  const fiscal = profile.fiscal;
  if (!fiscal) return null;
  const ratingBase = fiscal.sovereignRatingTier === 'investment'
    ? 15
    : fiscal.sovereignRatingTier === 'speculative'
      ? 50
      : 80;
  const debtPressure = clamp((fiscal.externalDebtGdpPct - 50) * 0.4, 0, 25);
  const reserveStress = clamp((6 - fiscal.fxReservesMonthsImports) * 5, 0, 25);
  return Math.round(clamp(ratingBase + debtPressure + reserveStress, 0, 100));
};
const debtVulnerabilityColor = (profile: SimulatedCountry['profile']): string => {
  const score = debtVulnerabilityScore(profile);
  if (score == null) return NEUTRAL;
  const t = Math.max(0, Math.min(1, score / 100));
  if (t < 0.5) return lerpColor(DEBT_LOW, DEBT_MID, t * 2);
  return lerpColor(DEBT_MID, DEBT_HIGH, (t - 0.5) * 2);
};

const sovereignRatingColor: Record<NonNullable<SimulatedCountry['profile']['fiscal']>['sovereignRatingTier'], string> = {
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
  return Math.round(clamp(weightedShare / 2, 0, 100));
};

const MINERAL_LOW = '#1f2937';
const MINERAL_HIGH = '#eab308';
const criticalMineralIntensityColor = (profile: SimulatedCountry['profile']): string => {
  const score = criticalMineralIntensityScore(profile);
  if (score == null) return NEUTRAL;
  return lerpColor(MINERAL_LOW, MINERAL_HIGH, score / 100);
};

const SOFT_LOW = '#1e293b';
const SOFT_HIGH = '#ec4899';
const softPowerColor = (reachScore: number | undefined): string => {
  if (reachScore == null) return NEUTRAL;
  return lerpColor(SOFT_LOW, SOFT_HIGH, Math.max(0, Math.min(1, reachScore / 100)));
};

const PACT_LOW = '#334155';
const PACT_HIGH = '#a78bfa';
const defensePactDensityColor = (count: number | undefined): string => {
  if (count == null) return NEUTRAL;
  return lerpColor(PACT_LOW, PACT_HIGH, Math.max(0, Math.min(1, count / 5)));
};

type FillResolverArgs = {
  simulated: SimulatedCountry;
  baseline?: SimulatedCountry;
  alignmentColor: Record<Alignment, string>;
};

const resolveFill = (mode: MapFillMode, args: FillResolverArgs): string => {
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

// ─── Memoized country paths layer ────────────────────────────────────────────
// Defined outside MapCanvas so React.memo has stable component identity.
// Only re-renders when alignment data, filters, selection, or overlays change —
// NOT on hover or zoom/pan.
type CountryLayersProps = {
  byName: Map<string, SimulatedCountry>;
  baselineByName: Map<string, SimulatedCountry>;
  visibleNames: Set<string>;
  selectedName: string;
  relatedNames: Set<string>;
  overlayMode: OverlayMode;
  fillMode: MapFillMode;
  alignmentColor: Record<Alignment, string>;
  setHoveredName: (name: string | null) => void;
  hoveredNameRef: MutableRefObject<string | null>;
  hoveredIsParamRef: MutableRefObject<boolean>;
};

import type React from 'react';

const CountryLayers = memo(function CountryLayers({
  byName,
  baselineByName,
  visibleNames,
  selectedName,
  relatedNames,
  overlayMode,
  fillMode,
  alignmentColor,
  setHoveredName,
  hoveredNameRef,
  hoveredIsParamRef,
}: CountryLayersProps) {
  return (
    <>
      {countries.map((country) => {
        const name = country.properties.name;
        const simulated = byName.get(name);
        const baseline = baselineByName.get(name);
        const isParameterized = Boolean(simulated);
        const isVisible = isParameterized && visibleNames.has(name);
        const isSelected = selectedName === name;
        const isRelated = relatedNames.has(name);

        const fill = simulated
          ? resolveFill(fillMode, { simulated, baseline, alignmentColor })
          : NEUTRAL;
        const opacity = !isParameterized ? 0.3 : isVisible ? 1 : 0.2;

        let stroke = 'rgba(148,163,184,0.18)';
        let strokeWidth = 0.4;
        if (isRelated && overlayMode !== 'none') { stroke = overlayColor[overlayMode]; strokeWidth = 1.3; }
        if (isSelected) { stroke = '#f8fafc'; strokeWidth = 2; }

        return (
          <path
            key={`${country.id ?? name}-${name}`}
            d={countryPathStrings.get(name) ?? undefined}
            fill={fill}
            fillOpacity={opacity}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
            filter={isSelected ? 'url(#selected-glow)' : undefined}
            className="country-path"
            onPointerEnter={() => {
              hoveredNameRef.current = name;
              hoveredIsParamRef.current = isParameterized;
              setHoveredName(name);
            }}
            onPointerLeave={() => {
              hoveredNameRef.current = null;
              hoveredIsParamRef.current = false;
              setHoveredName(null);
            }}
          />
        );
      })}
    </>
  );
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type OverlayConnection = {
  countryId: string;
  mapName: string;
  displayName: string;
  score: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type Props = {
  byName: Map<string, SimulatedCountry>;
  baselineByName: Map<string, SimulatedCountry>;
  visibleNames: Set<string>;
  selectedName: string;
  onSelect: (name: string) => void;
  overlayMode: OverlayMode;
  onOverlayModeChange: (mode: OverlayMode) => void;
  fillMode: MapFillMode;
  onFillModeChange: (mode: MapFillMode) => void;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
};

const getRelationshipMetric = (
  mode: RelationshipDimension,
  relationship: { cooperation: number; hostility: number; dependency: number; deterrence: number },
) => relationship[mode];

// ─── Component ────────────────────────────────────────────────────────────────
export function MapCanvas({
  byName,
  baselineByName,
  visibleNames,
  selectedName,
  onSelect,
  overlayMode,
  onOverlayModeChange,
  fillMode,
  onFillModeChange,
  alignmentColor,
  alignmentLabel,
}: Props) {
  // Overlay connections derive entirely from byName + selection + overlay mode,
  // so MapCanvas owns the computation. App.tsx no longer needs lib/map at all,
  // which lets the world-atlas TopoJSON ride along with this component's chunk.
  const overlayConnections = useMemo<OverlayConnection[]>(() => {
    if (overlayMode === 'none') return [];
    const sourceCentroid = countryCentroids.get(selectedName);
    if (!sourceCentroid) return [];
    const profile = byName.get(selectedName)?.profile;
    if (!profile) return [];
    const [sourceX, sourceY] = sourceCentroid;
    return profile.relationships
      .map((relationship) => {
        const targetCentroid = countryCentroids.get(relationship.mapName);
        if (!targetCentroid) return null;
        return {
          countryId: relationship.countryId,
          mapName: relationship.mapName,
          displayName: relationship.displayName,
          score: getRelationshipMetric(overlayMode, relationship),
          x1: sourceX,
          y1: sourceY,
          x2: targetCentroid[0],
          y2: targetCentroid[1],
        };
      })
      .filter((connection): connection is OverlayConnection => Boolean(connection))
      .filter((connection) => connection.score >= 40)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);
  }, [byName, overlayMode, selectedName]);

  const relatedNames = useMemo(
    () => new Set(overlayConnections.map((connection) => connection.mapName)),
    [overlayConnections],
  );

  // Memoize once — the centroid map never changes, so converting it outside the
  // JSX here avoids recreating the array on every render when labels are visible.
  const centroidEntries = useMemo(() => Array.from(countryCentroids.entries()), []);
  // ── Internal hover state (kept here so App.tsx never re-renders on hover) ─────
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  // Refs so pointer handlers always see the latest value without stale closures
  const hoveredNameRef = useRef<string | null>(null);
  const hoveredIsParamRef = useRef<boolean>(false);
  // ── Transform state + mirrored ref (avoids stale closures in event handlers) ─
  const [transform, setTransform] = useState({ zoom: 1, offset: { x: 0, y: 0 } });
  const transformRef = useRef(transform);
  // Keep the ref always current; this runs synchronously before effects.
  transformRef.current = transform;

  const applyTransform = useCallback((next: { zoom: number; offset: { x: number; y: number } }) => {
    transformRef.current = next; // update ref immediately so the next event sees fresh values
    setTransform(next);
  }, []);

  // ── Element refs ──────────────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  // ── Drag tracking (refs to avoid stale closures) ──────────────────────────────
  const dragPrevRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  // ── Hover-card position (ref to avoid 60fps re-renders on mouse move) ──────────
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);

  // ── Hover-card DOM refs for imperative positioning ────────────────────────────
  const hoverCardRef = useRef<HTMLDivElement | null>(null);
  const hoverCardMutedRef = useRef<HTMLDivElement | null>(null);

  // ── Non-passive wheel handler for zoom-toward-cursor ──────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const ctm = svg.getScreenCTM();
      if (!ctm) return;

      const { zoom, offset } = transformRef.current;

      // Normalize delta across deltaMode values (pixels / lines / pages)
      let raw = event.deltaY;
      if (event.deltaMode === 1) raw *= WHEEL_LINE_PX;
      if (event.deltaMode === 2) raw *= WHEEL_PAGE_PX;

      // Exponential scaling gives the same relative change regardless of current zoom level
      const nextZoom = clamp(zoom * Math.pow(1.001, -raw), MIN_ZOOM, MAX_ZOOM);
      const ratio = nextZoom / zoom;

      // Convert cursor to SVG viewBox coordinates
      const cursor = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());

      // Zoom toward cursor: keep the world point under the cursor fixed
      const nextOffset = clampOffset(
        {
          x: cursor.x - (cursor.x - offset.x) * ratio,
          y: cursor.y - (cursor.y - offset.y) * ratio,
        },
        nextZoom,
      );

      applyTransform({ zoom: nextZoom, offset: nextOffset });
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [applyTransform]);

  // ── Pointer handlers ──────────────────────────────────────────────────────────
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragPrevRef.current = { x: event.clientX, y: event.clientY };
    didDragRef.current = false;
    // Capture on the SVG so all pointer events route here during the drag
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    // Update hover-card position imperatively — no setState so no React re-render
    const frame = frameRef.current;
    if (frame) {
      const rect = frame.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      hoverPosRef.current = { x, y };
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      const cx = clamp(x + 16, 12, w - 220);
      if (hoverCardRef.current) {
        hoverCardRef.current.style.left = `${cx}px`;
        hoverCardRef.current.style.top = `${clamp(y + 16, 12, h - HOVER_CARD_HEIGHT)}px`;
      }
      if (hoverCardMutedRef.current) {
        hoverCardMutedRef.current.style.left = `${cx}px`;
        hoverCardMutedRef.current.style.top = `${clamp(y + 16, 12, h - 60)}px`;
      }
    }

    const prev = dragPrevRef.current;
    if (!prev) return;

    const svg = svgRef.current;
    if (!svg) return;

    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDragRef.current = true;

    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const { zoom, offset } = transformRef.current;

    // Convert screen delta to SVG viewBox delta (accounts for SVG viewBox scale)
    const dx_svg = dx / ctm.a;
    const dy_svg = dy / ctm.d;

    // Panning: offset = offset + delta (no division by zoom needed)
    const nextOffset = clampOffset({ x: offset.x + dx_svg, y: offset.y + dy_svg }, zoom);
    applyTransform({ zoom, offset: nextOffset });

    dragPrevRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    // If pointer was released without dragging, treat it as a click on the country
    // that was under the pointer at press-down time (pointer capture prevents path
    // onClick from firing, so we handle selection here instead).
    if (!didDragRef.current && hoveredIsParamRef.current && hoveredNameRef.current) {
      onSelect(hoveredNameRef.current);
    }
    dragPrevRef.current = null;
    svgRef.current?.releasePointerCapture(event.pointerId);
  };

  const resetView = () => applyTransform({ zoom: 1, offset: { x: 0, y: 0 } });

  // ── Convenience zoom buttons ──────────────────────────────────────────────────
  const zoomBy = (delta: number) => {
    const { zoom, offset } = transformRef.current;
    // Zoom toward the center of the visible SVG area
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;
    const nextZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);
    const ratio = nextZoom / zoom;
    const nextOffset = clampOffset(
      { x: cx - (cx - offset.x) * ratio, y: cy - (cy - offset.y) * ratio },
      nextZoom,
    );
    applyTransform({ zoom: nextZoom, offset: nextOffset });
  };

  // ── Derived values ────────────────────────────────────────────────────────────
  const { zoom, offset } = transform;
  const hovered = hoveredName ? byName.get(hoveredName) : undefined;
  const hoverPos = hoverPosRef.current;

  // Overlay geometry is drawn in world-space (inside the <g> transform), so
  // we divide sizes by zoom to keep them visually constant regardless of zoom level.
  const invZoom = 1 / zoom;

  return (
    <section className="map" aria-label="World map">
      <div className="map-frame" ref={frameRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="world-map"
          preserveAspectRatio="xMidYMid slice"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            // Moving off the map without dragging: clear state but do NOT select a country.
            dragPrevRef.current = null;
            hoveredNameRef.current = null;
            hoveredIsParamRef.current = false;
            setHoveredName(null);
            hoverPosRef.current = null;
          }}
        >
          <defs>
            {/* Navy ocean — saturated blue at the focus, deepening toward the edges. */}
            <radialGradient id="map-glow" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="1" />
              <stop offset="100%" stopColor="#0a1f4a" stopOpacity="1" />
            </radialGradient>
            <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.05)" strokeWidth="0.5" />
            </pattern>
            {/* stdDeviation divided by zoom → constant visual blur size at any zoom level */}
            <filter id="selected-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation={2.4 * invZoom} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-glow)" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-grid)" />

          <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
            {/* Memoized — only re-renders when data/selection/overlay changes, not on hover or zoom */}
            <CountryLayers
              byName={byName}
              baselineByName={baselineByName}
              visibleNames={visibleNames}
              selectedName={selectedName}
              relatedNames={relatedNames}
              overlayMode={overlayMode}
              fillMode={fillMode}
              alignmentColor={alignmentColor}
              setHoveredName={setHoveredName}
              hoveredNameRef={hoveredNameRef}
              hoveredIsParamRef={hoveredIsParamRef}
            />
            {/* Hover highlight — single path re-render instead of all 240+ paths */}
            {hoveredName && (
              <path
                d={countryPathStrings.get(hoveredName) ?? undefined}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.1}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {overlayMode !== 'none' &&
              overlayConnections.map((connection) => (
                <g key={`overlay-${connection.countryId}-${overlayMode}`} className="relationship-overlay">
                  <line
                    x1={connection.x1}
                    y1={connection.y1}
                    x2={connection.x2}
                    y2={connection.y2}
                    stroke={overlayColor[overlayMode]}
                    strokeWidth={(1 + connection.score / 60) * invZoom}
                    strokeOpacity={0.75}
                    strokeDasharray={overlayMode === 'dependency' ? `${6 * invZoom} ${5 * invZoom}` : undefined}
                  />
                  <circle
                    cx={connection.x2}
                    cy={connection.y2}
                    r={3 * invZoom}
                    fill={overlayColor[overlayMode]}
                  />
                </g>
              ))}

            {/* Country name labels — visible when zoomed in beyond LABELS_ZOOM_THRESHOLD */}
            {zoom >= LABELS_ZOOM_THRESHOLD && centroidEntries.map(([name, [cx, cy]]) => {
              const isParameterized = byName.has(name);
              if (!isParameterized) return null;
              return (
                <text
                  key={`label-${name}`}
                  x={cx}
                  y={cy}
                  fontSize={LABEL_BASE_FONT_SIZE * invZoom}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgba(248,250,252,0.9)"
                  stroke="rgba(5,9,18,0.6)"
                  strokeWidth={LABEL_STROKE_WIDTH * invZoom}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none', fontWeight: 600, letterSpacing: '0.01em' }}
                >
                  {name}
                </text>
              );
            })}
          </g>
        </svg>

        {hovered && hoverPos && (
          <div
            ref={hoverCardRef}
            className="hover-card"
            style={{
              left: clamp(hoverPos.x + 16, 12, (frameRef.current?.clientWidth ?? 800) - 220),
              top: clamp(hoverPos.y + 16, 12, (frameRef.current?.clientHeight ?? 600) - HOVER_CARD_HEIGHT),
            }}
          >
            <div className="hover-card-header">
              <strong>{hovered.profile.displayName}</strong>
              <TrustTag summary={summarizeCountryTrust(hovered.profile)} />
            </div>
            <span className="hover-card-row">
              <span
                className="hover-dot"
                style={{ background: alignmentColor[hovered.alignment] }}
                aria-hidden
              />
              {alignmentLabel[hovered.alignment]}
            </span>
            <span className="hover-card-provenance">{summarizeCountryTrust(hovered.profile).detail}</span>
            <div className="hover-stats">
              <span>
                <em>Risk</em>
                <span data-risk-tier={getRiskTier(hovered.risk)}>{hovered.risk}%</span>
              </span>
              <span>
                <em>Conf</em>
                {hovered.confidence}%
              </span>
              {fillMode === 'gdpPerCapita' && hovered.profile.economicStats?.gdpPerCapitaUsd != null && (
                <span>
                  <em>GDP/cap</em>
                  ${hovered.profile.economicStats.gdpPerCapitaUsd.toLocaleString()}
                </span>
              )}
              {fillMode === 'gdpGrowth' && hovered.profile.economicStats?.gdpGrowthPct != null && (
                <span>
                  <em>Growth</em>
                  {formatGrowthPct(hovered.profile.economicStats.gdpGrowthPct)}
                </span>
              )}
              {fillMode === 'inflation' && hovered.profile.economicStats?.inflationPct != null && (
                <span>
                  <em>Inflation</em>
                  {hovered.profile.economicStats.inflationPct.toFixed(1)}%
                </span>
              )}
              {fillMode === 'tradeOpenness' && hovered.profile.economicStats?.tradeGdpPct != null && (
                <span>
                  <em>Trade/GDP</em>
                  {Math.round(hovered.profile.economicStats.tradeGdpPct)}%
                </span>
              )}
              {fillMode === 'nuclearArmed' && hovered.profile.militaryStats && (
                <span>
                  <em>Nuclear</em>
                  {hovered.profile.militaryStats.nuclearArmed ? 'Armed' : 'No'}
                </span>
              )}
              {fillMode === 'militaryBurden' && hovered.profile.militaryStats?.militaryExpGdpPct != null && (
                <span>
                  <em>Mil.%GDP</em>
                  {hovered.profile.militaryStats.militaryExpGdpPct.toFixed(1)}%
                </span>
              )}
              {fillMode === 'regime' && (
                <span>
                  <em>Regime</em>
                  {capitalize(hovered.profile.regimeType)}
                </span>
              )}
              {fillMode === 'conflictPressure' && (
                <span>
                  <em>Conflict</em>
                  {capitalize(hovered.profile.indicators.conflictPressure)}
                </span>
              )}
              {fillMode === 'population' && hovered.profile.demographics?.populationMillions != null && (
                <span>
                  <em>Pop</em>
                  {hovered.profile.demographics.populationMillions >= 1000
                    ? `${(hovered.profile.demographics.populationMillions / 1000).toFixed(2)}B`
                    : `${hovered.profile.demographics.populationMillions.toFixed(0)}M`}
                </span>
              )}
              {fillMode === 'medianAge' && hovered.profile.demographics?.medianAge != null && (
                <span>
                  <em>Median age</em>
                  {hovered.profile.demographics.medianAge.toFixed(1)}y
                </span>
              )}
              {fillMode === 'energyExports' && hovered.profile.energy != null && (
                <span>
                  <em>Energy</em>
                  {hovered.profile.energy.energyImportDependencePct > 0
                    ? `${Math.round(hovered.profile.energy.energyImportDependencePct)}% imports`
                    : `${Math.round(-hovered.profile.energy.energyImportDependencePct)}% exporter`}
                </span>
              )}
              {fillMode === 'demographicPressure' && hovered.profile.demographics != null && (
                <span>
                  <em>Demo pressure</em>
                  {(() => {
                    const score = demographicPressureScore(hovered.profile);
                    return score == null ? '—' : `${score}`;
                  })()}
                </span>
              )}
              {fillMode === 'cyberCapability' && hovered.profile.cyber != null && (
                <span>
                  <em>Cyber</em>
                  {`${capitalize(hovered.profile.cyber.offensiveTier)}/${capitalize(hovered.profile.cyber.defensiveTier)}`}
                </span>
              )}
              {fillMode === 'internetFreedom' && hovered.profile.cyber?.internetFreedomScore != null && (
                <span>
                  <em>Net free</em>
                  {hovered.profile.cyber.internetFreedomScore}/100
                </span>
              )}
              {fillMode === 'foodImportDependence' && hovered.profile.foodWater?.foodImportDependencePct != null && (
                <span>
                  <em>Food</em>
                  {hovered.profile.foodWater.foodImportDependencePct >= 0
                    ? `${Math.round(hovered.profile.foodWater.foodImportDependencePct)}% imports`
                    : `${Math.round(-hovered.profile.foodWater.foodImportDependencePct)}% exporter`}
                </span>
              )}
              {fillMode === 'waterStress' && hovered.profile.foodWater?.waterStressIndex != null && (
                <span>
                  <em>Water</em>
                  {hovered.profile.foodWater.waterStressIndex}/5
                </span>
              )}
              {fillMode === 'debtVulnerability' && hovered.profile.fiscal != null && (
                <span>
                  <em>Debt</em>
                  {(() => {
                    const score = debtVulnerabilityScore(hovered.profile);
                    return score == null ? '—' : `${score}/100`;
                  })()}
                </span>
              )}
              {fillMode === 'sovereignRating' && hovered.profile.fiscal != null && (
                <span>
                  <em>Rating</em>
                  {capitalize(hovered.profile.fiscal.sovereignRatingTier)}
                </span>
              )}
              {fillMode === 'unVotingBlocA' && hovered.profile.diplomatic?.unVotingAlignmentBlocA != null && (
                <span>
                  <em>UN-A</em>
                  {hovered.profile.diplomatic.unVotingAlignmentBlocA}%
                </span>
              )}
              {fillMode === 'unVotingBlocB' && hovered.profile.diplomatic?.unVotingAlignmentBlocB != null && (
                <span>
                  <em>UN-B</em>
                  {hovered.profile.diplomatic.unVotingAlignmentBlocB}%
                </span>
              )}
              {fillMode === 'criticalMineralIntensity' && hovered.profile.criticalMinerals != null && (
                <span>
                  <em>Minerals</em>
                  {(() => {
                    const score = criticalMineralIntensityScore(hovered.profile);
                    return score == null ? '—' : `${score}/100`;
                  })()}
                </span>
              )}
              {fillMode === 'softPower' && hovered.profile.softPower?.reachScore != null && (
                <span>
                  <em>Soft</em>
                  {hovered.profile.softPower.reachScore}/100
                </span>
              )}
              {fillMode === 'defensePactDensity' && hovered.profile.diplomatic != null && (
                <span>
                  <em>Pacts</em>
                  {hovered.profile.diplomatic.defensePacts.length}
                </span>
              )}
            </div>
          </div>
        )}

        {hoveredName && !hovered && hoverPos && (
          <div
            ref={hoverCardMutedRef}
            className="hover-card hover-card-muted"
            style={{
              left: clamp(hoverPos.x + 16, 12, (frameRef.current?.clientWidth ?? 800) - 220),
              top: clamp(hoverPos.y + 16, 12, (frameRef.current?.clientHeight ?? 600) - 60),
            }}
          >
            <strong>{hoveredName}</strong>
            <span>Not yet parameterized</span>
          </div>
        )}

        <div className="map-legend">
          {fillMode === 'alignment' &&
            (Object.keys(alignmentLabel) as Alignment[]).map((key) => (
              <span key={key} className="legend-chip">
                <i style={{ background: alignmentColor[key] }} aria-hidden />
                {alignmentLabel[key]}
              </span>
            ))}
          {fillMode === 'risk' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${RISK_LOW}, ${RISK_MED}, ${RISK_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>Low</span><span>Medium</span><span>High</span>
              </span>
            </span>
          )}
          {fillMode === 'confidence' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, #1e3a8a, #67e8f9)` }} />
              <span className="legend-gradient-labels">
                <span>Low</span><span>High</span>
              </span>
            </span>
          )}
          {fillMode === 'shift' && (
            <>
              <span className="legend-chip">
                <i style={{ background: NEUTRAL }} aria-hidden />
                Tracks baseline
              </span>
              <span className="legend-chip">
                <i style={{ background: RISK_LOW }} aria-hidden />
                Risk down
              </span>
              <span className="legend-chip">
                <i style={{ background: RISK_HIGH }} aria-hidden />
                Risk up
              </span>
              <span className="legend-chip">
                <i style={{ background: '#c77dff' }} aria-hidden />
                Alignment shifted
              </span>
            </>
          )}
          {fillMode === 'gdpPerCapita' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${GDP_POOR}, ${GDP_MID}, ${GDP_RICH})` }} />
              <span className="legend-gradient-labels">
                <span>&lt; $1 K</span><span>~$10 K</span><span>&gt; $100 K</span>
              </span>
            </span>
          )}
          {fillMode === 'gdpGrowth' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${GROWTH_NEG}, ${GROWTH_ZERO}, ${GROWTH_POS})` }} />
              <span className="legend-gradient-labels">
                <span>−8%</span><span>0%</span><span>+8%</span>
              </span>
            </span>
          )}
          {fillMode === 'inflation' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${INFL_LOW}, ${INFL_MED}, ${INFL_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>Low</span><span>~5%</span><span>20%+</span>
              </span>
            </span>
          )}
          {fillMode === 'tradeOpenness' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${TRADE_LOW}, ${TRADE_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>Closed</span><span>Open (150%+ GDP)</span>
              </span>
            </span>
          )}
          {fillMode === 'nuclearArmed' && (
            <>
              <span className="legend-chip">
                <i style={{ background: NUCLEAR_YES }} aria-hidden />
                Nuclear armed
              </span>
              <span className="legend-chip">
                <i style={{ background: NUCLEAR_NO }} aria-hidden />
                Non-nuclear
              </span>
            </>
          )}
          {fillMode === 'militaryBurden' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${MIL_LOW}, ${MIL_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>&lt; 1%</span><span>5%+ GDP</span>
              </span>
            </span>
          )}
          {fillMode === 'regime' && (
            <>
              <span className="legend-chip">
                <i style={{ background: regimeTypeColor.democracy }} aria-hidden />
                Democracy
              </span>
              <span className="legend-chip">
                <i style={{ background: regimeTypeColor.hybrid }} aria-hidden />
                Hybrid
              </span>
              <span className="legend-chip">
                <i style={{ background: regimeTypeColor.authoritarian }} aria-hidden />
                Authoritarian
              </span>
            </>
          )}
          {fillMode === 'conflictPressure' && (
            <>
              <span className="legend-chip">
                <i style={{ background: CONFLICT_LOW }} aria-hidden />
                Low
              </span>
              <span className="legend-chip">
                <i style={{ background: CONFLICT_MED }} aria-hidden />
                Medium
              </span>
              <span className="legend-chip">
                <i style={{ background: CONFLICT_HIGH }} aria-hidden />
                High
              </span>
            </>
          )}
          {fillMode === 'population' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${POP_LOW}, ${POP_MID}, ${POP_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>&lt; 1M</span><span>~50M</span><span>1B+</span>
              </span>
            </span>
          )}
          {fillMode === 'medianAge' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${AGE_YOUNG}, ${AGE_MID}, ${AGE_OLD})` }} />
              <span className="legend-gradient-labels">
                <span>22y</span><span>35y</span><span>48y+</span>
              </span>
            </span>
          )}
          {fillMode === 'energyExports' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${ENERGY_EXPORTER}, ${ENERGY_BALANCED}, ${ENERGY_IMPORTER})` }} />
              <span className="legend-gradient-labels">
                <span>Net exporter</span><span>Balanced</span><span>Heavy importer</span>
              </span>
            </span>
          )}
          {fillMode === 'demographicPressure' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${DEMO_LOW}, ${DEMO_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>Stable</span><span>High pressure</span>
              </span>
            </span>
          )}
          {fillMode === 'cyberCapability' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${CYBER_LOW}, ${CYBER_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>Low</span><span>High</span>
              </span>
            </span>
          )}
          {fillMode === 'internetFreedom' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${INTERNET_UNFREE}, ${INTERNET_MID}, ${INTERNET_FREE})` }} />
              <span className="legend-gradient-labels">
                <span>Restricted</span><span>Mixed</span><span>Open</span>
              </span>
            </span>
          )}
          {fillMode === 'foodImportDependence' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${FOOD_EXPORTER}, ${FOOD_BALANCED}, ${FOOD_IMPORTER})` }} />
              <span className="legend-gradient-labels">
                <span>Exporter</span><span>Balanced</span><span>Importer</span>
              </span>
            </span>
          )}
          {fillMode === 'waterStress' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${WATER_LOW}, ${WATER_MID}, ${WATER_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>1</span><span>3</span><span>5</span>
              </span>
            </span>
          )}
          {fillMode === 'debtVulnerability' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${DEBT_LOW}, ${DEBT_MID}, ${DEBT_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>Resilient</span><span>Stretched</span><span>Fragile</span>
              </span>
            </span>
          )}
          {fillMode === 'sovereignRating' && (
            <>
              <span className="legend-chip">
                <i style={{ background: sovereignRatingColor.investment }} aria-hidden />
                Investment
              </span>
              <span className="legend-chip">
                <i style={{ background: sovereignRatingColor.speculative }} aria-hidden />
                Speculative
              </span>
              <span className="legend-chip">
                <i style={{ background: sovereignRatingColor.distressed }} aria-hidden />
                Distressed
              </span>
            </>
          )}
          {fillMode === 'unVotingBlocA' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${NEUTRAL}, ${alignmentColor.blocA})` }} />
              <span className="legend-gradient-labels">
                <span>Low alignment</span><span>Bloc A aligned</span>
              </span>
            </span>
          )}
          {fillMode === 'unVotingBlocB' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${NEUTRAL}, ${alignmentColor.blocB})` }} />
              <span className="legend-gradient-labels">
                <span>Low alignment</span><span>Bloc B aligned</span>
              </span>
            </span>
          )}
          {fillMode === 'criticalMineralIntensity' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${MINERAL_LOW}, ${MINERAL_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>Low</span><span>High</span>
              </span>
            </span>
          )}
          {fillMode === 'softPower' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${SOFT_LOW}, ${SOFT_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>Low</span><span>High</span>
              </span>
            </span>
          )}
          {fillMode === 'defensePactDensity' && (
            <span className="legend-gradient-bar">
              <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${PACT_LOW}, ${PACT_HIGH})` }} />
              <span className="legend-gradient-labels">
                <span>None</span><span>5+</span>
              </span>
            </span>
          )}
        </div>

        <div className="map-fill-toggle">
          <span className="map-overlay-label">Fill</span>
          <select
            className="filter-select map-overlay-select"
            value={fillMode}
            onChange={(e) => onFillModeChange(e.target.value as MapFillMode)}
            title="Select map fill mode"
          >
            {fillModeGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="map-overlay-toggle">
          <span className="map-overlay-label">Overlay</span>
          <div className="map-overlay-row">
            <button
              type="button"
              className={`overlay-btn ${overlayMode === 'none' ? 'overlay-btn-active' : ''}`}
              onClick={() => onOverlayModeChange('none')}
            >
              None
            </button>
            {overlayKeys.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`overlay-btn ${overlayMode === mode ? 'overlay-btn-active' : ''}`}
                onClick={() => onOverlayModeChange(mode)}
                style={
                  overlayMode === mode
                    ? ({ ['--overlay-accent' as string]: overlayColor[mode] } as React.CSSProperties)
                    : undefined
                }
              >
                <i className="overlay-dot" style={{ background: overlayColor[mode] }} aria-hidden />
                {overlayLabel[mode]}
              </button>
            ))}
          </div>
        </div>

        <div className="map-zoom">
          <IconButton label="Zoom out" onClick={() => zoomBy(-ZOOM_STEP)}>
            <SvgIcon.Minus />
          </IconButton>
          <button
            type="button"
            className="map-zoom-readout"
            onClick={resetView}
            title="Reset view (click to fit world)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
            <SvgIcon.Plus />
          </IconButton>
        </div>
      </div>
    </section>
  );
}
