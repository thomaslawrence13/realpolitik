export type Alignment = 'blocA' | 'blocB' | 'nonAligned' | 'unstable';
export type RegimeType = 'democracy' | 'hybrid' | 'authoritarian';
export type Tier = 'low' | 'medium' | 'high';
export type RelationshipDimension = 'cooperation' | 'hostility' | 'dependency' | 'deterrence';
export type OverlayMode = 'none' | RelationshipDimension;
export type WeightSetKey = 'baseline' | 'hardPower' | 'economicStress';
export type MapFillMode =
  | 'alignment'
  | 'risk'
  | 'confidence'
  | 'shift'
  | 'gdpPerCapita'
  | 'gdpGrowth'
  | 'inflation'
  | 'tradeOpenness'
  | 'nuclearArmed'
  | 'militaryBurden'
  | 'regime'
  | 'conflictPressure'
  | 'population'
  | 'medianAge'
  | 'energyExports'
  | 'demographicPressure'
  // v11 fill modes
  | 'cyberCapability'
  | 'internetFreedom'
  | 'foodImportDependence'
  | 'waterStress'
  | 'debtVulnerability'
  | 'sovereignRating'
  | 'unVotingBlocA'
  | 'unVotingBlocB'
  | 'criticalMineralIntensity'
  | 'softPower'
  | 'defensePactDensity';

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

/** Key macroeconomic statistics (~2024 values). */
export interface EconomicStats {
  /** Nominal GDP in billions USD */
  gdpBillionUsd: number;
  /** Annual GDP growth rate (%) */
  gdpGrowthPct: number;
  /** Nominal GDP per capita in USD */
  gdpPerCapitaUsd: number;
  /** Consumer price inflation, annual % */
  inflationPct: number;
  /** Total trade (imports + exports) as % of GDP */
  tradeGdpPct: number;
}

/** Key military statistics (~2024 values). */
export interface MilitaryStats {
  /** Defence spending in billions USD */
  militaryExpBillionUsd: number;
  /** Defence spending as % of GDP */
  militaryExpGdpPct: number;
  /** Active-duty military personnel (thousands) */
  activePersonnelThousands: number;
  /** Whether the state possesses nuclear weapons */
  nuclearArmed: boolean;
}

/** Demographic snapshot (~2024 values). */
export interface DemographicStats {
  /** Total population in millions */
  populationMillions: number;
  /** Median age, years */
  medianAge: number;
  /** Urban population as % of total */
  urbanizationPct: number;
  /** Share of population aged 15-29 (%) — proxy for youth bulge */
  youthSharePct: number;
  /** Net annual migration rate per 1000 (positive = inflow) */
  netMigrationPer1000?: number;
}

/** Energy and critical-resource posture. */
export interface EnergyProfile {
  /** Net oil exporter (positive numbers = net export, mb/d) */
  netOilExportMbd: number;
  /** Net gas exporter (positive = net export, bcm/yr) */
  netGasExportBcm: number;
  /** Energy import dependence: imports as % of total energy use */
  energyImportDependencePct: number;
  /** Whether the state hosts material critical-mineral production */
  criticalMineralExporter: boolean;
  /** Notes describing key resources, choke points, or pipelines */
  notes?: string;
}

/** Top-N bilateral trade partner with directional share metadata. */
export interface TopTradePartner {
  /** Other country's id */
  countryId: string;
  /** Share of this country's total trade attributed to the partner (0–100). */
  sharePct: number;
  /** Whether the share is dominated by exports, imports, or balanced. */
  flow: 'exports' | 'imports' | 'balanced';
}

/** Geographic centroid (approximate). */
export interface GeoCentroid {
  lat: number;
  lng: number;
}

/** Cyber capability and information posture (v11). */
export interface CyberProfile {
  /** Offensive cyber capability tier (low / medium / high). */
  offensiveTier: Tier;
  /** Defensive / resilience tier (low / medium / high). */
  defensiveTier: Tier;
  /** Internet freedom score 0–100 (Freedom House proxy; 100 = fully free). */
  internetFreedomScore: number;
  /** Internet penetration rate (% of population using internet). */
  internetPenetrationPct: number;
  /** Whether the state mandates data localization or maintains a sovereign internet posture. */
  dataLocalization: boolean;
  /** Optional notes (capabilities, recent incidents, sponsoring organizations). */
  notes?: string;
}

