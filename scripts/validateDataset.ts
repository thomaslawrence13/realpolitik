import { geopoliticalDatasetV1 } from '../src/data/datasets/v1.js';
import {
  countryProfiles,
  datasetTelemetry,
  datasetVersion,
  enhancementReleaseTelemetry,
  informationQualityTelemetry,
} from '../src/data/countryData.js';
import ingestManifest from '../src/data/datasets/ingest_manifest.json';
import ingestedSnapshot from '../src/data/datasets/ingested_snapshot.json';
import imfWeoSnapshot from '../src/data/datasets/imf_weo_snapshot.json';
import rawWorldBankLatest from '../src/data/datasets/raw/world_bank_latest.json';

const errors: string[] = [];
const warnings: string[] = [];

const addError = (message: string) => {
  errors.push(message);
};

const ensure = (condition: boolean, message: string) => {
  if (!condition) addError(message);
};

const addWarning = (message: string) => {
  warnings.push(message);
};

const ensureWarn = (condition: boolean, message: string) => {
  if (!condition) addWarning(message);
};

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const currentYear = new Date().getUTCFullYear();
const STALE_COUNTRY_YEAR_CEILING = 6;
const LOW_COVERAGE_WARN_THRESHOLD = 55;
const LOW_COVERAGE_ERROR_THRESHOLD = 35;
const LOW_COVERAGE_ERROR_BUDGET = 8;
const MIN_INDICATOR_CONFIDENCE_FLOOR = 0.35;
const MIN_AVG_RELATIONSHIPS_PER_COUNTRY = 2;
const MAX_ISOLATED_COUNTRIES = 0;

const validateTimeline = () => {
  const timeline = geopoliticalDatasetV1.scenarioTimeline;
  ensure(timeline.length > 0, 'scenarioTimeline must not be empty');
  const unique = new Set(timeline);
  ensure(unique.size === timeline.length, 'scenarioTimeline contains duplicate periods');
  for (let i = 0; i < timeline.length; i++) {
    const period = timeline[i]!;
    ensure(/^\d{4}$/.test(period), `scenarioTimeline period "${period}" must be YYYY`);
    if (i > 0) {
      const prev = Number.parseInt(timeline[i - 1]!, 10);
      const current = Number.parseInt(period, 10);
      ensure(current > prev, `scenarioTimeline must be strictly increasing (${timeline[i - 1]} -> ${period})`);
    }
  }
};

