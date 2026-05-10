export type Alignment = 'blocA' | 'blocB' | 'nonAligned' | 'unstable';
export type RegimeType = 'democracy' | 'hybrid' | 'authoritarian';
export type Tier = 'low' | 'medium' | 'high';
export type RelationshipDimension = 'cooperation' | 'hostility' | 'dependency' | 'deterrence';
export type OverlayMode = 'none' | RelationshipDimension;
export type WeightSetKey = 'baseline' | 'hardPower' | 'economicStress';
export type MapFillMode = 'alignment' | 'risk' | 'confidence' | 'shift';

export interface DatasetSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  accessedOn: string;
}

export interface CountryIndicators {
  tradeExposure: Tier;
  militaryTreatyLevel: Tier;
  conflictPressure: Tier;
  sanctionsExposure: Tier;
  ideology: Tier;
  borderDisputes: Tier;
  regimeStability: Tier;
  conflictHistory: Tier;
  tradeDependence: Tier;
  cohesion: number;
}

export interface CountryRecord {
  id: string;
  mapName: string;
  displayName: string;
  allianceNetwork: string;
  region: string;
  subregion: string;
  regimeType: RegimeType;
  baselineRisk: number;
  sourceCoverage: number;
  lastUpdated: string;
  assumptions: string[];
  sourceIds: string[];
  indicators: CountryIndicators;
}

export interface RelationshipEdge {
  sourceCountryId: string;
  targetCountryId: string;
  cooperation: number;
  hostility: number;
  dependency: number;
  deterrence: number;
  notes: string;
  lastUpdated: string;
  sourceIds: string[];
}

export interface DatasetBundle {
  version: string;
  methodologyNotes: string[];
  scenarioTimeline: string[];
  sources: DatasetSource[];
  countries: CountryRecord[];
  relationships: RelationshipEdge[];
}

export type RelationshipDimensionKey = 'cooperation' | 'hostility' | 'dependency' | 'deterrence';

export interface RelationshipDimensionTelemetry {
  dimension: RelationshipDimensionKey;
  sourceId: string;
  observedAt: string;
  confidence: number;
  stale: boolean;
  method: 'api' | 'snapshot' | 'expert-curated' | 'derived';
}

export interface RelationshipDataQuality {
  computedLastUpdated: string;
  degradedReasons: string[];
  dimensions: RelationshipDimensionTelemetry[];
}

export interface CountryRelationship {
  countryId: string;
  displayName: string;
  mapName: string;
  cooperation: number;
  hostility: number;
  dependency: number;
  deterrence: number;
  tension: number;
  notes: string;
  lastUpdated: string;
  sources: DatasetSource[];
  dataQuality?: RelationshipDataQuality;
}

export interface CountryProfile extends CountryRecord {
  sources: DatasetSource[];
  relationships: CountryRelationship[];
  dataQuality?: CountryDataQuality;
}

export interface IndicatorTelemetry {
  indicator: keyof CountryIndicators;
  sourceId: string;
  observedAt: string;
  confidence: number;
  stale: boolean;
  method: 'api' | 'snapshot' | 'expert-curated' | 'derived';
}

export interface CountryDataQuality {
  computedSourceCoverage: number;
  computedLastUpdated: string;
  degradedReasons: string[];
  indicators: IndicatorTelemetry[];
}

export interface ProbabilitySet {
  blocA: number;
  blocB: number;
  nonAligned: number;
}

export interface DriverScore {
  label: string;
  value: number;
  direction: 'blocA' | 'blocB' | 'nonAligned' | 'risk' | 'data';
}

export interface ScenarioSnapshot {
  label: string;
  alignment: Alignment;
  confidence: number;
}

export interface RelationshipSummary {
  cooperation: number;
  hostility: number;
  dependency: number;
  deterrence: number;
  tension: number;
}

export interface ScenarioInputs {
  sanctionShock: number;
  treatyShift: number;
  electionVolatility: number;
  invasionPressure: number;
  coupRisk: number;
}

export interface SimulationWeightSet {
  key: WeightSetKey;
  label: string;
  description: string;
  alliance: number;
  sanctions: number;
  elections: number;
  invasion: number;
  coup: number;
  economic: number;
}

export interface SimulationOptions {
  includeHistory?: boolean;
  scenarioInputs?: ScenarioInputs;
  weightSet?: SimulationWeightSet;
}

export interface ContributionLine {
  label: string;
  multiplier?: number;
  inputValue?: number;
  contribution: number;
  note?: string;
}

export interface RiskExplanation {
  base: number;
  components: ContributionLine[];
  total: number;
  clamped: number;
  weightSetLabel: string;
}

export interface ConfidenceExplanation {
  topProbability: number;
  secondProbability: number;
  margin: number;
  base: number;
  components: ContributionLine[];
  total: number;
  clamped: number;
}

export interface ProbabilityExplanation {
  base: number;
  components: ContributionLine[];
  raw: number;
  rawClamped: number;
  rawTotal: number;
  normalized: number;
}

export interface SimulationExplanation {
  risk: RiskExplanation;
  confidence: ConfidenceExplanation;
  probabilities: {
    blocA: ProbabilityExplanation;
    blocB: ProbabilityExplanation;
    nonAligned: ProbabilityExplanation;
  };
}

export interface SimulatedCountry {
  profile: CountryProfile;
  alignment: Alignment;
  confidence: number;
  risk: number;
  probabilities: ProbabilitySet;
  drivers: DriverScore[];
  history: ScenarioSnapshot[];
  relationshipSummary: RelationshipSummary;
  explanation: SimulationExplanation;
}

export interface Filters {
  allianceNetwork: string;
  tradeExposure: 'all' | Tier;
  militaryTreatyLevel: 'all' | Tier;
  conflictPressure: 'all' | Tier;
  sanctionsExposure: 'all' | Tier;
  regimeType: 'all' | RegimeType;
  riskLevel: 'all' | Tier;
}

export interface SavedScenario {
  id: string;
  name: string;
  timelineIndex: number;
  weightSetKey: WeightSetKey;
  inputs: ScenarioInputs;
  activeEventIds?: string[];
}

export type EventCategory = 'military' | 'economic' | 'political' | 'compound';

export interface EventTemplate {
  id: string;
  name: string;
  category: EventCategory;
  summary: string;
  inputs: Partial<ScenarioInputs>;
  regionTags: string[];
}