/** Fiscal vulnerability and sovereign credit posture (v11). */
export interface FiscalProfile {
  /** Sovereign credit rating tier:
   *   investment = AAA→BBB-, speculative = BB+→B-, distressed = CCC and below. */
  sovereignRatingTier: 'investment' | 'speculative' | 'distressed';
  /** External debt as % of GDP. */
  externalDebtGdpPct: number;
  /** FX reserves expressed as months of import cover. */
  fxReservesMonthsImports: number;
  /** Primary balance as % of GDP (negative = deficit). */
  primaryBalanceGdpPct?: number;
  /** Optional notes (IMF program, recent debt restructure, currency regime). */
  notes?: string;
}

/** Food and water security posture (v11). */
export interface FoodWaterProfile {
  /** Food import dependency: net food imports as % of consumption. Negative = net exporter. */
  foodImportDependencePct: number;
  /** Water stress index 1–5 (1 = abundant, 5 = extreme stress; WRI Aqueduct proxy). */
  waterStressIndex: number;
  /** Arable land per capita, hectares. */
  arableLandHaPerCapita: number;
  /** Whether the country is a top-20 global cereal exporter. */
  cerealExporter: boolean;
  /** Optional notes (climate exposure, key crops, irrigation strain). */
  notes?: string;
}

/** Diplomatic posture: UN voting alignment, defense pacts, multilateral memberships (v11). */
export interface DiplomaticProfile {
  /** UN General Assembly voting agreement with bloc anchors, 0–100 scale.
   *  blocA anchor = United States; blocB anchor = China/Russia consensus. */
  unVotingAlignmentBlocA: number;
  unVotingAlignmentBlocB: number;
  /** Active defense pacts (NATO, AUKUS, CSTO, ANZUS, MDT, RIMPAC, etc.). */
  defensePacts: string[];
  /** Major intergovernmental memberships (BRICS, G7, G20, OECD, OPEC, ASEAN, EU, SCO, etc.). */
  igoMemberships: string[];
  /** Active treaty review or accession track (optional). */
  pendingAccession?: string[];
}

/** Per-mineral role in critical-supply chains (v11). */
export type CriticalMineralRole = 'producer' | 'processor' | 'consumer' | 'reserves';

export interface CriticalMineralEntry {
  mineral:
    | 'lithium'
    | 'cobalt'
    | 'nickel'
    | 'copper'
    | 'rareEarths'
    | 'gallium'
    | 'germanium'
    | 'graphite'
    | 'uranium'
    | 'platinumGroup'
    | 'manganese'
    | 'tungsten'
    | 'titanium'
    | 'phosphate'
    | 'potash';
  role: CriticalMineralRole;
  /** Approximate share of global activity for this role (0–100). */
  globalSharePct?: number;
}

/** Soft-power and cultural reach proxy (v11). */
export interface SoftPowerProfile {
  /** Composite reach score 0–100 (cultural exports, diaspora, language reach, education). */
  reachScore: number;
  /** Inbound international students (thousands, ~most-recent year). */
  inboundStudentsThousands?: number;
  /** Whether the official or de-facto language is a top-10 global language. */
  globalLanguageHost: boolean;
  /** Optional notes (BBC/CNN/Al Jazeera/CCTV reach, diaspora corridors). */
  notes?: string;
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
  /** Macroeconomic snapshot (~2024). Present for all parameterised states. */
  economicStats?: EconomicStats;
  /** Defence / military snapshot (~2024). Present for all parameterised states. */
  militaryStats?: MilitaryStats;
  /** Demographic snapshot (~2024). Coverage limited to G20 + key strategic actors in v10. */
  demographics?: DemographicStats;
  /** Energy and critical-resource posture. Coverage limited to major exporters/importers in v10. */
  energy?: EnergyProfile;
  /** Top bilateral trade partners with directional shares. */
  topTradePartners?: TopTradePartner[];
  /** Approximate geographic centroid. */
  geo?: GeoCentroid;
  /** Cyber capability and information posture (v11). */
  cyber?: CyberProfile;
  /** Fiscal vulnerability and sovereign credit posture (v11). */
  fiscal?: FiscalProfile;
  /** Food and water security posture (v11). */
  foodWater?: FoodWaterProfile;
  /** Diplomatic posture: UN voting alignment, defense pacts, multilateral memberships (v11). */
  diplomatic?: DiplomaticProfile;
  /** Critical-mineral roles by mineral (v11). */
  criticalMinerals?: CriticalMineralEntry[];
  /** Soft-power and cultural reach proxy (v11). */
  softPower?: SoftPowerProfile;
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