const validateSources = () => {
  const sources = geopoliticalDatasetV1.sources;
  const ids = new Set<string>();
  for (const source of sources) {
    ensure(source.id.length > 0, 'source.id must be non-empty');
    ensure(source.title.length > 0, `source "${source.id}" title must be non-empty`);
    ensure(source.publisher.length > 0, `source "${source.id}" publisher must be non-empty`);
    ensure(/^https?:\/\//.test(source.url), `source "${source.id}" url must be absolute`);
    ensure(isIsoDate(source.accessedOn), `source "${source.id}" accessedOn must be YYYY-MM-DD`);
    if (ids.has(source.id)) addError(`duplicate source id "${source.id}"`);
    ids.add(source.id);
  }
};

const validateCountries = () => {
  const countries = geopoliticalDatasetV1.countries;
  const countryIds = new Set<string>();
  const mapNames = new Set<string>();
  const sourceIds = new Set(geopoliticalDatasetV1.sources.map((source) => source.id));
  let veryLowCoverageCount = 0;

  for (const country of countries) {
    if (countryIds.has(country.id)) addError(`duplicate country id "${country.id}"`);
    countryIds.add(country.id);
    if (mapNames.has(country.mapName)) addError(`duplicate mapName "${country.mapName}"`);
    mapNames.add(country.mapName);

    ensure(country.displayName.length > 0, `country "${country.id}" displayName is required`);
    ensure(country.region.length > 0, `country "${country.id}" region is required`);
    ensure(country.subregion.length > 0, `country "${country.id}" subregion is required`);
    ensure(country.sourceIds.length > 0, `country "${country.id}" must reference at least one source`);
    ensure(country.lastUpdated.length > 0, `country "${country.id}" lastUpdated is required`);
    ensure(isIsoDate(country.lastUpdated), `country "${country.id}" lastUpdated must be YYYY-MM-DD`);
    ensure(country.baselineRisk >= 0 && country.baselineRisk <= 100, `country "${country.id}" baselineRisk out of [0,100]`);
    ensure(country.sourceCoverage >= 0 && country.sourceCoverage <= 100, `country "${country.id}" sourceCoverage out of [0,100]`);

    const updatedYear = Number.parseInt(country.lastUpdated.slice(0, 4), 10);
    const yearsOld = Number.isFinite(updatedYear) ? currentYear - updatedYear : Number.NaN;
    if (Number.isFinite(yearsOld)) {
      ensureWarn(
        yearsOld <= STALE_COUNTRY_YEAR_CEILING,
        `country "${country.id}" appears stale (${yearsOld}y old > ${STALE_COUNTRY_YEAR_CEILING}y ceiling)`,
      );
    }
    if (country.sourceCoverage < LOW_COVERAGE_WARN_THRESHOLD) {
      ensureWarn(
        false,
        `country "${country.id}" low sourceCoverage (${country.sourceCoverage}% < ${LOW_COVERAGE_WARN_THRESHOLD}%)`,
      );
    }
    if (country.sourceCoverage < LOW_COVERAGE_ERROR_THRESHOLD) veryLowCoverageCount += 1;

    for (const sourceId of country.sourceIds) {
      ensure(sourceIds.has(sourceId), `country "${country.id}" references unknown source "${sourceId}"`);
    }
  }
  ensure(
    veryLowCoverageCount <= LOW_COVERAGE_ERROR_BUDGET,
    `very-low coverage countries exceed budget (${veryLowCoverageCount} > ${LOW_COVERAGE_ERROR_BUDGET}, threshold ${LOW_COVERAGE_ERROR_THRESHOLD}%)`,
  );
};

const validateRelationships = () => {
  const countries = new Set(geopoliticalDatasetV1.countries.map((country) => country.id));
  const pairKeys = new Set<string>();
  const canonicalPairKey = (left: string, right: string) =>
    left < right ? `${left}::${right}` : `${right}::${left}`;
  for (const edge of geopoliticalDatasetV1.relationships) {
    ensure(countries.has(edge.sourceCountryId), `relationship source "${edge.sourceCountryId}" not found in countries`);
    ensure(countries.has(edge.targetCountryId), `relationship target "${edge.targetCountryId}" not found in countries`);
    ensure(edge.sourceCountryId !== edge.targetCountryId, `relationship cannot self-reference "${edge.sourceCountryId}"`);
    ensure(isIsoDate(edge.lastUpdated), `relationship "${edge.sourceCountryId}::${edge.targetCountryId}" lastUpdated must be YYYY-MM-DD`);
    ensure(edge.sourceIds.length > 0, `relationship "${edge.sourceCountryId}::${edge.targetCountryId}" must reference at least one source`);
    for (const value of [edge.cooperation, edge.hostility, edge.dependency, edge.deterrence]) {
      ensure(value >= 0 && value <= 100, `relationship "${edge.sourceCountryId}::${edge.targetCountryId}" has dimension outside [0,100]`);
    }
    const key = canonicalPairKey(edge.sourceCountryId, edge.targetCountryId);
    if (pairKeys.has(key)) addError(`duplicate relationship pair "${key}"`);
    pairKeys.add(key);
  }
};

type ManifestIndicator = {
  snapshotKey: string;
  code: string;
  label: string;
  coverageCount: number;
  missingCountryCount: number;
  newestObservation: string | null;
};

type ManifestSource = {
  sourceId: string;
  provider: string;
  requestedCountryCount: number;
  indicators: ManifestIndicator[];
};

type IngestManifest = {
  generatedAt: string;
  requestedCountryCount: number;
  /** Flat union of every source's indicators, retained for v1 readers. */
  indicators: ManifestIndicator[];
  /** Per-source breakdown. Absent on manifests written before v2. */
  sources?: ManifestSource[];
};

type IngestedSnapshot = Record<string, unknown> & {
  timestamp: string;
  countryCountRequested?: number;
};

type RawWorldBankPoint = {
  country: { id: string };
  date: string;
  value: number | null;
};

type RawWorldBankAudit = {
  fetchedAt: string;
  indicators?: Record<string, RawWorldBankPoint[]>;
};

const validateIngestArtifacts = () => {
  const manifest = ingestManifest as IngestManifest;
  const snapshot = ingestedSnapshot as IngestedSnapshot;
  const raw = rawWorldBankLatest as RawWorldBankAudit;

  ensure(isIsoDate(manifest.generatedAt.slice(0, 10)), 'ingest_manifest.generatedAt must be ISO timestamp');
  ensure(isIsoDate(snapshot.timestamp.slice(0, 10)), 'ingested_snapshot.timestamp must be ISO timestamp');
  ensure(manifest.requestedCountryCount > 0, 'ingest_manifest.requestedCountryCount must be > 0');
  if (snapshot.countryCountRequested != null) {
    ensure(
      snapshot.countryCountRequested === manifest.requestedCountryCount,
      `ingested_snapshot.countryCountRequested (${snapshot.countryCountRequested}) must equal ingest_manifest.requestedCountryCount (${manifest.requestedCountryCount})`,
    );
  }

  const rawIndicators = raw.indicators ?? {};
  const rawCodeSet = new Set(Object.keys(rawIndicators));
  const weo = imfWeoSnapshot as IngestedSnapshot;

  ensure(isIsoDate(weo.timestamp.slice(0, 10)), 'imf_weo_snapshot.timestamp must be ISO timestamp');

  /**
   * Each source is checked against its own artifacts: World Bank indicators must
   * appear in the normalized snapshot *and* the raw audit payload, while IMF WEO
   * indicators live in their own snapshot and have no raw audit (the DataMapper
   * API returns whole series, not per-observation rows).
   */
  const sources: ManifestSource[] = manifest.sources ?? [
    {
      sourceId: 'world-bank-wdi',
      provider: 'world-bank-open-data',
      requestedCountryCount: manifest.requestedCountryCount,
      indicators: manifest.indicators,
    },
  ];

  for (const source of sources) {
    const isWorldBank = source.sourceId === 'world-bank-wdi';
    const sourceSnapshot = isWorldBank ? snapshot : weo;
    const snapshotName = isWorldBank ? 'ingested_snapshot' : 'imf_weo_snapshot';

    ensure(
      source.requestedCountryCount > 0,
      `ingest_manifest source "${source.sourceId}" must request at least one country`,
    );

    for (const indicator of source.indicators) {
      const snapshotBucket = sourceSnapshot[indicator.snapshotKey];
      ensure(
        Boolean(snapshotBucket && typeof snapshotBucket === 'object'),
        `${snapshotName} is missing indicator bucket "${indicator.snapshotKey}"`,
      );
      if (snapshotBucket && typeof snapshotBucket === 'object') {
        const coverage = Object.keys(snapshotBucket as Record<string, unknown>).length;
        ensure(
          coverage === indicator.coverageCount,
          `ingest coverage mismatch for "${indicator.snapshotKey}" (snapshot=${coverage}, manifest=${indicator.coverageCount})`,
        );
        ensure(
          indicator.coverageCount + indicator.missingCountryCount === source.requestedCountryCount,
          `manifest coverage + missing mismatch for "${indicator.snapshotKey}"`,
        );
      }
      if (indicator.newestObservation !== null) {
        ensure(
          /^\d{4}$/.test(indicator.newestObservation),
          `manifest newestObservation for "${indicator.snapshotKey}" must be YYYY or null`,
        );
        if (/^\d{4}$/.test(indicator.newestObservation)) {
          const year = Number.parseInt(indicator.newestObservation, 10);
          // Some provider feeds can roll over annual labels slightly ahead of
          // calendar year-end publication, so allow a one-year future tolerance.
          ensureWarn(
            year <= currentYear + 1,
            `manifest newestObservation for "${indicator.snapshotKey}" appears in the future (${year})`,
          );
        }
      }
      if (isWorldBank) {
        ensure(rawCodeSet.has(indicator.code), `raw ingest payload missing indicator code "${indicator.code}"`);
      }
    }
  }

  // Every WEO entry must carry the year it describes — a bare value would strip
  // the provenance the snapshot exists to preserve.
  for (const [key, bucket] of Object.entries(weo)) {
    if (!key.startsWith('imf_') || !bucket || typeof bucket !== 'object') continue;
    for (const [countryId, entry] of Object.entries(bucket as Record<string, unknown>)) {
      const observation = entry as { value?: unknown; year?: unknown };
      ensure(
        typeof observation?.value === 'number' && Number.isFinite(observation.value),
        `imf_weo_snapshot "${key}.${countryId}" must carry a finite value`,
      );
      ensure(
        typeof observation?.year === 'string' && /^\d{4}$/.test(observation.year),
        `imf_weo_snapshot "${key}.${countryId}" must carry a YYYY year`,
      );
    }
  }

  for (const [code, points] of Object.entries(rawIndicators)) {
    let nullDateRows = 0;
    for (const point of points) {
      if (!/^\d{4}$/.test(point.date)) {
        ensureWarn(false, `raw ingest point for "${code}" has non-annual date "${point.date}"`);
      }
      if (point.value === null) nullDateRows += 1;
    }
    ensureWarn(
      nullDateRows <= points.length * 0.4,
      `raw ingest indicator "${code}" has high null share (${nullDateRows}/${points.length})`,
    );
  }
};

const validateEnhancementRelease = () => {
  // Check the version against the release telemetry rather than a literal: a
  // hardcoded pin goes stale on every dataset bump and then blocks the whole
  // validator, which is how this drifted to 0.15.0 while still asserting 0.14.0.
  ensure(
    /^\d+\.\d+\.\d+$/.test(datasetVersion),
    `datasetVersion must be semver (found ${datasetVersion})`,
  );
  ensure(
    datasetVersion === enhancementReleaseTelemetry.datasetVersion,
    `datasetVersion (${datasetVersion}) must match enhancementReleaseTelemetry.datasetVersion (${enhancementReleaseTelemetry.datasetVersion})`,
  );

  const v10CoveragePct = Math.round((datasetTelemetry.v10Coverage / countryProfiles.length) * 1000) / 10;
  const v11CoveragePct = Math.round((datasetTelemetry.v11Coverage / countryProfiles.length) * 1000) / 10;
  const avgRelationships = Math.round((datasetTelemetry.totalRelationships * 2 * 10) / countryProfiles.length) / 10;
  const isolatedCountries = countryProfiles.filter((country) => country.relationships.length === 0).length;
  const confidenceFloorBreaches = countryProfiles.flatMap((country) => country.dataQuality?.indicators ?? []).filter(
    (indicator) => indicator.confidence < MIN_INDICATOR_CONFIDENCE_FLOOR,
  ).length;

  ensure(
    v10CoveragePct >= enhancementReleaseTelemetry.criteria.minimumV10CoveragePct,
    `v10 coverage below release criteria (${v10CoveragePct}% < ${enhancementReleaseTelemetry.criteria.minimumV10CoveragePct}%)`,
  );
  ensure(
    v11CoveragePct >= enhancementReleaseTelemetry.criteria.minimumV11CoveragePct,
    `v11 coverage below release criteria (${v11CoveragePct}% < ${enhancementReleaseTelemetry.criteria.minimumV11CoveragePct}%)`,
  );
  ensure(
    avgRelationships >= MIN_AVG_RELATIONSHIPS_PER_COUNTRY,
    `average relationships per country below floor (${avgRelationships} < ${MIN_AVG_RELATIONSHIPS_PER_COUNTRY})`,
  );
  ensure(
    isolatedCountries <= MAX_ISOLATED_COUNTRIES,
    `isolated countries exceed budget (${isolatedCountries} > ${MAX_ISOLATED_COUNTRIES})`,
  );
  ensure(
    confidenceFloorBreaches === 0,
    `indicator confidence floor breaches found (${confidenceFloorBreaches} below ${MIN_INDICATOR_CONFIDENCE_FLOOR})`,
  );
  ensureWarn(
    informationQualityTelemetry.averageInformationScore >= enhancementReleaseTelemetry.criteria.minimumAverageInformationScore,
    `average information score below release target (${informationQualityTelemetry.averageInformationScore} < ${enhancementReleaseTelemetry.criteria.minimumAverageInformationScore})`,
  );
  ensureWarn(
    informationQualityTelemetry.staleCountryCount <= enhancementReleaseTelemetry.criteria.maximumStaleCountries,
    `stale country count above release budget (${informationQualityTelemetry.staleCountryCount} > ${enhancementReleaseTelemetry.criteria.maximumStaleCountries})`,
  );
  ensureWarn(
    enhancementReleaseTelemetry.releaseAccepted,
    `release acceptance telemetry indicates unresolved criteria for ${enhancementReleaseTelemetry.releaseTag}`,
  );
};

const main = () => {
  validateTimeline();
  validateSources();
  validateCountries();
  validateRelationships();
  validateIngestArtifacts();
  validateEnhancementRelease();

  if (errors.length > 0) {
    console.error('Dataset validation failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('Dataset quality warnings:');
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  console.log(
    `Dataset validation passed (${geopoliticalDatasetV1.countries.length} countries, ${geopoliticalDatasetV1.relationships.length} relationships, ${geopoliticalDatasetV1.scenarioTimeline.length} periods, release ${enhancementReleaseTelemetry.releaseTag}).`,
  );
};

main();
