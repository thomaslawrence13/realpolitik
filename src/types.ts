export type Alignment = 'blocA' | 'blocB' | 'nonAligned' | 'unstable';
export type RegimeType = 'democracy' | 'hybrid' | 'authoritarian';
export type Tier = 'low' | 'medium' | 'high';
export type RelationshipDimension = 'cooperation' | 'hostility' | 'dependency' | 'deterrence';
export type OverlayMode = 'none' | RelationshipDimension;
export type MapFillMode =
  | 'alignment'
  | 'risk'
  | 'confidence'
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

export type EvidenceClass = 'observed' | 'estimated' | 'fallback' | 'derived';

/** Field-level evidence metadata for numeric snapshots shown in the inspector. */
export interface MetricProvenance {
  sourceId: string;
  observedAt: string;
  retrievedAt?: string;
  evidenceClass: EvidenceClass;
  confidence?: number;
  /** Reference period the value describes, when more precise than observedAt. */
  vintage?: string;
  /** True when the value is a forecast or staff estimate. */
  projection?: boolean;
}

export type StatField =
  | 'gdpBillionUsd'
  | 'gdpGrowthPct'
  | 'gdpPerCapitaUsd'
  | 'inflationPct'
  | 'tradeGdpPct'
  | 'militaryExpGdpPct'
  | 'militaryExpBillionUsd'
  | 'populationMillions'
  | 'urbanizationPct';

export interface StatProvenance {
  sourceId: string;
  vintage?: string;
  projection?: boolean;
}

export type StatsProvenance = Partial<Record<StatField, StatProvenance>>;

export type EconomicMetricKey =
  | 'gdpBillionUsd'
  | 'gdpGrowthPct'
  | 'gdpPerCapitaUsd'
  | 'inflationPct'
  | 'tradeGdpPct';

/** Key macroeconomic statistics (latest observed values). */
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
  /** Exact source and evidence attached to each displayed metric. */
  provenance?: Partial<Record<EconomicMetricKey, MetricProvenance>>;
}

export type MilitaryMetricKey =
  | 'militaryExpBillionUsd'
  | 'militaryExpGdpPct'
  | 'activePersonnelThousands'
  | 'nuclearArmed';

/** Key military statistics (latest observed values). */
export interface MilitaryStats {
  /** Defence spending in billions USD */
  militaryExpBillionUsd: number;
  /** Defence spending as % of GDP */
  militaryExpGdpPct: number;
  /** Active-duty military personnel (thousands) */
  activePersonnelThousands: number;
  /** Whether the state possesses nuclear weapons */
  nuclearArmed: boolean;
  /** Exact source and evidence attached to each displayed metric. */
  provenance?: Partial<Record<MilitaryMetricKey, MetricProvenance>>;
}

/** Demographic snapshot (latest observed values). */
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
  /** UN General Assembly voting agreement computed from published roll-calls. */
  unVotesSource?: {
    sourceTitle: string;
    sourceUrl: string;
    retrievedAt: string;
    sessions: string[];
    rollCalls: number;
  };
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

export type HistoricalMetricId =
  | 'gdpGrowth'
  | 'gdpNominal'
  | 'gdpPerCapita'
  | 'inflation'
  | 'tradeOpenness'
  | 'militaryBurden'
  | 'militarySpend'
  | 'unemployment';

export interface HistoricalMetricPoint {
  period: string;
  value: number;
  retrievalDate: string;
  quality: 'observed' | 'estimated' | 'fallback';
}

export interface HistoricalMetricMetadata {
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  definition: string;
  unit: string;
  methodology: string;
  lastUpdated: string;
  coverage: string;
  confidenceFlags: string[];
  retrievedAt: string;
  frequency: 'annual' | 'quarterly';
}

