import type {
  Alignment,
  CountryProfile,
  DriverScore,
  ProbabilitySet,
  RelationshipSummary,
  ScenarioSnapshot,
  SimulatedCountry,
  Tier,
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

const buildHistory = (profile: CountryProfile, activeIndex: number): ScenarioSnapshot[] => {
  const historyOffsets = [-2, -1, 0].filter((offset) => activeIndex + offset >= 0);

  return historyOffsets.map((offset) => {
    const snapshot = simulateCountry(profile, activeIndex + offset, false);

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
  includeHistory = true,
): SimulatedCountry => {
  const momentum = timelineIndex * 1.8;
  const tradeExposure = tierValue[profile.indicators.tradeExposure];
  const military = tierValue[profile.indicators.militaryTreatyLevel];
  const conflict = tierValue[profile.indicators.conflictPressure];
  const sanctions = tierValue[profile.indicators.sanctionsExposure];
  const ideology = tierValue[profile.indicators.ideology];
  const borderDisputes = tierValue[profile.indicators.borderDisputes];
  const regimeStability = tierValue[profile.indicators.regimeStability];
  const conflictHistory = tierValue[profile.indicators.conflictHistory];
  const tradeDependence = tierValue[profile.indicators.tradeDependence];
  const relationshipSummary = summarizeRelationships(profile);
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
    profile.indicators.cohesion * 0.08 +
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
  const confidence = clamp(sorted[0] - sorted[1] + 54, 43, 96);
  const risk = clamp(
    profile.baselineRisk +
      conflict * 0.18 +
      relationshipSummary.hostility * 0.11 +
      borderDisputes * 0.09 +
      conflictHistory * 0.08 +
      sanctions * 0.05 -
      profile.indicators.cohesion * 0.08 -
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
  ].sort((a, b) => b.value - a.value) satisfies DriverScore[];

  const alignment = resolveAlignment(probabilities, risk);

  return {
    profile,
    alignment,
    confidence,
    risk,
    probabilities,
    drivers,
    history: includeHistory ? buildHistory(profile, timelineIndex) : [],
    relationshipSummary,
  };
};

export const getRiskTier = classifyRisk;
