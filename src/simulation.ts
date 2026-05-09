import type {
  Alignment,
  CountryProfile,
  DriverScore,
  ProbabilitySet,
  RelationshipSummary,
  ScenarioInputs,
  ScenarioSnapshot,
  SimulatedCountry,
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

const normalize = (probabilities: ProbabilitySet): ProbabilitySet => {
  const total = probabilities.blocA + probabilities.blocB + probabilities.nonAligned;

  return {
    blocA: Math.round((probabilities.blocA / total) * 100),
    blocB: Math.round((probabilities.blocB / total) * 100),
    nonAligned: Math.round((probabilities.nonAligned / total) * 100),
  };
};

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

const summarizeRelationships = (profile: CountryProfile): RelationshipSummary => {
  if (profile.relationships.length === 0) {
    return {
      cooperation: 40,
      hostility: 25,
      dependency: 35,
      deterrence: 30,
      tension: 28,
    };
  }

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

  return {
    cooperation: Math.round(totals.cooperation / profile.relationships.length),
    hostility: Math.round(totals.hostility / profile.relationships.length),
    dependency: Math.round(totals.dependency / profile.relationships.length),
    deterrence: Math.round(totals.deterrence / profile.relationships.length),
    tension: Math.round(totals.tension / profile.relationships.length),
  };
};

export const defaultScenarioInputs: ScenarioInputs = {
  sanctionShock: 0,
  treatyShift: 0,
  electionVolatility: 0,
  invasionPressure: 0,
  coupRisk: 0,
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
  weightSet: options?.weightSet ?? simulationWeightSets.baseline,
});

const buildHistory = (profile: CountryProfile, activeIndex: number, options: SimulationOptions): ScenarioSnapshot[] => {
  const historyOffsets = [-2, -1, 0].filter((offset) => activeIndex + offset >= 0);

  return historyOffsets.map((offset) => {
    const snapshot = simulateCountry(profile, activeIndex + offset, { ...options, includeHistory: false });

    return {
      label: `${2026 + activeIndex + offset}`,
      alignment: snapshot.alignment,
      confidence: snapshot.confidence,
    };
  });
};

export const simulateCountry = (
  profile: CountryProfile,
  timelineIndex: number,
  options?: SimulationOptions,
): SimulatedCountry => {
  const { includeHistory, scenarioInputs, weightSet } = resolveOptions(options);
  const momentum = timelineIndex * 1.8;

  const treatyShock = scenarioInputs.treatyShift * weightSet.alliance;
  const sanctionsShock = scenarioInputs.sanctionShock * weightSet.sanctions;
  const electionShock = scenarioInputs.electionVolatility * weightSet.elections;
  const invasionShock = scenarioInputs.invasionPressure * weightSet.invasion;
  const coupShock = scenarioInputs.coupRisk * weightSet.coup;
  const economicShock = (scenarioInputs.sanctionShock * 0.55 + Math.max(0, -scenarioInputs.treatyShift) * 0.35) * weightSet.economic;

  const tradeExposure = tierValue[profile.indicators.tradeExposure];
  const military = clamp(tierValue[profile.indicators.militaryTreatyLevel] + treatyShock * 0.55, 0, 100);
  const conflict = clamp(tierValue[profile.indicators.conflictPressure] + invasionShock * 0.8 + coupShock * 0.12, 0, 100);
  const sanctions = clamp(tierValue[profile.indicators.sanctionsExposure] + sanctionsShock * 0.72, 0, 100);
  const ideology = tierValue[profile.indicators.ideology];
  const borderDisputes = clamp(tierValue[profile.indicators.borderDisputes] + invasionShock * 0.45, 0, 100);
  const regimeStability = clamp(tierValue[profile.indicators.regimeStability] - electionShock * 0.55 - coupShock * 0.75, 0, 100);
  const conflictHistory = tierValue[profile.indicators.conflictHistory];
  const tradeDependence = clamp(tierValue[profile.indicators.tradeDependence] + economicShock * 0.28, 0, 100);
  const cohesion = clamp(profile.indicators.cohesion - electionShock * 0.35 - coupShock * 0.45 + treatyShock * 0.08, 0, 100);

  const baseRelationships = summarizeRelationships(profile);
  const relationshipSummary: RelationshipSummary = {
    cooperation: Math.round(clamp(baseRelationships.cooperation + treatyShock * 0.35 - sanctionsShock * 0.12 - invasionShock * 0.25, 0, 100)),
    hostility: Math.round(clamp(baseRelationships.hostility + invasionShock * 0.6 + sanctionsShock * 0.25 - treatyShock * 0.15, 0, 100)),
    dependency: Math.round(clamp(baseRelationships.dependency + sanctionsShock * 0.18 + economicShock * 0.2, 0, 100)),
    deterrence: Math.round(clamp(baseRelationships.deterrence + invasionShock * 0.28 + treatyShock * 0.14, 0, 100)),
    tension: 0,
  };
  relationshipSummary.tension = Math.round((relationshipSummary.hostility + relationshipSummary.deterrence + conflict) / 3);

  const regimeBlocABonus = profile.regimeType === 'democracy' ? 12 : profile.regimeType === 'hybrid' ? 4 : -10;
  const regimeBlocBBonus = profile.regimeType === 'authoritarian' ? 10 : profile.regimeType === 'hybrid' ? 3 : -8;
  const strategicBalance = 100 - Math.abs(relationshipSummary.cooperation - relationshipSummary.hostility);

  const blocA =
    20 +
    military * 0.22 +
    ideology * 0.12 +
    relationshipSummary.cooperation * 0.16 +
    relationshipSummary.deterrence * 0.08 +
    regimeStability * 0.06 +
    regimeBlocABonus +
    momentum * 0.3 -
    relationshipSummary.hostility * 0.06 -
    sanctions * 0.04;

  const blocB =
    18 +
    sanctions * 0.14 +
    relationshipSummary.hostility * 0.16 +
    conflictHistory * 0.12 +
    borderDisputes * 0.1 +
    relationshipSummary.dependency * 0.08 +
    regimeBlocBBonus +
    momentum * 0.08 -
    regimeStability * 0.04;

  const nonAligned =
    18 +
    tradeExposure * 0.08 +
    tradeDependence * 0.14 +
    cohesion * 0.08 +
    strategicBalance * 0.08 +
    regimeStability * 0.07 -
    military * 0.05 -
    relationshipSummary.hostility * 0.04 -
    momentum * 0.1;

  const probabilities = normalize({
    blocA: Math.max(1, blocA),
    blocB: Math.max(1, blocB),
    nonAligned: Math.max(1, nonAligned),
  });

  const sorted = Object.values(probabilities).sort((a, b) => b - a);
  const confidence = clamp(sorted[0] - sorted[1] + 54 - electionShock * 0.05 - coupShock * 0.08, 38, 96);
  const risk = clamp(
    profile.baselineRisk +
      conflict * 0.18 +
      relationshipSummary.hostility * 0.11 +
      borderDisputes * 0.09 +
      conflictHistory * 0.08 +
      sanctions * 0.05 -
      cohesion * 0.08 -
      regimeStability * 0.05 -
      relationshipSummary.deterrence * 0.03 +
      timelineIndex * 1.1,
    8,
    97,
  );

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

  return {
    profile,
    alignment,
    confidence,
    risk,
    probabilities,
    drivers,
    history: includeHistory ? buildHistory(profile, timelineIndex, { scenarioInputs, weightSet }) : [],
    relationshipSummary,
  };
};

export const getRiskTier = classifyRisk;