export interface HistoricalMetricSeries {
  metricId: HistoricalMetricId;
  label: string;
  points: HistoricalMetricPoint[];
  metadata: HistoricalMetricMetadata;
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
  /** Macroeconomic snapshot (latest observed). Present for all parameterised states. */
  economicStats?: EconomicStats;
  /** Defence / military snapshot (latest observed). Present for all parameterised states. */
  militaryStats?: MilitaryStats;
  /** Demographic snapshot. Coverage limited to G20 + key strategic actors in v10. */
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
  /** Historical observed indicator series with provenance metadata. */
  historicalSeries?: HistoricalMetricSeries[];
  /** US Treasury OFAC sanctions registry summary for this country. */
  sanctions?: {
    entryCount: number;
    programCount: number;
    topPrograms: string[];
    sourceTitle: string;
    sourceUrl: string;
    retrievedAt: string;
  };
  /**
   * UN Security Council Consolidated List — multilateral sanctions listings
   * under the regimes that concern this country. Kept separate from
   * `sanctions` (US OFAC) because the two are different legal instruments and
   * merging their counts would imply an authority neither one carries.
   */
  unscSanctions?: {
    listingCount: number;
    individualCount: number;
    entityCount: number;
    regimes: Array<{ regime: string; label: string; listingCount: number; newestListedOn: string | null }>;
    /** Most recent designation date across this country's regimes. */
    newestListedOn: string | null;
    /** The UN's own `dateGenerated` stamp on the published list. */
    listGeneratedOn: string | null;
    sourceTitle: string;
    sourceUrl: string;
    retrievedAt: string;
  };
  /**
   * EU Consolidated Financial Sanctions. Attributed by the identity of the
   * designated party (citizenship for persons, registered address for
   * entities) rather than by programme — see `lib/euSanctions.ts` for why
   * programme attribution would misreport Ukraine.
   */
  euSanctions?: {
    listingCount: number;
    personCount: number;
    enterpriseCount: number;
    programmes: Array<{ programme: string; label: string; listingCount: number }>;
    newestDesignation: string | null;
    /** The EU's own export stamp on the published list. */
    listGeneratedOn: string | null;
    sourceTitle: string;
    sourceUrl: string;
    retrievedAt: string;
  };
  /**
   * UNHCR displacement populations. Origin and asylum figures are kept as
   * separate fields, never a single total: producing displacement and hosting
   * it are opposite positions that a combined number would hide.
   */
  displacement?: {
    refugeesFromCountry: number;
    asylumSeekersFromCountry: number;
    refugeesHosted: number;
    asylumSeekersHosted: number;
    idps: number;
    stateless: number;
    /** Reference year of the figures — a completed year, not a nowcast. */
    referenceYear: number;
    sourceTitle: string;
    sourceUrl: string;
    retrievedAt: string;
  };
  /**
   * BIS financial vulnerability indicators. Present only for the ~50 tracked
   * countries BIS reports on; absence means unreported, never "sound".
   */
  bisFinancial?: {
    observations: Array<{
      key: string;
      label: string;
      unit: string;
      value: number;
      /** BIS period label, e.g. `2025-Q4`. */
      period: string;
      note: string;
    }>;
    /** Basel buffer-guide reading of the credit-to-GDP gap, when reported. */
    creditGapBand: string | null;
    sourceTitle: string;
    sourceUrl: string;
    retrievedAt: string;
  };
  /** UCDP Country-Year organized-violence summary (observed conflict feed). */
  conflict?: {
    active: boolean;
    lastYear: number;
    lastYearStateBased: boolean;
    lastYearNonState: boolean;
    lastYearOneSided: boolean;
    deathsLastYear: number;
    deathsPriorYear: number;
    totalDeathsInWindow: number;
    stateBased: boolean;
    nonState: boolean;
    oneSided: boolean;
    version: string;
    sourceTitle: string;
    sourceUrl: string;
    retrievedAt: string;
  };
  /** Source and reference period for each numeric statistic surfaced by the UI. */
  statsProvenance?: StatsProvenance;
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
  retrievedAt?: string;
  confidence: number;
  stale: boolean;
  method: 'api' | 'snapshot' | 'expert-curated' | 'derived';
  evidenceClass: 'observed' | 'estimated' | 'fallback' | 'derived';
  /** Reference period the selected observation describes. */
  vintage?: string;
  /** When the publisher refreshed the underlying series. */
  seriesUpdatedAt?: string;
  /** True for a forecast or staff estimate rather than a reported outturn. */
  projection?: boolean;
}

export interface CountryDataQuality {
  computedSourceCoverage: number;
  computedLastUpdated: string;
  degradedReasons: string[];
  indicators: IndicatorTelemetry[];
  /** Runtime coverage split by evidence and freshness instead of one opaque percentage. */
  coverage: CoverageMetrics;
}

export interface CoverageMetrics {
  /** Any selected value, regardless of evidence quality. */
  valuePct: number;
  /** Selected values classified as observed evidence. */
  observedPct: number;
  /** Selected values within their freshness SLA. */
  freshPct: number;
  /** Selected values classified as fallback evidence. */
  fallbackPct: number;
  /** Selected values outside their freshness SLA. */
  stalePct: number;
  /** Selected values below the indicator confidence floor. */
  lowConfidencePct: number;
}

export interface CountryInformationScore {
  countryId: string;
  displayName: string;
  informationScore: number;
  yearsStale: number;
  staleIndicatorCount: number;
  fallbackIndicatorCount: number;
  lowConfidenceIndicatorCount: number;
  sourceCoverage: number;
  completeness: number;
  stale: boolean;
  gaps: string[];
  remediationDrivers: string[];
  averageIndicatorConfidence: number;
  evidenceSummary: {
    observed: number;
    estimated: number;
    derived: number;
    fallback: number;
  };
}

