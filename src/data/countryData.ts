import { geopoliticalDatasetV1 } from './datasets/v1';
import { v10Enhancements } from './datasets/v10Enhancements';
import { v11Enhancements } from './datasets/v11Enhancements';
import { historicalSeriesByCountryId } from './historicalSeries';
import ingestManifest from './datasets/ingest_manifest.json';
import type {
  CountryIndicators,
  IngestIndicatorTelemetry,
  IngestTelemetry,
  EnhancementReleaseTelemetry,
  CountryProfile,
  CountryRelationship,
  CountryRecord,
  DatasetSource,
  IndicatorTelemetry,
  InformationQualityTelemetry,
  RelationshipEdge,
} from '../types';
import { INFORMATION_QUALITY_CONTRACT } from './quality/contract';
import { buildInformationQualityTelemetry } from './quality/telemetry';
import { emptyLiveData, enrichProfilesWithSourcePipeline } from './pipeline';

const dataset = geopoliticalDatasetV1;
const sourceById = new Map(dataset.sources.map((source) => [source.id, source]));

// Apply v10 supplemental fields (demographics, energy, top trade partners, geo)
// then v11 supplemental fields (cyber, fiscal, foodWater, diplomatic, criticalMinerals, softPower)
// to country records before the rest of the data layer indexes them.
const enhancedCountries = dataset.countries.map((country) => {
  const v10 = v10Enhancements[country.id];
  const v11 = v11Enhancements[country.id];
  if (!v10 && !v11) return country;
  return {
    ...country,
    ...(v10?.demographics && { demographics: v10.demographics }),
    ...(v10?.energy && { energy: v10.energy }),
    ...(v10?.topTradePartners && { topTradePartners: v10.topTradePartners }),
    ...(v10?.geo && { geo: v10.geo }),
    ...(v11?.cyber && { cyber: v11.cyber }),
    ...(v11?.fiscal && { fiscal: v11.fiscal }),
    ...(v11?.foodWater && { foodWater: v11.foodWater }),
    ...(v11?.diplomatic && { diplomatic: v11.diplomatic }),
    ...(v11?.criticalMinerals && { criticalMinerals: v11.criticalMinerals }),
    ...(v11?.softPower && { softPower: v11.softPower }),
  };
});

const countryById = new Map(enhancedCountries.map((country) => [country.id, country]));

// ----- Edge derivation (v11) ---------------------------------------------------
//
// The hand-curated relationship list in v1 covers ~170 strategic dyads. v11 adds
// a derivation pass that produces a much denser graph by combining:
//   1. topTradePartners shares  → dependency-flavored edges
//   2. shared defense pacts     → cooperation + deterrence edges
//   3. shared IGO memberships   → light cooperation edges
//   4. opposing bloc anchors    → hostility + deterrence edges
//
// Derived edges are merged with explicit edges by canonical-pair key. Whenever an
// explicit edge already exists, the derived signal is discarded — explicit data
// always wins. Otherwise the derived edge is appended to the dataset with a
// lower-confidence source attribution so downstream telemetry can flag it.
//
// Numeric outputs are clamped to 5–95 and never override explicit values.

const SOURCE_DERIVED = 'v11-derived';

const canonicalPairKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);

const explicitPairKeys = new Set<string>();
dataset.relationships.forEach((edge) => {
  explicitPairKeys.add(canonicalPairKey(edge.sourceCountryId, edge.targetCountryId));
});

const clampScore = (value: number) => Math.max(5, Math.min(95, Math.round(value)));

// Bloc-based cooperation/hostility templates.
// `cooperative` blocs lift cooperation+deterrence between members.
// `opposing` pairs lift hostility+deterrence across the divide.
const cooperativeBlocs = new Set([
  'NATO',
  'AUKUS',
  'GCC',
  'EU',
  'CSTO',
  'CPTPP',
  'BRICS',
  'SCO',
  'EAEU',
  'ASEAN',
  'Mercosur',
  'OECD',
  'G7',
  'NordicCouncil',
  'V4',
  'Quad',
  'FivePowerDefense',
  'Commonwealth',
]);

const opposingBlocPairs: Array<[string, string]> = [
  ['NATO', 'CSTO'],
  ['NATO', 'DPRKTreaty'],
  ['AUKUS', 'CSTO'],
  ['Quad', 'BRICS'],
  ['G7', 'BRICS'],
  ['NATO', 'IranRussiaSP'],
];

