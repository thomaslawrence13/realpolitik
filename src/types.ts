export type Alignment = 'blocA' | 'blocB' | 'nonAligned' | 'unstable';
export type RegimeType = 'democracy' | 'hybrid' | 'authoritarian';
export type Tier = 'low' | 'medium' | 'high';

export interface CountryProfile {
  mapName: string;
  displayName: string;
  allianceNetwork: string;
  region: string;
  subregion: string;
  militaryTreatyLevel: Tier;
  tradeExposure: Tier;
  conflictPressure: Tier;
  sanctionsExposure: Tier;
  regimeType: RegimeType;
  baselineRisk: number;
  cohesion: number;
  leaningBlocA: number;
  leaningBlocB: number;
  leaningNonAligned: number;
  lastUpdated: string;
  sourceCoverage: number;
  assumptions: string[];
}

export interface ProbabilitySet {
  blocA: number;
  blocB: number;
  nonAligned: number;
}

export interface DriverScore {
  label: string;
  value: number;
  direction: 'blocA' | 'blocB' | 'nonAligned' | 'risk';
}

export interface ScenarioSnapshot {
  label: string;
  alignment: Alignment;
  confidence: number;
}

export interface SimulatedCountry {
  profile: CountryProfile;
  alignment: Alignment;
  confidence: number;
  risk: number;
  probabilities: ProbabilitySet;
  drivers: DriverScore[];
  history: ScenarioSnapshot[];
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
