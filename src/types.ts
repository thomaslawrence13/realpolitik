export type Alignment = 'blocA' | 'blocB' | 'nonAligned' | 'unstable';
export type RegimeType = 'democracy' | 'hybrid' | 'authoritarian';
export type Tier = 'low' | 'medium' | 'high';
export type RelationshipDimension = 'cooperation' | 'hostility' | 'dependency' | 'deterrence';
export type OverlayMode = 'none' | RelationshipDimension;

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
}

export interface CountryProfile extends CountryRecord {
  sources: DatasetSource[];
  relationships: CountryRelationship[];
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

export interface SimulatedCountry {
  profile: CountryProfile;
  alignment: Alignment;
  confidence: number;
  risk: number;
  probabilities: ProbabilitySet;
  drivers: DriverScore[];
  history: ScenarioSnapshot[];
  relationshipSummary: RelationshipSummary;
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