const sharesAny = (xs: string[] | undefined, ys: string[] | undefined): string[] => {
  if (!xs || !ys) return [];
  const ySet = new Set(ys);
  return xs.filter((x) => ySet.has(x));
};

const opposesAcross = (a: string[] | undefined, b: string[] | undefined): boolean => {
  if (!a || !b) return false;
  const aSet = new Set(a);
  const bSet = new Set(b);
  return opposingBlocPairs.some(
    ([x, y]) => (aSet.has(x) && bSet.has(y)) || (aSet.has(y) && bSet.has(x)),
  );
};

interface DerivedSignal {
  cooperation: number;
  hostility: number;
  dependency: number;
  deterrence: number;
  notes: string[];
}

const blank = (): DerivedSignal => ({
  cooperation: 0,
  hostility: 0,
  dependency: 0,
  deterrence: 0,
  notes: [],
});

const candidatesByPair = new Map<string, { a: string; b: string; signal: DerivedSignal }>();

const ensureCandidate = (a: string, b: string) => {
  const key = canonicalPairKey(a, b);
  if (explicitPairKeys.has(key)) return null;
  let entry = candidatesByPair.get(key);
  if (!entry) {
    entry = { a: a < b ? a : b, b: a < b ? b : a, signal: blank() };
    candidatesByPair.set(key, entry);
  }
  return entry.signal;
};

// 1. Trade-partner derivation -----------------------------------------------------
for (const country of enhancedCountries) {
  const partners = country.topTradePartners;
  if (!partners) continue;
  for (const partner of partners) {
    if (!countryById.has(partner.countryId)) continue;
    if (partner.countryId === country.id) continue;
    const signal = ensureCandidate(country.id, partner.countryId);
    if (!signal) continue;
    // sharePct ranges 1–95%. Map 5%→25, 30%→70, cap 80.
    const dep = Math.min(80, Math.max(20, partner.sharePct * 1.6 + 18));
    if (dep > signal.dependency) signal.dependency = dep;
    // High shares also mean some baseline cooperation.
    const coop = Math.min(60, Math.max(25, partner.sharePct * 1.0 + 25));
    if (coop > signal.cooperation) signal.cooperation = coop;
    signal.notes.push(`Top trade partner share ${partner.sharePct}% (${partner.flow})`);
  }
}

// 2 + 3. Bloc cooperation derivation ---------------------------------------------
for (let i = 0; i < enhancedCountries.length; i++) {
  const a = enhancedCountries[i];
  const aPacts = a.diplomatic?.defensePacts;
  const aIgos = a.diplomatic?.igoMemberships;
  const aPending = a.diplomatic?.pendingAccession;
  if (!aPacts && !aIgos && !aPending) continue;
  for (let j = i + 1; j < enhancedCountries.length; j++) {
    const b = enhancedCountries[j];
    const sharedPacts = sharesAny(aPacts, b.diplomatic?.defensePacts).filter((p) => cooperativeBlocs.has(p));
    const sharedIgos = sharesAny(aIgos, b.diplomatic?.igoMemberships).filter((i) => cooperativeBlocs.has(i));
    const bPending = b.diplomatic?.pendingAccession;
    const accessionAlignments: string[] = [];
    if (aPending?.includes('NATO') && b.diplomatic?.defensePacts.includes('NATO')) accessionAlignments.push(`${a.displayName}→NATO`);
    if (bPending?.includes('NATO') && aPacts?.includes('NATO')) accessionAlignments.push(`${b.displayName}→NATO`);
    if (aPending?.includes('EU') && b.diplomatic?.igoMemberships.includes('EU')) accessionAlignments.push(`${a.displayName}→EU`);
    if (bPending?.includes('EU') && aIgos?.includes('EU')) accessionAlignments.push(`${b.displayName}→EU`);
    if (sharedPacts.length === 0 && sharedIgos.length === 0 && accessionAlignments.length === 0) continue;
    const signal = ensureCandidate(a.id, b.id);
    if (!signal) continue;
    const coopBoost = sharedPacts.length * 18 + sharedIgos.length * 6;
    const deterrenceBoost = sharedPacts.length * 14;
    const accessionCoopBoost = accessionAlignments.length * 8;
    const accessionDeterrenceBoost = accessionAlignments.length * 5;
    signal.cooperation = Math.min(85, Math.max(signal.cooperation, 30 + coopBoost + accessionCoopBoost));
    signal.deterrence = Math.min(80, Math.max(signal.deterrence, 25 + deterrenceBoost + accessionDeterrenceBoost));
    if (sharedPacts.length > 0) signal.notes.push(`Shared defense pacts: ${sharedPacts.join(', ')}`);
    if (sharedIgos.length > 0) signal.notes.push(`Shared IGO memberships: ${sharedIgos.join(', ')}`);
    if (accessionAlignments.length > 0) signal.notes.push(`Pending accession convergence: ${accessionAlignments.join(', ')}`);
  }
}

