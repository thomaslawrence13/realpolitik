import type {
  Alignment,
  ConfidenceExplanation,
  ContributionLine,
  CountryProfile,
  DriverScore,
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
    history: includeHistory ? buildHistory(profile, timelineIndex, { scenarioInputs, weightSet }) : [],
    relationshipSummary,
    explanation,
  };
};

export const getRiskTier = classifyRisk;
