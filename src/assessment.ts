import type {
  Alignment,
  CountryAssessment,
  CountryProfile,
  DriverScore,
  RelationshipSummary,
  Tier,
} from './types';
import { TIER_VALUES, DEBT_RISK, RISK_THRESHOLDS } from './lib/constants';
import { scoreCountryInformation } from './data/quality/telemetry';

const tierValue: Record<Tier, number> = TIER_VALUES;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Classify risk level into tiers based on thresholds. */
const classifyRisk = (risk: number): Tier => {
  if (risk >= RISK_THRESHOLDS.high) return 'high';
  if (risk >= RISK_THRESHOLDS.medium) return 'medium';
  return 'low';
};

export const getRiskTier = classifyRisk;

// Observed anchor blocs from active defense pacts. Pacts are read from the
// curated diplomatic profile (NATO, AUKUS, ANZUS, MDT, RIMPAC vs CSTO).
const WEST_PACT_MARKERS = ['NATO', 'AUKUS', 'ANZUS', 'MDT', 'RIMPAC', 'NORTH ATLANTIC'] as const;
const EAST_PACT_MARKERS = ['CSTO'] as const;
// allianceNetwork fallback markers for profiles without a diplomatic snapshot.
const WEST_NETWORK_MARKERS = ['NATO', 'US TREATY', 'US PARTNER', 'QUAD'] as const;
const EAST_NETWORK_MARKERS = ['CSTO', 'RUSSIA-ALIGNED', 'REVISIONIST'] as const;

const hasMarker = (value: string | undefined, markers: readonly string[]) =>
  value != null && markers.some((marker) => value.toUpperCase().includes(marker));

/**
 * Deterministic reading of current diplomatic posture from observed facts:
 * active defense pacts, alliance network, and UN General Assembly voting
 * alignment with bloc anchors. This is a classification of the present state,
 * not a forecast of future alignment.
 */
const resolveAlignment = (profile: CountryProfile, risk: number): Alignment => {
  const diplomatic = profile.diplomatic;
  const pacts = (diplomatic?.defensePacts ?? []).join(' ');
  if (hasMarker(pacts, WEST_PACT_MARKERS)) return 'blocA';
  if (hasMarker(pacts, EAST_PACT_MARKERS)) return 'blocB';
  if (hasMarker(profile.allianceNetwork, WEST_NETWORK_MARKERS)) return 'blocA';
  if (hasMarker(profile.allianceNetwork, EAST_NETWORK_MARKERS)) return 'blocB';

  const blocAVotes = diplomatic?.unVotingAlignmentBlocA ?? 50;
  const blocBVotes = diplomatic?.unVotingAlignmentBlocB ?? 50;
  const votingDelta = blocAVotes - blocBVotes;

  if (votingDelta >= 12) return 'blocA';
  if (votingDelta <= -12) return 'blocB';

  // No clear pact or voting signal: contested only when the situation on the
  // ground is genuinely unstable (high conflict pressure, weak regime stability).
  const contested =
    profile.indicators.conflictPressure === 'high' &&
    profile.indicators.regimeStability === 'low' &&
    risk >= RISK_THRESHOLDS.high;
  return contested ? 'unstable' : 'nonAligned';
};

const relationshipSummaryCache = new WeakMap<CountryProfile, RelationshipSummary>();

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

// Assessment only depends on the profile (no timeline, shocks, or weight sets),
// so results are cached per profile object. The worker is gone — this runs on
// the main thread and is cheap: no probability arrays are allocated.
const assessmentCache = new WeakMap<CountryProfile, CountryAssessment>();

/**
 * Assess a country's present state from observed data only:
 * - `risk`: stress index from baseline risk plus observed indicators and
 *   structural vulnerabilities (fiscal debt, water stress). No synthetic
 *   year offsets, no hypothetical shocks, no momentum terms.
 * - `confidence`: the information-quality score (source coverage, dimensional
 *   completeness, recency, evidence class, indicator confidence).
 * - `alignment`: deterministic classification of current diplomatic posture.
 */
export const assessCountry = (profile: CountryProfile): CountryAssessment => {
  const cached = assessmentCache.get(profile);
  if (cached) return cached;

  const relationshipSummary = summarizeRelationships(profile);

  const fiscal = profile.fiscal;
  const foodWater = profile.foodWater;

  const debtRiskContrib = fiscal && fiscal.externalDebtGdpPct > DEBT_RISK.thresholdPct
    ? Math.min(DEBT_RISK.maxContribution, (fiscal.externalDebtGdpPct - DEBT_RISK.thresholdPct) * DEBT_RISK.multiplier)
    : 0;
  const waterStressContrib = foodWater && foodWater.waterStressIndex >= 4
    ? (foodWater.waterStressIndex - 3) * 1.8
    : 0;

  const conflict = tierValue[profile.indicators.conflictPressure];
  const sanctions = tierValue[profile.indicators.sanctionsExposure];
  const borderDisputes = tierValue[profile.indicators.borderDisputes];
  const conflictHistory = tierValue[profile.indicators.conflictHistory];
  const regimeStability = tierValue[profile.indicators.regimeStability];
  const cohesion = profile.indicators.cohesion;
  const military = tierValue[profile.indicators.militaryTreatyLevel];
  const tradeDependence = tierValue[profile.indicators.tradeDependence];

  const riskBase = profile.baselineRisk;
  const riskTotal = riskBase
    + conflict * 0.18
    + relationshipSummary.hostility * 0.11
    + borderDisputes * 0.09
    + conflictHistory * 0.08
    + sanctions * 0.05
    - cohesion * 0.08
    - regimeStability * 0.05
    - relationshipSummary.deterrence * 0.03
    + debtRiskContrib
    + waterStressContrib;
  const risk = clamp(riskTotal, 8, 97);

  const confidence = scoreCountryInformation(profile).informationScore;
  const alignment = resolveAlignment(profile, risk);

  const drivers = [
    { label: 'Alliance commitments', value: Math.round(military * 0.9), direction: 'blocA' as const },
    { label: 'Relationship cooperation', value: relationshipSummary.cooperation, direction: 'blocA' as const },
    { label: 'Relationship tension', value: relationshipSummary.tension, direction: 'risk' as const },
    { label: 'Trade dependence', value: Math.round(tradeDependence * 0.9), direction: 'nonAligned' as const },
    { label: 'Border disputes', value: Math.round(borderDisputes * 0.95), direction: 'risk' as const },
    { label: 'Regime stability', value: Math.round(regimeStability * 0.9), direction: 'data' as const },
    { label: 'Sanctions exposure', value: Math.round(sanctions), direction: 'risk' as const },
    { label: 'Conflict pressure', value: Math.round(conflict), direction: 'risk' as const },
    ...(debtRiskContrib > 0
      ? [{ label: 'External-debt vulnerability', value: Math.round(debtRiskContrib * 10), direction: 'risk' as const }]
      : []),
    ...(waterStressContrib > 0
      ? [{ label: 'Water-stress vulnerability', value: Math.round(waterStressContrib * 10), direction: 'risk' as const }]
      : []),
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, 6) satisfies DriverScore[];

  const result: CountryAssessment = {
    profile,
    alignment,
    confidence,
    risk: Math.round(risk),
    drivers,
    relationshipSummary,
  };
  assessmentCache.set(profile, result);
  return result;
};