// 4. Opposing-bloc hostility derivation ------------------------------------------
for (let i = 0; i < enhancedCountries.length; i++) {
  const a = enhancedCountries[i];
  const aPacts = a.diplomatic?.defensePacts;
  if (!aPacts) continue;
  for (let j = i + 1; j < enhancedCountries.length; j++) {
    const b = enhancedCountries[j];
    const bPacts = b.diplomatic?.defensePacts;
    if (!bPacts) continue;
    if (!opposesAcross(aPacts, bPacts)) continue;
    const signal = ensureCandidate(a.id, b.id);
    if (!signal) continue;
    signal.hostility = Math.min(80, Math.max(signal.hostility, 55));
    signal.deterrence = Math.min(85, Math.max(signal.deterrence, 60));
    signal.notes.push('Opposing defense-bloc anchors');
  }
}

// 5. UN voting alignment delta ---------------------------------------------------
//    Pairs whose UN voting alignment differs sharply across the bloc anchors
//    get a small extra hostility bump on top of any other signals.
for (let i = 0; i < enhancedCountries.length; i++) {
  const a = enhancedCountries[i];
  const aDip = a.diplomatic;
  if (!aDip) continue;
  for (let j = i + 1; j < enhancedCountries.length; j++) {
    const b = enhancedCountries[j];
    const bDip = b.diplomatic;
    if (!bDip) continue;
    // Vector distance across the two anchor dimensions.
    const dx = aDip.unVotingAlignmentBlocA - bDip.unVotingAlignmentBlocA;
    const dy = aDip.unVotingAlignmentBlocB - bDip.unVotingAlignmentBlocB;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 60) continue;
    const signal = ensureCandidate(a.id, b.id);
    if (!signal) continue;
    const bump = Math.min(25, (distance - 60) * 0.4);
    signal.hostility = Math.min(80, Math.max(signal.hostility, 35 + bump));
    if (signal.notes.length === 0 || !signal.notes[signal.notes.length - 1]?.includes('UN voting')) {
      signal.notes.push('Sharp UN-voting-alignment divergence');
    }
  }
}

// Materialize derived candidates into RelationshipEdges.
const derivedEdges: RelationshipEdge[] = [];
const today = new Date().toISOString().slice(0, 10);
for (const { a, b, signal } of candidatesByPair.values()) {
  if (
    signal.cooperation === 0 &&
    signal.hostility === 0 &&
    signal.dependency === 0 &&
    signal.deterrence === 0
  ) {
    continue;
  }
  derivedEdges.push({
    sourceCountryId: a,
    targetCountryId: b,
    cooperation: clampScore(signal.cooperation || 30),
    hostility: clampScore(signal.hostility || 22),
    dependency: clampScore(signal.dependency || 25),
    deterrence: clampScore(signal.deterrence || 25),
    notes: signal.notes.join('; ') || 'Derived from topTradePartners and bloc memberships.',
    lastUpdated: today,
    sourceIds: [SOURCE_DERIVED],
  });
}

// Surface the derived-edge source so the UI source-attribution column does not
// drop these edges silently.
const derivedSource: DatasetSource = {
  id: SOURCE_DERIVED,
  title: 'v11 derived relationships',
  publisher: 'realpolitik pipeline',
  url: 'https://github.com/thomaslawrence13/realpolitik',
  accessedOn: today,
};
sourceById.set(SOURCE_DERIVED, derivedSource);

const allEdges: RelationshipEdge[] = [...dataset.relationships, ...derivedEdges];

