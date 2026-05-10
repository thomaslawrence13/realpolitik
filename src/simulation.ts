import type {
  Alignment,
  ConfidenceExplanation,
  ContributionLine,
  CountryProfile,
  DriverScore,
  EventTemplate,
  ProbabilityExplanation,
  ProbabilitySet,
  RelationshipSummary,
  RiskExplanation,
  ScenarioInputs,
  ScenarioSnapshot,
  SimulatedCountry,
  SimulationExplanation,
  SimulationOptions,
  SimulationWeightSet,
  Tier,
  WeightSetKey,
} from './types';

const tierValue: Record<Tier, number> = {
  low: 18,
  medium: 50,
  high: 82,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

const sumContributions = (lines: ContributionLine[]) =>
  lines.reduce((sum, line) => sum + line.contribution, 0);

const normalizeRegionLabel = (value: string) => value.trim().toLowerCase();

const classifyRisk = (risk: number): Tier => {
  if (risk >= 67) return 'high';
  if (risk >= 34) return 'medium';
  return 'low';
};

const resolveAlignment = (probabilities: ProbabilitySet, risk: number): Alignment => {
  const entries = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  const [topLabel, topValue] = entries[0] as [keyof ProbabilitySet, number];
  const secondValue = entries[1]?.[1] ?? 0;

  if (risk >= 72 && topValue - secondValue < 15) {
    return 'unstable';
  }

  return topLabel;
};

// Cache the base relationship summary per profile object — relationships are static so this
// computation only needs to run once per country regardless of how many simulations are run.
const relationshipSummaryCache = new WeakMap<CountryProfile, RelationshipSummary>();

const summarizeRelationships = (profile: CountryProfile): RelationshipSummary => {
  const cached = relationshipSummaryCache.get(profile);
  if (cached) return cached;

  let result: RelationshipSummary;
  if (profile.relationships.length === 0) {
    result = { cooperation: 40, hostility: 25, dependency: 35, deterrence: 30, tension: 28 };
  } else {
    const totals = profile.relationships.reduce(
      (summary, relationship) => ({
        cooperation: summary.cooperation + relationship.cooperation,
        hostility: summary.hostility + relationship.hostility,
        dependency: summary.dependency + relationship.dependency,
        deterrence: summary.deterrence + relationship.deterrence,
        tension: summary.tension + relationship.tension,
      }),
      { cooperation: 0, hostility: 0, dependency: 0, deterrence: 0, tension: 0 },
    );
    result = {
      cooperation: Math.round(totals.cooperation / profile.relationships.length),
      hostility: Math.round(totals.hostility / profile.relationships.length),
      dependency: Math.round(totals.dependency / profile.relationships.length),
      deterrence: Math.round(totals.deterrence / profile.relationships.length),
      tension: Math.round(totals.tension / profile.relationships.length),
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

const clampScenarioInput = (key: keyof ScenarioInputs, value: number): number => {
  if (key === 'treatyShift') return Math.min(60, Math.max(-60, value));
  return Math.min(100, Math.max(0, value));
};

const eventAppliesToProfile = (profile: CountryProfile, event: EventTemplate): boolean => {
  if (event.regionTags.length === 0) return true;

  const region = normalizeRegionLabel(profile.region);
  const subregion = normalizeRegionLabel(profile.subregion);
  const matchesEasternMediterranean =
    ['western asia', 'northern africa', 'southern europe'].includes(subregion)
    || ['israel', 'lebanon', 'syria', 'jordan', 'cyprus', 'greece', 'turkey', 'egypt', 'libya'].includes(profile.id);

  return event.regionTags.some((tag) => {
    const normalized = normalizeRegionLabel(tag);
    if (normalized === 'global') return true;
    if (normalized === region || normalized === subregion) return true;
    if (normalized === 'eastern mediterranean') return matchesEasternMediterranean;
    return false;
  });
};

export const getActiveEventsForProfile = (
  profile: CountryProfile,
  activeEvents: EventTemplate[],
): EventTemplate[] => activeEvents.filter((event) => eventAppliesToProfile(profile, event));

export const getScenarioInputsForProfile = (
  baseInputs: ScenarioInputs,
  activeEvents: EventTemplate[],
  profile: CountryProfile,
): ScenarioInputs => {
  if (activeEvents.length === 0) return baseInputs;

  const matchingEvents = getActiveEventsForProfile(profile, activeEvents);
  if (matchingEvents.length === 0) return baseInputs;

  const delta = scenarioInputKeys.reduce((acc, key) => {
    const sum = matchingEvents.reduce((total, event) => {
      return total + (event.inputs[key] ?? 0);
    }, 0);
    return { ...acc, [key]: sum };
  }, {} as ScenarioInputs);

  return scenarioInputKeys.reduce((acc, key) => {
    return { ...acc, [key]: clampScenarioInput(key, baseInputs[key] + delta[key]) };
  }, {} as ScenarioInputs);
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

export const getSimulationWeightSet = (key: WeightSetKey) => simulationWeightSets[key];

const resolveOptions = (options?: SimulationOptions) => ({
  includeHistory: options?.includeHistory ?? true,
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
    const snapshot = simulateCountry(profile, activeIndex + offset, { ...options, includeHistory: false });
    return {
      label: `${2026 + activeIndex + offset}`,
      alignment: snapshot.alignment,
      confidence: snapshot.confidence,
    };
  });

  // Append current year using already-computed values — no extra simulation needed.
  past.push({ label: `${2026 + activeIndex}`, alignment: currentAlignment, confidence: currentConfidence });
  return past;
};

export const simulateCountry = (
  profile: CountryProfile,
  timelineIndex: number,
  options?: SimulationOptions,
): SimulatedCountry => {
  const { includeHistory, scenarioInputs, activeEvents, weightSet } = resolveOptions(options);
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
  const debtRiskBoost = fiscal && fiscal.externalDebtGdpPct > 100
    ? Math.min(8, (fiscal.externalDebtGdpPct - 100) * 0.05)
    : 0;
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
      + nuclearDeterrenceBoost + cyberDeterrenceBoost + defensePactDeterrenceBoost,
      0,
      100,
    )),
    tension: 0,
  };
  relationshipSummary.tension = Math.round((relationshipSummary.hostility + relationshipSummary.deterrence + conflict) / 3);

  const regimeBlocABonus = profile.regimeType === 'democracy' ? 12 : profile.regimeType === 'hybrid' ? 4 : -10;
  const regimeBlocBBonus = profile.regimeType === 'authoritarian' ? 10 : profile.regimeType === 'hybrid' ? 3 : -8;
  const strategicBalance = 100 - Math.abs(relationshipSummary.cooperation - relationshipSummary.hostility);

  const blocAComponents: ContributionLine[] = [
    { label: 'Military commitments', multiplier: 0.22, inputValue: military, contribution: military * 0.22 },
    { label: 'Ideology fit', multiplier: 0.12, inputValue: ideology, contribution: ideology * 0.12 },
    { label: 'Cooperation (relationships)', multiplier: 0.16, inputValue: relationshipSummary.cooperation, contribution: relationshipSummary.cooperation * 0.16 },
    { label: 'Deterrence (relationships)', multiplier: 0.08, inputValue: relationshipSummary.deterrence, contribution: relationshipSummary.deterrence * 0.08 },
    { label: 'Regime stability', multiplier: 0.06, inputValue: regimeStability, contribution: regimeStability * 0.06 },
    { label: `Regime bonus (${profile.regimeType})`, contribution: regimeBlocABonus },
    { label: 'Year momentum', multiplier: 0.3, inputValue: momentum, contribution: momentum * 0.3 },
    { label: 'Hostility (relationships)', multiplier: -0.06, inputValue: relationshipSummary.hostility, contribution: -relationshipSummary.hostility * 0.06 },
    { label: 'Sanctions exposure', multiplier: -0.04, inputValue: sanctions, contribution: -sanctions * 0.04 },
    ...(diplomatic
      ? [{ label: 'UN voting alignment (bloc A)', inputValue: diplomatic.unVotingAlignmentBlocA, contribution: diplomaticBlocABoost } satisfies ContributionLine]
      : []),
  ];
  const blocABase = 20;
  const blocARaw = blocABase + sumContributions(blocAComponents);

  const blocBComponents: ContributionLine[] = [
    { label: 'Sanctions exposure', multiplier: 0.14, inputValue: sanctions, contribution: sanctions * 0.14 },
    { label: 'Hostility (relationships)', multiplier: 0.16, inputValue: relationshipSummary.hostility, contribution: relationshipSummary.hostility * 0.16 },
    { label: 'Conflict history', multiplier: 0.12, inputValue: conflictHistory, contribution: conflictHistory * 0.12 },
    { label: 'Border disputes', multiplier: 0.1, inputValue: borderDisputes, contribution: borderDisputes * 0.1 },
    { label: 'Dependency (relationships)', multiplier: 0.08, inputValue: relationshipSummary.dependency, contribution: relationshipSummary.dependency * 0.08 },
    { label: `Regime bonus (${profile.regimeType})`, contribution: regimeBlocBBonus },
    { label: 'Year momentum', multiplier: 0.08, inputValue: momentum, contribution: momentum * 0.08 },
    { label: 'Regime stability', multiplier: -0.04, inputValue: regimeStability, contribution: -regimeStability * 0.04 },
    ...(diplomatic
      ? [{ label: 'UN voting alignment (bloc B)', inputValue: diplomatic.unVotingAlignmentBlocB, contribution: diplomaticBlocBBoost } satisfies ContributionLine]
      : []),
  ];
  const blocBBase = 18;
  const blocBRaw = blocBBase + sumContributions(blocBComponents);

  const nonAlignedComponents: ContributionLine[] = [
    { label: 'Trade exposure', multiplier: 0.08, inputValue: tradeExposure, contribution: tradeExposure * 0.08 },
    { label: 'Trade dependence', multiplier: 0.14, inputValue: tradeDependence, contribution: tradeDependence * 0.14 },
    { label: 'Cohesion', multiplier: 0.08, inputValue: cohesion, contribution: cohesion * 0.08 },
    { label: 'Strategic balance', multiplier: 0.08, inputValue: strategicBalance, contribution: strategicBalance * 0.08 },
    { label: 'Regime stability', multiplier: 0.07, inputValue: regimeStability, contribution: regimeStability * 0.07 },
    { label: 'Military commitments', multiplier: -0.05, inputValue: military, contribution: -military * 0.05 },
    { label: 'Hostility (relationships)', multiplier: -0.04, inputValue: relationshipSummary.hostility, contribution: -relationshipSummary.hostility * 0.04 },
    { label: 'Year momentum', multiplier: -0.1, inputValue: momentum, contribution: -momentum * 0.1 },
  ];
  const nonAlignedBase = 18;
  const nonAlignedRaw = nonAlignedBase + sumContributions(nonAlignedComponents);

  const blocAClamped = Math.max(1, blocARaw);
  const blocBClamped = Math.max(1, blocBRaw);
  const nonAlignedClamped = Math.max(1, nonAlignedRaw);
  const probTotal = blocAClamped + blocBClamped + nonAlignedClamped;
  const probabilities: ProbabilitySet = {
    blocA: Math.round((blocAClamped / probTotal) * 100),
    blocB: Math.round((blocBClamped / probTotal) * 100),
    nonAligned: Math.round((nonAlignedClamped / probTotal) * 100),
  };

  const sorted = Object.values(probabilities).sort((a, b) => b - a);
  const topProbability = sorted[0];
  const secondProbability = sorted[1] ?? 0;
  const margin = topProbability - secondProbability;
  const confidenceBase = 54;
  const confidenceComponents: ContributionLine[] = [
    { label: 'Election volatility (shock)', multiplier: -0.05, inputValue: electionShock, contribution: -electionShock * 0.05 },
    { label: 'Coup risk (shock)', multiplier: -0.08, inputValue: coupShock, contribution: -coupShock * 0.08 },
  ];
  const confidenceTotal = margin + confidenceBase + sumContributions(confidenceComponents);
  const confidence = clamp(confidenceTotal, 38, 96);

  const riskBase = profile.baselineRisk;
  const riskComponents: ContributionLine[] = [
    { label: 'Conflict pressure', multiplier: 0.18, inputValue: conflict, contribution: conflict * 0.18 },
    { label: 'Hostility (relationships)', multiplier: 0.11, inputValue: relationshipSummary.hostility, contribution: relationshipSummary.hostility * 0.11 },
    { label: 'Border disputes', multiplier: 0.09, inputValue: borderDisputes, contribution: borderDisputes * 0.09 },
    { label: 'Conflict history', multiplier: 0.08, inputValue: conflictHistory, contribution: conflictHistory * 0.08 },
    { label: 'Sanctions exposure', multiplier: 0.05, inputValue: sanctions, contribution: sanctions * 0.05 },
    { label: 'Cohesion', multiplier: -0.08, inputValue: cohesion, contribution: -cohesion * 0.08 },
    { label: 'Regime stability', multiplier: -0.05, inputValue: regimeStability, contribution: -regimeStability * 0.05 },
    { label: 'Deterrence (relationships)', multiplier: -0.03, inputValue: relationshipSummary.deterrence, contribution: -relationshipSummary.deterrence * 0.03 },
    { label: 'Year offset', multiplier: 1.1, inputValue: timelineIndex, contribution: timelineIndex * 1.1 },
    ...(fiscal && debtRiskBoost > 0
      ? [{ label: 'External-debt vulnerability', inputValue: fiscal.externalDebtGdpPct, contribution: debtRiskBoost } satisfies ContributionLine]
      : []),
    ...(foodWater && foodWater.waterStressIndex >= 4
      ? [{ label: 'Water-stress vulnerability', inputValue: foodWater.waterStressIndex, contribution: (foodWater.waterStressIndex - 3) * 1.8 } satisfies ContributionLine]
      : []),
  ];
  const riskTotal = riskBase + sumContributions(riskComponents);
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

  const riskExplanation: RiskExplanation = {
    base: round1(riskBase),
    components: riskComponents.map((line) => ({ ...line, contribution: round1(line.contribution) })),
    total: round1(riskTotal),
    clamped: Math.round(risk),
    weightSetLabel: weightSet.label,
  };

  const confidenceExplanation: ConfidenceExplanation = {
    topProbability,
    secondProbability,
    margin: round1(margin),
    base: confidenceBase,
    components: confidenceComponents.map((line) => ({ ...line, contribution: round1(line.contribution) })),
    total: round1(confidenceTotal),
    clamped: Math.round(confidence),
  };

  const buildProbabilityExplanation = (
    base: number,
    components: ContributionLine[],
    raw: number,
    rawClamped: number,
    normalized: number,
  ): ProbabilityExplanation => ({
    base,
    components: components.map((line) => ({ ...line, contribution: round1(line.contribution) })),
    raw: round1(raw),
    rawClamped: round1(rawClamped),
    rawTotal: round1(probTotal),
    normalized,
  });

  const explanation: SimulationExplanation = {
    risk: riskExplanation,
    confidence: confidenceExplanation,
    probabilities: {
      blocA: buildProbabilityExplanation(blocABase, blocAComponents, blocARaw, blocAClamped, probabilities.blocA),
      blocB: buildProbabilityExplanation(blocBBase, blocBComponents, blocBRaw, blocBClamped, probabilities.blocB),
      nonAligned: buildProbabilityExplanation(nonAlignedBase, nonAlignedComponents, nonAlignedRaw, nonAlignedClamped, probabilities.nonAligned),
    },
  };

  return {
    profile,
    alignment,
    confidence,
    risk,
    probabilities,
    drivers,
    history: includeHistory
      ? buildHistory(profile, timelineIndex, { scenarioInputs, weightSet }, alignment, confidence)
      : [],
    relationshipSummary,
    explanation,
  };
};

export const getRiskTier = classifyRisk;