export interface InformationScoreWeights {
  coverage: number;
  completeness: number;
  recency: number;
  evidence: number;
  confidence: number;
}

export interface InformationQualityKpiTargets {
  minimumAverageInformationScore: number;
  maximumLowQualityCountries: number;
  maximumStaleCountries: number;
  maximumStaticRuntimeScoreDelta: number;
}

export interface InformationQualityKpiStatus {
  averageInformationScoreWithinTarget: boolean;
  lowQualityCountWithinTarget: boolean;
  staleCountryCountWithinTarget: boolean;
  staticRuntimeScoreDeltaWithinTarget: boolean;
  staticRuntimeScoreDelta: number | null;
}

export interface InformationQualityOutputInventoryItem {
  key: 'dataQuality' | 'informationQualityTelemetry' | 'ingestTelemetry' | 'trustSummary';
  origin: 'static-at-build' | 'runtime-live';
  description: string;
}

export interface InformationQualityContract {
  contractVersion: string;
  scoringVersion: string;
  scoreWeights: InformationScoreWeights;
  staleThresholdDays: number;
  lowCoverageThresholdPct: number;
  warningCoverageThresholdPct: number;
  minimumIndicatorConfidence: number;
  outputs: InformationQualityOutputInventoryItem[];
  kpiTargets: InformationQualityKpiTargets;
}

export interface InformationQualityTelemetry {
  layer: 'static-at-build' | 'runtime-live';
  assessedAt: string;
  scoringVersion: string;
  scoreWeights: InformationScoreWeights;
  kpiTargets: InformationQualityKpiTargets;
  kpiStatus: InformationQualityKpiStatus;
  averageInformationScore: number;
  staleCountryCount: number;
  highQualityCount: number;
  lowQualityCount: number;
  topInformationCountries: CountryInformationScore[];
  weakestInformationCountries: CountryInformationScore[];
}

export interface IngestIndicatorTelemetry {
  snapshotKey: string;
  code: string;
  label: string;
  coverageCount: number;
  missingCountryCount: number;
  newestObservation: string | null;
}

export interface IngestTelemetry {
  generatedAt: string;
  provider: string;
  requestedCountryCount: number;
  averageCoveragePct: number;
  strongestIndicators: IngestIndicatorTelemetry[];
  weakestIndicators: IngestIndicatorTelemetry[];
}

export interface EnhancementAcceptanceCriteria {
  minimumV10CoveragePct: number;
  minimumV11CoveragePct: number;
  minimumAverageInformationScore: number;
  minimumIndicatorConfidenceFloor: number;
  maximumStaleCountries: number;
  minimumAverageRelationshipsPerCountry: number;
  maximumIsolatedCountries: number;
}

export interface EnhancementAcceptanceStatus {
  v10CoveragePct: number;
  v11CoveragePct: number;
  averageInformationScore: number;
  staleCountryCount: number;
  indicatorConfidenceFloorBreaches: number;
  averageRelationshipsPerCountry: number;
  isolatedCountries: number;
  meetsV10Coverage: boolean;
  meetsV11Coverage: boolean;
  meetsAverageInformationScore: boolean;
  meetsStaleCountryBudget: boolean;
  meetsIndicatorConfidenceFloor: boolean;
  meetsRelationshipCompleteness: boolean;
}

export interface EnhancementReleaseTelemetry {
  releaseTag: string;
  scope: 'coverage-refresh' | 'coverage-density' | 'schema-expansion';
  datasetVersion: string;
  criteria: EnhancementAcceptanceCriteria;
  status: EnhancementAcceptanceStatus;
  releaseAccepted: boolean;
}

export interface DriverScore {
  label: string;
  value: number;
  direction: 'blocA' | 'blocB' | 'nonAligned' | 'risk' | 'data';
}

export interface RelationshipSummary {
  cooperation: number;
  hostility: number;
  dependency: number;
  deterrence: number;
  tension: number;
}

/**
 * Per-country assessment derived from observed indicators and data quality.
 * Alignment is a deterministic reading of current diplomatic posture (defense
 * pacts, UN voting record, regime type) — not a forecast. Confidence is the
 * information-quality score (source coverage, completeness, recency, evidence).
 * Risk is a stress index computed from observed indicators and vulnerabilities.
 */
export interface CountryAssessment {
  profile: CountryProfile;
  alignment: Alignment;
  /** Data confidence 0–100: how well-evidenced this country record is. */
  confidence: number;
  /** Observed stress index 0–100 built from indicators and vulnerabilities. */
  risk: number;
  drivers: DriverScore[];
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