// Build adjacency index once so buildRelationships is O(1) per country instead of O(N×R)
const relationshipsByCountryId = new Map<string, RelationshipEdge[]>();
allEdges.forEach((edge) => {
  for (const id of [edge.sourceCountryId, edge.targetCountryId]) {
    let list = relationshipsByCountryId.get(id);
    if (!list) { list = []; relationshipsByCountryId.set(id, list); }
    list.push(edge);
  }
});

const resolveSources = (sourceIds: string[]): DatasetSource[] => {
  return sourceIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter((source): source is DatasetSource => Boolean(source));
};

const toRelationship = (countryId: string, edge: RelationshipEdge): CountryRelationship | null => {
  const otherCountryId = edge.sourceCountryId === countryId ? edge.targetCountryId : edge.sourceCountryId;
  const otherCountry = countryById.get(otherCountryId);

  if (!otherCountry) {
    return null;
  }

  return {
    countryId: otherCountry.id,
    displayName: otherCountry.displayName,
    mapName: otherCountry.mapName,
    cooperation: edge.cooperation,
    hostility: edge.hostility,
    dependency: edge.dependency,
    deterrence: edge.deterrence,
    tension: Math.round((edge.hostility + edge.deterrence) / 2),
    notes: edge.notes,
    lastUpdated: edge.lastUpdated,
    sources: resolveSources(edge.sourceIds),
  };
};

const buildRelationships = (countryId: string) => {
  return (relationshipsByCountryId.get(countryId) ?? [])
    .map((edge) => toRelationship(countryId, edge))
    .filter((relationship): relationship is CountryRelationship => Boolean(relationship))
    .sort((left, right) => right.tension - left.tension);
};

