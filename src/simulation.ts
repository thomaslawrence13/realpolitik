import type {
  Alignment,
  ContributionLine,
  CountryProfile,
  DriverScore,
  EventTemplate,
  ProbabilitySet,
  RelationshipSummary,
  ScenarioInputs,
  ScenarioSnapshot,
  SimulatedCountry,
  SimulationExplanation,
  SimulationOptions,
  SimulationWeightSet,
  Tier,
  WeightSetKey,
} from './types';
import {
  TIER_VALUES,
  DEBT_RISK,
  TIMELINE_START_YEAR,
  RISK_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  SCENARIO_INPUT_BOUNDS,
} from './lib/constants';

const tierValue: Record<Tier, number> = TIER_VALUES;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

const normalizeRegionLabel = (value: string) => value.trim().toLowerCase();

/** Classify risk level into tiers based on thresholds. */
const classifyRisk = (risk: number): Tier => {
  if (risk >= RISK_THRESHOLDS.high) return 'high';
  if (risk >= RISK_THRESHOLDS.medium) return 'medium';
  return 'low';
};

/** Resolve alignment based on probability distribution. Returns 'unstable' when high-risk
 * conditions create meaningful uncertainty between competing alignments. */
const resolveAlignment = (probabilities: ProbabilitySet, risk: number): Alignment => {
  // Avoid sort — only 3 fixed keys, so a linear scan is faster.
  const { blocA, blocB, nonAligned } = probabilities;
  let topLabel: keyof ProbabilitySet;
  let topValue: number;
  let secondValue: number;

  if (blocA >= blocB && blocA >= nonAligned) {
    topLabel = 'blocA'; topValue = blocA; secondValue = Math.max(blocB, nonAligned);
  } else if (blocB >= blocA && blocB >= nonAligned) {
    topLabel = 'blocB'; topValue = blocB; secondValue = Math.max(blocA, nonAligned);
  } else {
    topLabel = 'nonAligned'; topValue = nonAligned; secondValue = Math.max(blocA, blocB);
  }

  if (risk >= CONFIDENCE_THRESHOLDS.unstableRiskFloor && topValue - secondValue < CONFIDENCE_THRESHOLDS.unstableProbabilityMargin) {
    return 'unstable';
  }

  return topLabel;
};

// Cache the base relationship summary per profile object — relationships are static so this
// computation only needs to run once per country regardless of how many simulations are run.
const relationshipSummaryCache = new WeakMap<CountryProfile, RelationshipSummary>();

// Cache full simulation results keyed by profile+timeline+options hash so repeated
// calls with identical inputs return instantly — critical for sparkline/history paths
// that call simulateCountry many times per country.
const simulationCache = new Map<string, SimulatedCountry>();

const simulationCacheKey = (
  profile: CountryProfile,
  timelineIndex: number,
  options?: SimulationOptions,
): string => {
  const inputsHash = `${options?.scenarioInputs?.sanctionShock ?? 0},${options?.scenarioInputs?.treatyShift ?? 0},${options?.scenarioInputs?.electionVolatility ?? 0},${options?.scenarioInputs?.invasionPressure ?? 0},${options?.scenarioInputs?.coupRisk ?? 0}`;
  const eventsHash = (options?.activeEvents ?? []).map((e) => e.id).join(';');
  return `${profile.id}:${timelineIndex}:${inputsHash}:${eventsHash}:${options?.weightSet?.key ?? 'baseline'}:${options?.includeExplanation ?? false}:${options?.includeHistory ?? true}`;
};

const summarizeRelationships = (profile: CountryProfile): RelationshipSummary => {
  const cached = relationshipSummaryCache.get(profile);
  if (cached) return cached;

  let result: RelationshipSummary;
  if (profile.relationships.length === 0) {
    result = { cooperation: 40, hostility: 25, dependency: 35, deterrence: 30, tension: 28 };
  } else {
    let cooperation = 0;
    let hostility = 0;
    let dependency = 0;
    let deterrence = 0;
    let tension = 0;
    for (const rel of profile.relationships) {
      cooperation += rel.cooperation;
      hostility += rel.hostility;
      dependency += rel.dependency;
      deterrence += rel.deterrence;
      tension += rel.tension;
    }
    const n = profile.relationships.length;
    result = {
      cooperation: Math.round(cooperation / n),
      hostility: Math.round(hostility / n),
      dependency: Math.round(dependency / n),
      deterrence: Math.round(deterrence / n),
      tension: Math.round(tension / n),
    };
  }

  relationshipSummaryCache.set(profile, result);
  return result;
};

export const defaultScenarioInputs: ScenarioInputs = {
  sanctionShock: 0,
  treatyShift: 0,
  electionVolatility: 0,
  invasionPressure: 0,
  coupRisk: 0,
};

const scenarioInputKeys = Object.keys(defaultScenarioInputs) as Array<keyof ScenarioInputs>;

/** Clamp scenario input to valid bounds. Treaty shift has asymmetric bounds [-60, 60];
 * other inputs are [0, 100]. */
const clampScenarioInput = (key: keyof ScenarioInputs, value: number): number => {
  if (key === 'treatyShift') {
    const { min, max } = SCENARIO_INPUT_BOUNDS.treaty;
    return Math.min(max, Math.max(min, value));
  }
  const { min, max } = SCENARIO_INPUT_BOUNDS.default;
  return Math.min(max, Math.max(min, value));
};

const createZeroScenarioInputs = (): ScenarioInputs => {
  return { ...defaultScenarioInputs };
};

// Pre-compute sets for O(1) membership checks.
const EASTERN_MED_SUBREGIONS = new Set(['western asia', 'northern africa', 'southern europe']);
const EASTERN_MED_IDS = new Set([
  'israel', 'lebanon', 'syria', 'jordan', 'cyprus', 'greece', 'turkey', 'egypt', 'libya',
]);

const eventAppliesToProfile = (profile: CountryProfile, event: EventTemplate): boolean => {
  if (event.regionTags.length === 0) return true;

  const region = normalizeRegionLabel(profile.region);
  const subregion = normalizeRegionLabel(profile.subregion);

  return event.regionTags.some((tag) => {
    const normalized = normalizeRegionLabel(tag);
    if (normalized === 'global') return true;
    if (normalized === region || normalized === subregion) return true;
    if (normalized === 'eastern mediterranean') {
      return EASTERN_MED_SUBREGIONS.has(subregion) || EASTERN_MED_IDS.has(profile.id);
    }
    return false;
  });
};

/** Filter events that apply to a given country profile based on region tags. */
export const getActiveEventsForProfile = (
  profile: CountryProfile,
  activeEvents: EventTemplate[],
): EventTemplate[] => activeEvents.filter((event) => eventAppliesToProfile(profile, event));

/** Accumulate scenario inputs from matching events and clamp to valid bounds. */
export const getScenarioInputsForProfile = (
  baseInputs: ScenarioInputs,
  activeEvents: EventTemplate[],
  profile: CountryProfile,
): ScenarioInputs => {
  if (activeEvents.length === 0) return baseInputs;

  const matchingEvents = getActiveEventsForProfile(profile, activeEvents);
  if (matchingEvents.length === 0) return baseInputs;

  const delta = createZeroScenarioInputs();

  for (const event of matchingEvents) {
    for (const key of scenarioInputKeys) {
      delta[key] += event.inputs[key] ?? 0;
    }
  }

  const nextInputs = {} as ScenarioInputs;

  for (const key of scenarioInputKeys) {
    nextInputs[key] = clampScenarioInput(key, baseInputs[key] + delta[key]);
  }

  return nextInputs;
};

export const simulationWeightSets: Record<WeightSetKey, SimulationWeightSet> = {
  baseline: {
    key: 'baseline',
    label: 'Baseline weights',
    description: 'Balanced sensitivity across diplomatic, military, and domestic shocks.',
    alliance: 1,
    sanctions: 1,
    elections: 1,
    invasion: 1,
    coup: 1,
    economic: 1,
  },
  hardPower: {
    key: 'hardPower',
    label: 'Hard-power heavy',
    description: 'Emphasizes treaty strength, invasion pressure, and deterrence effects.',
    alliance: 1.3,
    sanctions: 0.9,
    elections: 0.8,
    invasion: 1.35,
    coup: 0.8,
    economic: 0.75,
  },
  economicStress: {
    key: 'economicStress',
    label: 'Economic stress',
    description: 'Emphasizes sanctions, trade dependence, and domestic instability spillover.',
    alliance: 0.8,
    sanctions: 1.35,
    elections: 1.05,
    invasion: 0.9,
    coup: 1.1,
    economic: 1.35,
  },
};