const getYear = (isoDate: string) => {
  const year = Number.parseInt(isoDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : 0;
};

const nowYear = new Date().getUTCFullYear();
const DATA_QUALITY_STALE_YEARS = 2;
const DATA_QUALITY_MIN_CONFIDENCE = 35;
const DATA_QUALITY_MAX_CONFIDENCE = 95;
const DATA_QUALITY_STALE_CONFIDENCE_PENALTY = 7;
const DATA_QUALITY_SOURCE_COVERAGE_THRESHOLD = 70;
const INDICATOR_KEYS: (keyof CountryIndicators)[] = [
  'tradeExposure',
  'militaryTreatyLevel',
  'conflictPressure',
  'sanctionsExposure',
  'ideology',
  'borderDisputes',
  'regimeStability',
  'conflictHistory',
  'tradeDependence',
  'cohesion',
];

const getDataQualityGaps = (country: CountryRecord): string[] => {
  const gaps: string[] = [];
  if (!country.demographics) gaps.push('missing demographic enrichment');
  if (!country.energy) gaps.push('missing energy enrichment');
  if (!country.topTradePartners?.length) gaps.push('missing top trade partner enrichment');
  if (!country.cyber || !country.fiscal || !country.foodWater || !country.diplomatic) {
    gaps.push('missing v11 strategic-dimension enrichment');
  }
  return gaps;
};

const deriveCountryDataQuality = (country: CountryRecord) => {
  const yearsStale = Math.max(0, nowYear - getYear(country.lastUpdated));
  const stale = yearsStale > DATA_QUALITY_STALE_YEARS;
  const defaultSourceId = country.sourceIds[0] ?? 'phase1-estimates';
  const confidence = Math.max(
    DATA_QUALITY_MIN_CONFIDENCE,
    Math.min(
      DATA_QUALITY_MAX_CONFIDENCE,
      Math.round(country.sourceCoverage - yearsStale * DATA_QUALITY_STALE_CONFIDENCE_PENALTY),
    ),
  );
  // Normalize to [0, 1] so telemetry consumers (display, pipeline reconcile) see a
  // consistent decimal confidence rather than a raw percentage integer.
  const confidenceDecimal = confidence / 100;
  const indicators: IndicatorTelemetry[] = INDICATOR_KEYS.map((indicator) => ({
    sourceId: defaultSourceId,
    observedAt: country.lastUpdated,
    confidence: confidenceDecimal,
    stale,
    method: 'expert-curated',
    evidenceClass: stale ? 'fallback' : 'estimated',
    indicator,
  }));

  const degradedReasons: string[] = [];
  if (stale) degradedReasons.push(`country snapshot is ${yearsStale} years old`);
  if (country.sourceCoverage < DATA_QUALITY_SOURCE_COVERAGE_THRESHOLD) {
    degradedReasons.push(
      `source coverage below recommended threshold (${DATA_QUALITY_SOURCE_COVERAGE_THRESHOLD})`,
    );
  }
  degradedReasons.push(...getDataQualityGaps(country));

  return {
    computedSourceCoverage: country.sourceCoverage,
    computedLastUpdated: country.lastUpdated,
    degradedReasons,
    indicators,
  };
};

const baseCountries = enhancedCountries
  .map<CountryProfile>((country) => ({
    ...country,
    historicalSeries: historicalSeriesByCountryId[country.id] ?? [],
    sources: resolveSources(country.sourceIds),
    relationships: buildRelationships(country.id),
    dataQuality: deriveCountryDataQuality(country),
  }))
  .sort((left, right) => left.displayName.localeCompare(right.displayName));

// Bootstrap through the source pipeline with ingest + curated fallbacks so first
// paint already has high indicator coverage before the live WB fetch returns.
// Live enrichment in App re-runs the same pipeline with API data on top.
const countries = enrichProfilesWithSourcePipeline(baseCountries, emptyLiveData());

export const datasetVersion = '0.15.0';
export const methodologyNotes = [
  ...dataset.methodologyNotes,
  'v11 (data enhancement): adds cyber, fiscal, food/water, diplomatic, critical-mineral and soft-power dimensions for G20 plus ~50 strategic mid-tier powers.',
  'v11 also backfills demographics, energy posture, top trade partners and geo centroids for all parameterised states.',
  'v11 derives ~hundreds of additional relationship edges from top trade-partner shares, shared defense pacts and IGO memberships, and opposing-bloc anchors. Derived edges are tagged sourceId="v11-derived" and ranked below explicit ones in pipeline reconciliation.',
  'v12 (information quality): computes per-country information scores based on source coverage, dimensional completeness, and recency to spotlight stale or sparse records.',
  'v12 also emits per-country dataQuality telemetry (indicator confidence, staleness, and degraded reasons) to make remediation workflows explicit.',
  'v13 (coverage expansion): adds cyber, fiscal, food/water, diplomatic, critical-mineral and soft-power dimensions for 88 additional countries, bringing strategic-dimension coverage to all 134 parameterised states.',
  'v14 (coverage refresh): refreshes selected v10/v11 country enrichments with 2025–2026 snapshots, tightens reconciliation confidence floors, and introduces explicit release acceptance criteria for coverage, recency, confidence, and relationship completeness.',
  'v15 (coverage density): World Bank ingest uses a 10-year MRV window with newest-year selection; curated economic/military stats fill remaining gaps (Taiwan, sparse reporters); conflict/sanctions reaffirmations stay fresh; live + ingest series merge into economic/military snapshots.',
];
export const scenarioTimeline = dataset.scenarioTimeline;
export const countryProfiles = countries;
export const allianceNetworks = Array.from(new Set(countries.map((country) => country.allianceNetwork))).sort();

// Coverage telemetry — exposed so the UI can surface dataset growth in the
// methodology panel.
export const datasetTelemetry = {
  countries: countries.length,
  explicitRelationships: dataset.relationships.length,
  derivedRelationships: derivedEdges.length,
  totalRelationships: allEdges.length,
  v10Coverage: countries.filter((c) => Boolean(c.demographics)).length,
  v11Coverage: countries.filter((c) => Boolean(c.cyber)).length,
};

export const informationQualityTelemetry: InformationQualityTelemetry = {
  ...buildInformationQualityTelemetry(countries, { layer: 'static-at-build' }),
};
export const informationQualityContract = INFORMATION_QUALITY_CONTRACT;

const ingestIndicators = ingestManifest.indicators as IngestIndicatorTelemetry[];

export const ingestTelemetry: IngestTelemetry = {
  generatedAt: ingestManifest.generatedAt,
  provider: ingestManifest.provider,
  requestedCountryCount: ingestManifest.requestedCountryCount,
  averageCoveragePct:
    ingestIndicators.length === 0
      ? 0
      : Math.round(
          (ingestIndicators.reduce(
            (sum, indicator) => sum + indicator.coverageCount / ingestManifest.requestedCountryCount,
            0,
          ) /
            ingestIndicators.length) *
            1000,
        ) / 10,
  strongestIndicators: ingestIndicators
    .slice()
    .sort((left, right) => right.coverageCount - left.coverageCount || left.label.localeCompare(right.label))
    .slice(0, 4),
  weakestIndicators: ingestIndicators
    .slice()
    .sort((left, right) => left.coverageCount - right.coverageCount || left.label.localeCompare(right.label))
    .slice(0, 4),
};

const V14_ACCEPTANCE_CRITERIA = {
  minimumV10CoveragePct: 95,
  minimumV11CoveragePct: 95,
  minimumAverageInformationScore: 65,
  minimumIndicatorConfidenceFloor: 0.35,
  maximumStaleCountries: 30,
  minimumAverageRelationshipsPerCountry: 2,
  maximumIsolatedCountries: 0,
} as const;

const allIndicatorConfidenceValues = countries.flatMap((country) =>
  country.dataQuality?.indicators.map((indicator) => indicator.confidence) ?? [],
);
const indicatorConfidenceFloorBreaches = allIndicatorConfidenceValues.filter(
  (confidence) => confidence < V14_ACCEPTANCE_CRITERIA.minimumIndicatorConfidenceFloor,
).length;
const averageRelationshipsPerCountry = Math.round((allEdges.length * 2 * 10) / countries.length) / 10;
const isolatedCountries = countries.filter((country) => country.relationships.length === 0).length;
const v10CoveragePct = Math.round((datasetTelemetry.v10Coverage / countries.length) * 1000) / 10;
const v11CoveragePct = Math.round((datasetTelemetry.v11Coverage / countries.length) * 1000) / 10;

const enhancementReleaseStatus: EnhancementReleaseTelemetry['status'] = {
  v10CoveragePct,
  v11CoveragePct,
  averageInformationScore: informationQualityTelemetry.averageInformationScore,
  staleCountryCount: informationQualityTelemetry.staleCountryCount,
  indicatorConfidenceFloorBreaches,
  averageRelationshipsPerCountry,
  isolatedCountries,
  meetsV10Coverage: v10CoveragePct >= V14_ACCEPTANCE_CRITERIA.minimumV10CoveragePct,
  meetsV11Coverage: v11CoveragePct >= V14_ACCEPTANCE_CRITERIA.minimumV11CoveragePct,
  meetsAverageInformationScore:
    informationQualityTelemetry.averageInformationScore >= V14_ACCEPTANCE_CRITERIA.minimumAverageInformationScore,
  meetsStaleCountryBudget:
    informationQualityTelemetry.staleCountryCount <= V14_ACCEPTANCE_CRITERIA.maximumStaleCountries,
  meetsIndicatorConfidenceFloor: indicatorConfidenceFloorBreaches === 0,
  meetsRelationshipCompleteness:
    averageRelationshipsPerCountry >= V14_ACCEPTANCE_CRITERIA.minimumAverageRelationshipsPerCountry &&
    isolatedCountries <= V14_ACCEPTANCE_CRITERIA.maximumIsolatedCountries,
};

export const enhancementReleaseTelemetry: EnhancementReleaseTelemetry = {
  releaseTag: 'v15',
  scope: 'coverage-density',
  datasetVersion,
  criteria: { ...V14_ACCEPTANCE_CRITERIA },
  status: enhancementReleaseStatus,
  releaseAccepted:
    enhancementReleaseStatus.meetsV10Coverage &&
    enhancementReleaseStatus.meetsV11Coverage &&
    enhancementReleaseStatus.meetsAverageInformationScore &&
    enhancementReleaseStatus.meetsStaleCountryBudget &&
    enhancementReleaseStatus.meetsIndicatorConfidenceFloor &&
    enhancementReleaseStatus.meetsRelationshipCompleteness,
};

// O(1) lookup maps for country access
const countryByMapName = new Map(countries.map((c) => [c.mapName, c]));
const countryByIdMap = new Map(countries.map((c) => [c.id, c]));

export const getCountryByMapName = (mapName: string) => countryByMapName.get(mapName);
export const getCountryById = (countryId: string) => countryByIdMap.get(countryId);

export const getCountryRelationships = (countryId: string) => {
  return getCountryById(countryId)?.relationships ?? [];
};

export const getCountryMap = () => countryByMapName;

export const getCountryRecords = (): CountryRecord[] => countries;