/** Retrieve a named weight set for sensitivity analysis or comparison. */
export const getSimulationWeightSet = (key: WeightSetKey) => simulationWeightSets[key];

const resolveOptions = (options?: SimulationOptions) => ({
  includeHistory: options?.includeHistory ?? true,
  includeExplanation: options?.includeExplanation ?? false,
  scenarioInputs: options?.scenarioInputs ?? defaultScenarioInputs,
  activeEvents: options?.activeEvents ?? [],
  weightSet: options?.weightSet ?? simulationWeightSets.baseline,
});

// Accepts the already-computed alignment/confidence for the current year so offset 0
// does not trigger a redundant full simulation of the same timelineIndex.
const buildHistory = (
  profile: CountryProfile,
  activeIndex: number,
  options: SimulationOptions,
  currentAlignment: Alignment,
  currentConfidence: number,
): ScenarioSnapshot[] => {
  const pastOffsets = [-2, -1].filter((offset) => activeIndex + offset >= 0);

  const past = pastOffsets.map((offset) => {
    const snapshot = simulateCountry(profile, activeIndex + offset, {
      scenarioInputs: options.scenarioInputs,
      activeEvents: options.activeEvents,
      weightSet: options.weightSet,
      includeHistory: false,
    });
    return {
      label: `${TIMELINE_START_YEAR + activeIndex + offset}`,
      alignment: snapshot.alignment,
      confidence: snapshot.confidence,
    };
  });

  // Append current year using already-computed values — no extra simulation needed.
  past.push({
    label: `${TIMELINE_START_YEAR + activeIndex}`,
    alignment: currentAlignment,
    confidence: currentConfidence,
  });
  return past;
};

/** Simulate a country's alignment, risk, and probabilities. Returns alignment classification,
 * confidence score, risk level, and optionally detailed breakdowns of all contributing factors. */
export const simulateCountry = (
  profile: CountryProfile,
  timelineIndex: number,
  options?: SimulationOptions,
): SimulatedCountry => {
  const cacheKey = simulationCacheKey(profile, timelineIndex, options);
  const cached = simulationCache.get(cacheKey);
  if (cached) return cached;

  const { includeHistory, includeExplanation, scenarioInputs, activeEvents, weightSet } = resolveOptions(options);
  const effectiveScenarioInputs = getScenarioInputsForProfile(scenarioInputs, activeEvents, profile);
  const momentum = timelineIndex * 1.8;

  const treatyShock = effectiveScenarioInputs.treatyShift * weightSet.alliance;
  const sanctionsShock = effectiveScenarioInputs.sanctionShock * weightSet.sanctions;
  const electionShock = effectiveScenarioInputs.electionVolatility * weightSet.elections;
  const invasionShock = effectiveScenarioInputs.invasionPressure * weightSet.invasion;
  const coupShock = effectiveScenarioInputs.coupRisk * weightSet.coup;
  const economicShock = (effectiveScenarioInputs.sanctionShock * 0.55 + Math.max(0, -effectiveScenarioInputs.treatyShift) * 0.35) * weightSet.economic;

  // v10 numeric overlays: when EconomicStats / MilitaryStats / EnergyProfile are present,
  // use them as fine-grained modifiers on top of the existing tier-based logic. Profiles
  // without these fields fall through unchanged.
  const econ = profile.economicStats;
  const mil = profile.militaryStats;
  const energy = profile.energy;

  // GDP growth contributes to cohesion (positive = stabilizing, recession = destabilizing).
  // Clamped to ±6 cohesion points to keep tiers as primary driver.
  const gdpCohesionDelta = econ ? clamp((econ.gdpGrowthPct - 2) * 0.9, -6, 6) : 0;
  // Inflation above 8% drains cohesion sharply; below 8% no penalty.
  const inflationCohesionDelta = econ ? -Math.min(8, Math.max(0, econ.inflationPct - 8) * 0.7) : 0;
  // Defence burden % GDP feeds deterrence: >3% → up to +6, <1% → up to -3.
  const militaryBurdenBoost = mil ? clamp((mil.militaryExpGdpPct - 2) * 2.0, -3, 6) : 0;
  // Trade-to-GDP overlays trade dependence: small economies with high trade share are
  // structurally more dependent on external partners.
  const tradeOpennessDelta = econ ? clamp((econ.tradeGdpPct - 50) * 0.12, -6, 8) : 0;
  // Energy import dependence amplifies sanctions exposure beyond the cross-check tier.
  const energySanctionsDelta = energy && energy.energyImportDependencePct > 0
    ? Math.min(10, energy.energyImportDependencePct * 0.08)
    : 0;
  // Nuclear-armed bonus for deterrence component (used in relationship deterrence summary).
  const nuclearDeterrenceBoost = mil?.nuclearArmed ? 6 : 0;

  // v11 numeric overlays. Each is a small bounded modifier so that profiles without
  // these dimensions remain unaffected and tier inputs stay primary.
  const cyber = profile.cyber;
  const fiscal = profile.fiscal;
  const foodWater = profile.foodWater;
  const diplomatic = profile.diplomatic;

  // Cyber: offensive capability adds deterrence; defensive capability blunts sanctions
  // and shock spillover; very low internet freedom signals fragile information posture.
  const cyberOffensiveTierValue = cyber ? tierValue[cyber.offensiveTier] : 0;
  const cyberDefensiveTierValue = cyber ? tierValue[cyber.defensiveTier] : 0;
  const cyberDeterrenceBoost = cyber ? clamp((cyberOffensiveTierValue - 50) * 0.05, -2, 4) : 0;
  const cyberSanctionsDamping = cyber ? clamp((cyberDefensiveTierValue - 50) * 0.04, -2, 3) : 0;
  // Internet-freedom < 30 modestly destabilizes cohesion under shocks (info-control tax).
  const cyberCohesionDelta = cyber && cyber.internetFreedomScore < 30
    ? -clamp((30 - cyber.internetFreedomScore) * 0.06, 0, 3)
    : 0;

  // Fiscal: distressed rating + low FX cushion drag cohesion; investment + adequate
  // cushion stabilizes. External debt above 100% of GDP adds risk weight.
  const fiscalRatingValue = fiscal
    ? fiscal.sovereignRatingTier === 'investment' ? 2
    : fiscal.sovereignRatingTier === 'speculative' ? -2
    : -6
    : 0;
  const fxCushionDelta = fiscal ? clamp((fiscal.fxReservesMonthsImports - 3) * 0.4, -4, 4) : 0;
  const fiscalCohesionDelta = fiscal ? fiscalRatingValue + fxCushionDelta : 0;

  // Food / water: high import dependence + extreme water stress drains cohesion and
  // amplifies sanctions exposure (trade pinch hits a vulnerable population).
  const foodWaterCohesionDelta = foodWater
    ? -clamp(
        Math.max(0, foodWater.foodImportDependencePct) * 0.05
        + Math.max(0, foodWater.waterStressIndex - 3) * 1.5,
        0,
        7,
      )
    : 0;
  const foodWaterSanctionsDelta = foodWater && foodWater.foodImportDependencePct > 30
    ? Math.min(8, (foodWater.foodImportDependencePct - 30) * 0.08)
    : 0;

  // Diplomatic: UN voting alignment with bloc anchors directly tilts probabilities.
  // Bounded ±20 so it complements but does not overwhelm the indicator-driven core.
  const diplomaticBlocABoost = diplomatic
    ? clamp((diplomatic.unVotingAlignmentBlocA - 50) * 0.2, -10, 12)
    : 0;
  const diplomaticBlocBBoost = diplomatic
    ? clamp((diplomatic.unVotingAlignmentBlocB - 50) * 0.2, -10, 12)
    : 0;
  // Defense-pact density: many active pacts → modest deterrence and military boost.
  const defensePactDensity = diplomatic ? Math.min(5, diplomatic.defensePacts.length) : 0;
  const defensePactDeterrenceBoost = defensePactDensity * 1.2;
  const pendingAccessionCount = diplomatic?.pendingAccession?.length ?? 0;
  const accessionDeterrenceBoost = Math.min(3, pendingAccessionCount * 0.8);
  const accessionBlocABoost = diplomatic?.pendingAccession?.includes('NATO') ? 2.5 : 0;

  const tradeExposure = clamp(tierValue[profile.indicators.tradeExposure] + tradeOpennessDelta * 0.5, 0, 100);
  const military = clamp(
    tierValue[profile.indicators.militaryTreatyLevel] + treatyShock * 0.55 + militaryBurdenBoost
    + defensePactDensity * 1.5,
    0,
    100,
  );
  const conflict = clamp(tierValue[profile.indicators.conflictPressure] + invasionShock * 0.8 + coupShock * 0.12, 0, 100);
  const sanctions = clamp(
    tierValue[profile.indicators.sanctionsExposure] + sanctionsShock * 0.72
    + energySanctionsDelta + foodWaterSanctionsDelta - cyberSanctionsDamping,
    0,
    100,
  );
  const ideology = tierValue[profile.indicators.ideology];
  const borderDisputes = clamp(tierValue[profile.indicators.borderDisputes] + invasionShock * 0.45, 0, 100);
  const regimeStability = clamp(tierValue[profile.indicators.regimeStability] - electionShock * 0.55 - coupShock * 0.75, 0, 100);
  const conflictHistory = tierValue[profile.indicators.conflictHistory];
  const tradeDependence = clamp(tierValue[profile.indicators.tradeDependence] + economicShock * 0.28 + tradeOpennessDelta, 0, 100);
  const cohesion = clamp(
    profile.indicators.cohesion - electionShock * 0.35 - coupShock * 0.45 + treatyShock * 0.08
    + gdpCohesionDelta + inflationCohesionDelta
    + cyberCohesionDelta + fiscalCohesionDelta + foodWaterCohesionDelta,
    0,
    100,
  );

  const baseRelationships = summarizeRelationships(profile);
  const relationshipSummary: RelationshipSummary = {
    cooperation: Math.round(clamp(baseRelationships.cooperation + treatyShock * 0.35 - sanctionsShock * 0.12 - invasionShock * 0.25, 0, 100)),
    hostility: Math.round(clamp(baseRelationships.hostility + invasionShock * 0.6 + sanctionsShock * 0.25 - treatyShock * 0.15, 0, 100)),
    dependency: Math.round(clamp(baseRelationships.dependency + sanctionsShock * 0.18 + economicShock * 0.2, 0, 100)),
    deterrence: Math.round(clamp(
      baseRelationships.deterrence + invasionShock * 0.28 + treatyShock * 0.14
      + nuclearDeterrenceBoost + cyberDeterrenceBoost + defensePactDeterrenceBoost + accessionDeterrenceBoost,
      0,
      100,
    )),
    tension: 0,
  };
  relationshipSummary.tension = Math.round((relationshipSummary.hostility + relationshipSummary.deterrence + conflict) / 3);

  const regimeBlocABonus = profile.regimeType === 'democracy' ? 12 : profile.regimeType === 'hybrid' ? 4 : -10;
  const regimeBlocBBonus = profile.regimeType === 'authoritarian' ? 10 : profile.regimeType === 'hybrid' ? 3 : -8;
  const strategicBalance = 100 - Math.abs(relationshipSummary.cooperation - relationshipSummary.hostility);

  // Compute probability raw totals inline (no array allocation). Component arrays are only
  // built when includeExplanation is true (inspector path), saving 3 array constructions
  // on every one of the 400+ simulateCountry calls that the map/movers/sparkline trigger.
  const blocABase = 20;
  const blocARaw = blocABase
    + military * 0.22
    + ideology * 0.12
    + relationshipSummary.cooperation * 0.16
    + relationshipSummary.deterrence * 0.08
    + regimeStability * 0.06
    + regimeBlocABonus
    + momentum * 0.3
    - relationshipSummary.hostility * 0.06
    - sanctions * 0.04
    + diplomaticBlocABoost
    + accessionBlocABoost;

  const blocBBase = 18;
  const blocBRaw = blocBBase
    + sanctions * 0.14
    + relationshipSummary.hostility * 0.16
    + conflictHistory * 0.12
    + borderDisputes * 0.1
    + relationshipSummary.dependency * 0.08
    + regimeBlocBBonus
    + momentum * 0.08
    - regimeStability * 0.04
    + diplomaticBlocBBoost;

  const nonAlignedBase = 18;
  const nonAlignedRaw = nonAlignedBase
    + tradeExposure * 0.08
    + tradeDependence * 0.14
    + cohesion * 0.08
    + strategicBalance * 0.08
    + regimeStability * 0.07
    - military * 0.05
    - relationshipSummary.hostility * 0.04
    - momentum * 0.1;

  const blocAClamped = Math.max(1, blocARaw);
  const blocBClamped = Math.max(1, blocBRaw);
  const nonAlignedClamped = Math.max(1, nonAlignedRaw);
  const probTotal = blocAClamped + blocBClamped + nonAlignedClamped;
  // Round the first two and compute the third as the remainder so the three values
  // always sum to exactly 100, regardless of floating-point rounding.
  let pBlocA = Math.round((blocAClamped / probTotal) * 100);
  let pBlocB = Math.round((blocBClamped / probTotal) * 100);
  let pNonAligned = 100 - pBlocA - pBlocB;
  // Rounding can push the sum over 100, making pNonAligned negative.
  // Clamp to zero and reduce the largest probability to absorb the excess.
  if (pNonAligned < 0) {
    pNonAligned = 0;
    const excess = pBlocA + pBlocB - 100;
    if (pBlocA >= pBlocB) {
      pBlocA -= excess;
    } else {
      pBlocB -= excess;
    }
  }
  const probabilities: ProbabilitySet = { blocA: pBlocA, blocB: pBlocB, nonAligned: pNonAligned };
  const topProbability = Math.max(pBlocA, pBlocB, pNonAligned);
  // For exactly three normalized probabilities (which sum to 100), the
  // second-largest value can be derived as: 100 - largest - smallest.
  const secondProbability = pBlocA + pBlocB + pNonAligned - topProbability
    - Math.min(pBlocA, pBlocB, pNonAligned);
  const margin = topProbability - secondProbability;
  const confidenceBase = 54;
  // Inline sums — component arrays only built when explanation is needed.
  const confidenceTotal = margin + confidenceBase + (-electionShock * 0.05) + (-coupShock * 0.08);
  const confidence = clamp(confidenceTotal, 38, 96);

  const riskBase = profile.baselineRisk;
  const debtRiskContrib = fiscal && fiscal.externalDebtGdpPct > DEBT_RISK.thresholdPct
    ? Math.min(DEBT_RISK.maxContribution, (fiscal.externalDebtGdpPct - DEBT_RISK.thresholdPct) * DEBT_RISK.multiplier)
    : 0;
  const waterStressContrib = foodWater && foodWater.waterStressIndex >= 4
    ? (foodWater.waterStressIndex - 3) * 1.8
    : 0;
  const riskTotal = riskBase
    + conflict * 0.18
    + relationshipSummary.hostility * 0.11
    + borderDisputes * 0.09
    + conflictHistory * 0.08
    + sanctions * 0.05
    - cohesion * 0.08
    - regimeStability * 0.05
    - relationshipSummary.deterrence * 0.03
    + timelineIndex * 1.1
    + debtRiskContrib
    + waterStressContrib;
  const risk = clamp(riskTotal, 8, 97);

  const drivers = [
    { label: 'Alliance commitments', value: Math.round(military * 0.9), direction: 'blocA' as const },
    { label: 'Relationship cooperation', value: relationshipSummary.cooperation, direction: 'blocA' as const },
    { label: 'Relationship tension', value: relationshipSummary.tension, direction: 'risk' as const },
    { label: 'Trade dependence', value: Math.round(tradeDependence * 0.9), direction: 'nonAligned' as const },
    { label: 'Border disputes', value: Math.round(borderDisputes * 0.95), direction: 'risk' as const },
    { label: 'Regime stability', value: Math.round(regimeStability * 0.9), direction: 'data' as const },
    ...(scenarioInputs.sanctionShock > 0
      ? [{ label: 'Sanctions shock', value: Math.round(sanctionsShock), direction: 'risk' as const }]
      : []),
    ...(scenarioInputs.invasionPressure > 0
      ? [{ label: 'Invasion pressure', value: Math.round(invasionShock), direction: 'risk' as const }]
      : []),
    ...(scenarioInputs.electionVolatility > 0
      ? [{ label: 'Election volatility', value: Math.round(electionShock), direction: 'data' as const }]
      : []),
    ...(scenarioInputs.coupRisk > 0
      ? [{ label: 'Coup risk', value: Math.round(coupShock), direction: 'risk' as const }]
      : []),
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, 6) satisfies DriverScore[];

  const alignment = resolveAlignment(probabilities, risk);

  // Only build ContributionLine arrays when the caller actually needs them — these are
  // used exclusively in the RightInspector for the single selected country. Skipping them
  // for the 134-country map/movers/sparkline computations eliminates ~5+ array allocations
  // per simulateCountry call, which runs 400+ times per scenario update.
  const explanation: SimulationExplanation | null = includeExplanation
    ? {
        risk: {
          base: round1(riskBase),
          components: [
            { label: 'Conflict pressure', multiplier: 0.18, inputValue: conflict, contribution: round1(conflict * 0.18) },
            { label: 'Hostility (relationships)', multiplier: 0.11, inputValue: relationshipSummary.hostility, contribution: round1(relationshipSummary.hostility * 0.11) },
            { label: 'Border disputes', multiplier: 0.09, inputValue: borderDisputes, contribution: round1(borderDisputes * 0.09) },
            { label: 'Conflict history', multiplier: 0.08, inputValue: conflictHistory, contribution: round1(conflictHistory * 0.08) },
            { label: 'Sanctions exposure', multiplier: 0.05, inputValue: sanctions, contribution: round1(sanctions * 0.05) },
            { label: 'Cohesion', multiplier: -0.08, inputValue: cohesion, contribution: round1(-cohesion * 0.08) },
            { label: 'Regime stability', multiplier: -0.05, inputValue: regimeStability, contribution: round1(-regimeStability * 0.05) },
            { label: 'Deterrence (relationships)', multiplier: -0.03, inputValue: relationshipSummary.deterrence, contribution: round1(-relationshipSummary.deterrence * 0.03) },
            { label: 'Year offset', multiplier: 1.1, inputValue: timelineIndex, contribution: round1(timelineIndex * 1.1) },
            ...(debtRiskContrib > 0 && fiscal
              ? [{ label: 'External-debt vulnerability', inputValue: fiscal.externalDebtGdpPct, contribution: round1(debtRiskContrib) } satisfies ContributionLine]
              : []),
            ...(waterStressContrib > 0 && foodWater
              ? [{ label: 'Water-stress vulnerability', inputValue: foodWater.waterStressIndex, contribution: round1(waterStressContrib) } satisfies ContributionLine]
              : []),
          ],
          total: round1(riskTotal),
          clamped: Math.round(risk),
          weightSetLabel: weightSet.label,
        },
        confidence: {
          topProbability,
          secondProbability,
          margin: round1(margin),
          base: confidenceBase,
          components: [
            { label: 'Election volatility (shock)', multiplier: -0.05, inputValue: electionShock, contribution: round1(-electionShock * 0.05) },
            { label: 'Coup risk (shock)', multiplier: -0.08, inputValue: coupShock, contribution: round1(-coupShock * 0.08) },
          ],
          total: round1(confidenceTotal),
          clamped: Math.round(confidence),
        },
        probabilities: {
          blocA: {
            base: blocABase,
            components: [
              { label: 'Military commitments', multiplier: 0.22, inputValue: military, contribution: round1(military * 0.22) },
              { label: 'Ideology fit', multiplier: 0.12, inputValue: ideology, contribution: round1(ideology * 0.12) },
              { label: 'Cooperation (relationships)', multiplier: 0.16, inputValue: relationshipSummary.cooperation, contribution: round1(relationshipSummary.cooperation * 0.16) },
              { label: 'Deterrence (relationships)', multiplier: 0.08, inputValue: relationshipSummary.deterrence, contribution: round1(relationshipSummary.deterrence * 0.08) },
              { label: 'Regime stability', multiplier: 0.06, inputValue: regimeStability, contribution: round1(regimeStability * 0.06) },
              { label: `Regime bonus (${profile.regimeType})`, contribution: regimeBlocABonus },
              { label: 'Year momentum', multiplier: 0.3, inputValue: momentum, contribution: round1(momentum * 0.3) },
              { label: 'Hostility (relationships)', multiplier: -0.06, inputValue: relationshipSummary.hostility, contribution: round1(-relationshipSummary.hostility * 0.06) },
              { label: 'Sanctions exposure', multiplier: -0.04, inputValue: sanctions, contribution: round1(-sanctions * 0.04) },
              ...(diplomatic
                ? [{ label: 'UN voting alignment (bloc A)', inputValue: diplomatic.unVotingAlignmentBlocA, contribution: round1(diplomaticBlocABoost) } satisfies ContributionLine]
                : []),
            ],
            raw: round1(blocARaw),
            rawClamped: round1(blocAClamped),
            rawTotal: round1(probTotal),
            normalized: probabilities.blocA,
          },
          blocB: {
            base: blocBBase,
            components: [
              { label: 'Sanctions exposure', multiplier: 0.14, inputValue: sanctions, contribution: round1(sanctions * 0.14) },
              { label: 'Hostility (relationships)', multiplier: 0.16, inputValue: relationshipSummary.hostility, contribution: round1(relationshipSummary.hostility * 0.16) },
              { label: 'Conflict history', multiplier: 0.12, inputValue: conflictHistory, contribution: round1(conflictHistory * 0.12) },
              { label: 'Border disputes', multiplier: 0.1, inputValue: borderDisputes, contribution: round1(borderDisputes * 0.1) },
              { label: 'Dependency (relationships)', multiplier: 0.08, inputValue: relationshipSummary.dependency, contribution: round1(relationshipSummary.dependency * 0.08) },
              { label: `Regime bonus (${profile.regimeType})`, contribution: regimeBlocBBonus },
              { label: 'Year momentum', multiplier: 0.08, inputValue: momentum, contribution: round1(momentum * 0.08) },
              { label: 'Regime stability', multiplier: -0.04, inputValue: regimeStability, contribution: round1(-regimeStability * 0.04) },
              ...(diplomatic
                ? [{ label: 'UN voting alignment (bloc B)', inputValue: diplomatic.unVotingAlignmentBlocB, contribution: round1(diplomaticBlocBBoost) } satisfies ContributionLine]
                : []),
            ],
            raw: round1(blocBRaw),
            rawClamped: round1(blocBClamped),
            rawTotal: round1(probTotal),
            normalized: probabilities.blocB,
          },
          nonAligned: {
            base: nonAlignedBase,
            components: [
              { label: 'Trade exposure', multiplier: 0.08, inputValue: tradeExposure, contribution: round1(tradeExposure * 0.08) },
              { label: 'Trade dependence', multiplier: 0.14, inputValue: tradeDependence, contribution: round1(tradeDependence * 0.14) },
              { label: 'Cohesion', multiplier: 0.08, inputValue: cohesion, contribution: round1(cohesion * 0.08) },
              { label: 'Strategic balance', multiplier: 0.08, inputValue: strategicBalance, contribution: round1(strategicBalance * 0.08) },
              { label: 'Regime stability', multiplier: 0.07, inputValue: regimeStability, contribution: round1(regimeStability * 0.07) },
              { label: 'Military commitments', multiplier: -0.05, inputValue: military, contribution: round1(-military * 0.05) },
              { label: 'Hostility (relationships)', multiplier: -0.04, inputValue: relationshipSummary.hostility, contribution: round1(-relationshipSummary.hostility * 0.04) },
              { label: 'Year momentum', multiplier: -0.1, inputValue: momentum, contribution: round1(-momentum * 0.1) },
            ],
            raw: round1(nonAlignedRaw),
            rawClamped: round1(nonAlignedClamped),
            rawTotal: round1(probTotal),
            normalized: probabilities.nonAligned,
          },
        },
      }
    : null;

  const result: SimulatedCountry = {
    profile,
    alignment,
    confidence: Math.round(confidence),
    risk: Math.round(risk),
    probabilities,
    drivers,
    history: includeHistory
      ? buildHistory(profile, timelineIndex, { scenarioInputs, weightSet }, alignment, confidence)
      : [],
    relationshipSummary,
    explanation,
  };
  simulationCache.set(cacheKey, result);
  return result;
};

export const getRiskTier = classifyRisk;
