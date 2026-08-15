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
import historicalIndicatorSeries from '../src/data/datasets/historical_indicator_series.json';
import historicalSeriesMeta from '../src/data/datasets/historical_series_meta.json';
import unGaVotes from '../src/data/datasets/un_ga_votes.json';
import ofacSanctions from '../src/data/datasets/ofac_sanctions_registry.json';
import unscSanctions from '../src/data/datasets/unsc_sanctions_registry.json';
import euSanctions from '../src/data/datasets/eu_sanctions_registry.json';
import ucdpConflict from '../src/data/datasets/ucdp_conflict.json';
import unhcrDisplacement from '../src/data/datasets/unhcr_displacement.json';
import faoFoodSecurity from '../src/data/datasets/fao_food_security.json';
import faoFoodSecurityMeta from '../src/data/datasets/fao_food_security_meta.json';
import bisFinancial from '../src/data/datasets/bis_financial.json';
import qualityHistory from '../src/data/datasets/quality_history.json';
import { indicatorSourcePriority, relationshipDimensionSourcePriority } from '../src/data/pipeline/rules.js';
import {
  countryIso2,
  WB_INDICATOR_BY_CODE,
  WB_INDICATORS,
  type WbIndicatorCode,
} from '../src/lib/worldBankFetch.js';
import {
  HISTORICAL_SERIES_CODES,
  summarizeHistoricalSeriesArtifact,
  type HistoricalSeriesArtifact,
  type HistoricalSeriesMeta,
} from '../src/lib/historicalSeriesArtifact.js';
import { SOURCE_REGISTRY } from '../src/data/sourceRegistry.js';
import { ARTIFACT_IDS, describeArtifacts } from '../src/data/artifactRegistry.js';
import { QUALITY_HISTORY_LIMIT, readQualityHistory } from '../src/lib/qualityHistory.js';
import { summarizeFaoArtifact, type FaoFoodSecurityArtifact } from '../src/lib/faoFoodSecurity.js';
import { RAW_AUDIT_FILENAME, readRawAudit } from '../src/lib/rawAudit.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const validateSourceReferenceParity = () => {
  const registeredSourceIds = new Set(geopoliticalDatasetV1.sources.map((source) => source.id));
  const assertRegistered = (sourceId: string, owner: string) => {
    ensure(registeredSourceIds.has(sourceId), `${owner} references unregistered source "${sourceId}"`);
  };

  for (const [indicator, sourceIds] of Object.entries(indicatorSourcePriority)) {
    sourceIds.forEach((sourceId) => assertRegistered(sourceId, `indicator priority "${indicator}"`));
  }
  for (const [dimension, sourceIds] of Object.entries(relationshipDimensionSourcePriority)) {
    sourceIds.forEach((sourceId) => assertRegistered(sourceId, `relationship priority "${dimension}"`));
  }
  for (const indicator of WB_INDICATORS) {
    assertRegistered(indicator.provenanceSourceId, `World Bank indicator "${indicator.code}"`);
  }
};

/**
 * Provenance parity: the static dataset registry (`v1.ts`), the runtime source
 * registry (`sourceRegistry.ts`) and the World Bank indicator table must agree
 * on who published a series.
 *
 * The failure this exists to catch is WGI drift. Governance series are fetched
 * from World Bank API catalogue source 3 under a `GOV_WGI_` wire code, but they
 * are published as the Worldwide Governance Indicators — not WDI. Tagging them
 * `world-bank-wdi` credits the wrong compilation to the reader and quietly
 * changes which cadence and lag the quality contract applies. The rule is
 * mechanical, so it belongs in the gate rather than in review.
 */
const validateProvenanceRegistryParity = () => {
  const staticSourceIds = new Set(geopoliticalDatasetV1.sources.map((source) => source.id));
  const runtimeSourceIds = new Set(Object.keys(SOURCE_REGISTRY));

  for (const sourceId of staticSourceIds) {
    ensure(
      runtimeSourceIds.has(sourceId),
      `source "${sourceId}" is in the dataset registry but missing from SOURCE_REGISTRY`,
    );
  }
  for (const sourceId of runtimeSourceIds) {
    ensure(
      staticSourceIds.has(sourceId),
      `source "${sourceId}" is in SOURCE_REGISTRY but missing from the dataset registry`,
    );
  }
  // Publisher names are now a hard gate rather than a warning. As a warning it
  // sat in the output of every validation run for long enough to become
  // scenery — four sources drifted between an abbreviation and a full name, and
  // a reader comparing "UCDP" on a country card with "Uppsala Conflict Data
  // Program" in the methodology drawer has no way to tell they are one source.
  // `sourceRegistry.ts` is the authority: it is what the provenance copy reads.
  for (const source of geopoliticalDatasetV1.sources) {
    const descriptor = SOURCE_REGISTRY[source.id];
    if (!descriptor) continue;
    ensure(
      descriptor.publisher === source.publisher,
      `source "${source.id}" publisher differs between registries ("${source.publisher}" in v1.ts vs ` +
        `"${descriptor.publisher}" in sourceRegistry.ts) — sourceRegistry.ts is the authority`,
    );
  }

  for (const indicator of WB_INDICATORS) {
    const isGovernanceSeries = indicator.apiSourceId === '3' || indicator.requestCode.startsWith('GOV_WGI_');
    const expectedSourceId = isGovernanceSeries ? 'world-bank-wgi' : 'world-bank-wdi';
    ensure(
      indicator.provenanceSourceId === expectedSourceId,
      `World Bank indicator "${indicator.code}" is tagged "${indicator.provenanceSourceId}" but ` +
        `${isGovernanceSeries ? 'is fetched from the WGI catalogue (source 3)' : 'is a WDI series'} — ` +
        `expected "${expectedSourceId}"`,
    );
    ensure(
      SOURCE_REGISTRY[indicator.provenanceSourceId] !== undefined,
      `World Bank indicator "${indicator.code}" references unregistered runtime source "${indicator.provenanceSourceId}"`,
    );
  }

  // Both World Bank compilations must be described, since the two now carry
  // different cadence and lag in the quality contract.
  for (const sourceId of ['world-bank-wdi', 'world-bank-wgi'] as const) {
    ensure(runtimeSourceIds.has(sourceId), `SOURCE_REGISTRY is missing "${sourceId}"`);
    ensure(staticSourceIds.has(sourceId), `dataset registry is missing "${sourceId}"`);
  }
};

/**
 * Artifact register parity: every committed artifact is described, dated from
 * its own payload, and pointed at a file that exists. Registry descriptors
 * count publishers; this register counts retrievals, and a drift between the
 * two is exactly how "21 sources" gets misread as "21 feeds".
 */
const validateArtifactRegister = () => {
  const registeredSourceIds = new Set(geopoliticalDatasetV1.sources.map((source) => source.id));
  const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../..');

  const artifactFetchedAt: Record<string, string> = {
    'unga-votes': unGaVotes.fetchedAt,
    'ofac-sdn': ofacSanctions.fetchedAt,
    'unsc-consolidated': unscSanctions.fetchedAt,
    'eu-financial-sanctions': euSanctions.fetchedAt,
    'ucdp-organized-violence': ucdpConflict.fetchedAt,
    'unhcr-displacement': unhcrDisplacement.fetchedAt,
    'fao-food-security': faoFoodSecurityMeta.fetchedAt,
    'bis-financial': bisFinancial.fetchedAt,
    'world-bank-history': (historicalIndicatorSeries as { fetchedAt: string }).fetchedAt,
  };

  // The register reads the history sidecar rather than the ~677 KB payload, so
  // the two must be regenerated together. Everything below compares the sidecar
  // against the real artifact.
  const historySummary = summarizeHistoricalSeriesArtifact(
    historicalIndicatorSeries as unknown as HistoricalSeriesArtifact,
  );
  const committedHistoryMeta = historicalSeriesMeta as HistoricalSeriesMeta;
  ensure(
    committedHistoryMeta.fetchedAt === historySummary.fetchedAt,
    `historical_series_meta.json stamp ${committedHistoryMeta.fetchedAt} disagrees with the series artifact ` +
      `(${historySummary.fetchedAt}) — run npm run history:build`,
  );
  ensure(
    committedHistoryMeta.countryCount === historySummary.countryCount &&
      committedHistoryMeta.observationCount === historySummary.observationCount,
    `historical_series_meta.json coverage (${committedHistoryMeta.countryCount} countries / ` +
      `${committedHistoryMeta.observationCount} observations) disagrees with the series artifact ` +
      `(${historySummary.countryCount} / ${historySummary.observationCount})`,
  );
  ensure(
    committedHistoryMeta.indicatorCodes.join(',') === historySummary.indicatorCodes.join(','),
    'historical_series_meta.json indicator list disagrees with the series artifact',
  );

  ensure(
    ARTIFACT_IDS.length === Object.keys(artifactFetchedAt).length,
    `artifact register describes ${ARTIFACT_IDS.length} artifacts but validation knows ${Object.keys(artifactFetchedAt).length}`,
  );

  for (const row of describeArtifacts()) {
    ensure(fs.existsSync(path.join(repoRoot, row.path)), `artifact "${row.id}" path missing: ${row.path}`);
    ensure(
      row.fetchedAt === artifactFetchedAt[row.id],
      `artifact "${row.id}" register stamp ${row.fetchedAt} disagrees with the committed payload`,
    );
    ensure(isIsoDate(row.retrievedOn), `artifact "${row.id}" fetchedAt must be an ISO timestamp`);
    ensure(
      row.warnAfterDays < row.budgetDays,
      `artifact "${row.id}" warn tip (${row.warnAfterDays}d) must precede its budget (${row.budgetDays}d)`,
    );
    ensure(
      row.status !== 'stale',
      `artifact "${row.id}" is ${row.ageDays}d old, past its ${row.budgetDays}d budget — run ${row.refreshCommand}`,
    );
    ensureWarn(
      row.status === 'fresh',
      `artifact "${row.id}" is ${row.ageDays}d old (warn tip ${row.warnAfterDays}d) — schedule ${row.refreshCommand}`,
    );
    if (row.sourceId !== null) {
      ensure(
        registeredSourceIds.has(row.sourceId),
        `artifact "${row.id}" credits unregistered source "${row.sourceId}"`,
      );
    }
  }

  // Country coverage claimed by the register must match the payloads, so a
  // silently truncated refresh cannot keep reporting yesterday's reach.
  const registerById = new Map(describeArtifacts().map((row) => [row.id, row]));
  ensure(
    registerById.get('ucdp-organized-violence')?.countryCount === Object.keys(ucdpConflict.perCountry).length,
    'artifact register UCDP country count disagrees with the artifact',
  );
  ensure(
    registerById.get('ofac-sdn')?.countryCount === Object.keys(ofacSanctions.perCountry).length,
    'artifact register OFAC country count disagrees with the artifact',
  );
  ensure(
    registerById.get('unga-votes')?.countryCount === Object.keys(unGaVotes.perCountry).length,
    'artifact register UNGA country count disagrees with the artifact',
  );
  ensure(
    registerById.get('unsc-consolidated')?.countryCount === Object.keys(unscSanctions.perCountry).length,
    'artifact register UN SC country count disagrees with the artifact',
  );
  ensure(
    registerById.get('unhcr-displacement')?.countryCount === Object.keys(unhcrDisplacement.perCountry).length,
    'artifact register UNHCR country count disagrees with the artifact',
  );
  ensure(
    faoFoodSecurity.countryCount === Object.keys(faoFoodSecurity.perCountry).length,
    'FAOSTAT countryCount disagrees with its own perCountry map',
  );
  // The register reads the sidecar rather than the ~115 KB payload, so the two
  // must be regenerated together — the same parity rule the historical series
  // sidecar carries.
  {
    const summary = summarizeFaoArtifact(faoFoodSecurity as unknown as FaoFoodSecurityArtifact);
    ensure(
      faoFoodSecurityMeta.fetchedAt === summary.fetchedAt,
      `fao_food_security_meta.json stamp ${faoFoodSecurityMeta.fetchedAt} disagrees with the artifact ` +
        `(${summary.fetchedAt}) — run npm run refresh:fao`,
    );
    ensure(
      faoFoodSecurityMeta.countryCount === summary.countryCount &&
        faoFoodSecurityMeta.newestPeriodEndYear === summary.newestPeriodEndYear,
      `fao_food_security_meta.json coverage (${faoFoodSecurityMeta.countryCount} countries / newest ` +
        `${faoFoodSecurityMeta.newestPeriodEndYear}) disagrees with the artifact (${summary.countryCount} / ` +
        `${summary.newestPeriodEndYear})`,
    );
    ensure(
      faoFoodSecurityMeta.indicators.map((indicator) => indicator.key).join(',') ===
        summary.indicators.map((indicator) => indicator.key).join(','),
      'fao_food_security_meta.json indicator list disagrees with the artifact',
    );
  }
  // FAO periods are three-year averages as often as single years. The label is
  // the honesty mechanism, so an empty or non-year period must fail rather than
  // reach the UI where it would read as an unlabelled current figure.
  for (const [iso, summary] of Object.entries(faoFoodSecurity.perCountry)) {
    for (const [key, observation] of Object.entries(summary)) {
      ensure(
        /\d{4}/.test(observation.period),
        `FAOSTAT ${iso}/${key} has no reference period ("${observation.period}")`,
      );
      ensure(
        Number.isFinite(observation.value),
        `FAOSTAT ${iso}/${key} value is not finite`,
      );
    }
  }

  // The UN SC list is aggregated by regime, so its country buckets must never
  // add up to more than the list itself — a mapping bug that double-counted a
  // listing across regimes would otherwise look like a larger sanctions
  // footprint rather than an arithmetic error.
  const unscAttributed = Object.values(unscSanctions.perCountry).reduce(
    (sum, row) => sum + row.listingCount,
    0,
  );
  const unscThematic = unscSanctions.thematicRegimes.reduce((sum, row) => sum + row.listingCount, 0);
  ensure(
    unscAttributed + unscThematic === unscSanctions.listingTotal,
    `UN SC listings do not reconcile: ${unscAttributed} attributed + ${unscThematic} thematic ` +
      `!= ${unscSanctions.listingTotal} total`,
  );
  ensure(
    unscSanctions.individualTotal + unscSanctions.entityTotal === unscSanctions.listingTotal,
    'UN SC individual + entity totals do not equal the listing total',
  );

  ensure(
    registerById.get('eu-financial-sanctions')?.countryCount === Object.keys(euSanctions.perCountry).length,
    'artifact register EU country count disagrees with the artifact',
  );
  ensure(
    euSanctions.personTotal + euSanctions.enterpriseTotal === euSanctions.listingTotal,
    'EU person + entity totals do not equal the designation total',
  );
  // EU designations are attributed per country of citizenship or registration,
  // so the per-country buckets legitimately exceed the list size (dual
  // nationals, multi-country entities). What must hold is that no country
  // exceeds the total, and that unattributed designations are accounted for
  // rather than quietly dropped.
  ensure(
    Object.values(euSanctions.perCountry).every((row) => row.listingCount <= euSanctions.listingTotal),
    'an EU country bucket exceeds the total designation count',
  );
  ensure(
    euSanctions.unattributedTotal >= 0 && euSanctions.unattributedTotal < euSanctions.listingTotal,
    `EU unattributed total ${euSanctions.unattributedTotal} is not a subset of ${euSanctions.listingTotal} designations`,
  );
};

/**
 * The retained quality series is only useful if it is actually a series: one
 * entry per day, in order, within the retention limit. A duplicated day would
 * make a single busy CI day look like a week of movement.
 */
const validateQualityHistory = () => {
  const history = readQualityHistory(qualityHistory);
  ensure(history.entries.length > 0, 'quality_history.json is empty — run npm run quality:report');
  ensure(
    history.entries.length <= QUALITY_HISTORY_LIMIT,
    `quality history holds ${history.entries.length} entries, past the ${QUALITY_HISTORY_LIMIT} retention limit`,
  );

  const days = history.entries.map((entry) => entry.day);
  ensure(new Set(days).size === days.length, 'quality history contains duplicate days');
  ensure(
    days.every((day) => isIsoDate(day)),
    'quality history entries must be stamped with ISO days',
  );
  ensure(
    days.every((day, index) => index === 0 || days[index - 1]! < day),
    'quality history entries are not in ascending day order',
  );
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
  const sourceIds = new Set(geopoliticalDatasetV1.sources.map((source) => source.id));
  const pairKeys = new Set<string>();
  const canonicalPairKey = (left: string, right: string) =>
    left < right ? `${left}::${right}` : `${right}::${left}`;
  for (const edge of geopoliticalDatasetV1.relationships) {
    ensure(countries.has(edge.sourceCountryId), `relationship source "${edge.sourceCountryId}" not found in countries`);
    ensure(countries.has(edge.targetCountryId), `relationship target "${edge.targetCountryId}" not found in countries`);
    ensure(edge.sourceCountryId !== edge.targetCountryId, `relationship cannot self-reference "${edge.sourceCountryId}"`);
    ensure(isIsoDate(edge.lastUpdated), `relationship "${edge.sourceCountryId}::${edge.targetCountryId}" lastUpdated must be YYYY-MM-DD`);
    ensure(edge.sourceIds.length > 0, `relationship "${edge.sourceCountryId}::${edge.targetCountryId}" must reference at least one source`);
    for (const sourceId of edge.sourceIds) {
      ensure(
        sourceIds.has(sourceId),
        `relationship "${edge.sourceCountryId}::${edge.targetCountryId}" references unknown source "${sourceId}"`,
      );
    }
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
  sourceId?: string;
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
  indicators: ManifestIndicator[];
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
  const weo = imfWeoSnapshot as IngestedSnapshot;
  // The audit payload is committed gzipped (~250 KB instead of 6.4 MB), so it
  // is read and decompressed here rather than statically imported.
  const raw = readRawAudit<RawWorldBankPoint>(
    path.resolve(fileURLToPath(import.meta.url), '../../src/data/datasets/raw', RAW_AUDIT_FILENAME),
  ) as RawWorldBankAudit;

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
  const observationDates = (snapshot.observation_dates ?? {}) as Record<
    string,
    Record<string, string> | undefined
  >;
  ensure(
    Object.keys(observationDates).length > 0,
    'ingested_snapshot.observation_dates is missing — re-run `npm run ingest`',
  );
  ensure(isIsoDate(weo.timestamp.slice(0, 10)), 'imf_weo_snapshot.timestamp must be ISO timestamp');

  const sources: ManifestSource[] = manifest.sources ?? [
    {
      sourceId: 'world-bank-wdi',
      provider: 'world-bank-open-data',
      requestedCountryCount: manifest.requestedCountryCount,
      indicators: manifest.indicators,
    },
  ];
  const structuralWorldBankCodes = new Set([
    'SP.POP.TOTL',
    'SP.URB.TOTL.IN.ZS',
    'EG.IMP.CONS.ZS',
  ]);
  const worldBankDefinitionFor = (code: string) =>
    WB_INDICATOR_BY_CODE.get(code as WbIndicatorCode) ??
    WB_INDICATORS.find((definition) => definition.requestCode === code);

  for (const source of sources) {
    const isWorldBank = source.sourceId.startsWith('world-bank-');
    const sourceSnapshot = isWorldBank ? snapshot : weo;
    const snapshotName = isWorldBank ? 'ingested_snapshot' : 'imf_weo_snapshot';
    ensure(
      source.requestedCountryCount > 0,
      `ingest_manifest source "${source.sourceId}" must request at least one country`,
    );

    for (const indicator of source.indicators) {
      const effectiveSourceId = indicator.sourceId ?? source.sourceId;
      if (isWorldBank) {
        const definition = worldBankDefinitionFor(indicator.code);
        ensure(
          Boolean(definition) || structuralWorldBankCodes.has(indicator.code),
          `ingest manifest references unknown World Bank indicator code "${indicator.code}"`,
        );
        if (definition) {
          ensure(
            effectiveSourceId === definition.provenanceSourceId,
            `ingest manifest source mismatch for "${indicator.code}" (${effectiveSourceId} != ${definition.provenanceSourceId})`,
          );
        } else {
          ensure(
            effectiveSourceId === 'world-bank-wdi',
            `structural World Bank indicator "${indicator.code}" must cite world-bank-wdi`,
          );
        }
      } else {
        ensure(
          effectiveSourceId === 'imf-weo',
          `non-World-Bank ingest indicator "${indicator.code}" must cite imf-weo`,
        );
      }

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
          ensureWarn(
            year <= currentYear + 1,
            `manifest newestObservation for "${indicator.snapshotKey}" appears in the future (${year})`,
          );
        }
      }
      if (isWorldBank) {
        ensure(rawCodeSet.has(indicator.code), `raw ingest payload missing indicator code "${indicator.code}"`);
        const dates = observationDates[indicator.snapshotKey];
        ensure(
          Boolean(dates && typeof dates === 'object'),
          `ingested_snapshot.observation_dates is missing "${indicator.snapshotKey}"`,
        );
        if (dates) {
          const values = snapshot[indicator.snapshotKey] as Record<string, unknown> | undefined;
          for (const countryId of Object.keys(values ?? {})) {
            ensure(
              typeof dates[countryId] === 'string' && isIsoDate(dates[countryId]),
              `ingested_snapshot.observation_dates."${indicator.snapshotKey}.${countryId}" must be YYYY-MM-DD`,
            );
          }
        }
      }
    }
  }

  for (const [key, bucket] of Object.entries(weo)) {
    if (!key.startsWith('imf_') || !bucket || typeof bucket !== 'object') continue;
    for (const [countryId, entry] of Object.entries(bucket as Record<string, unknown>)) {
      const observation = entry as { value?: unknown; year?: unknown };
      ensure(
        typeof observation.value === 'number' && Number.isFinite(observation.value),
        `imf_weo_snapshot "${key}.${countryId}" must carry a finite value`,
      );
      ensure(
        typeof observation.year === 'string' && /^\d{4}$/.test(observation.year),
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

const validateHistoricalSeriesArtifact = () => {
  const artifact = historicalIndicatorSeries as unknown as HistoricalSeriesArtifact;
  const expectedCodes = new Set<string>(HISTORICAL_SERIES_CODES);
  const knownIsos = new Set(Object.values(countryIso2));

  ensure(artifact.schema === 2, `historical series schema must be 2 (got ${artifact.schema})`);
  ensure(isIsoDate(artifact.fetchedAt.slice(0, 10)), 'historical series fetchedAt must be ISO timestamp');
  for (const code of Object.keys(artifact.indicators)) {
    ensure(expectedCodes.has(code), `historical series contains unexpected indicator "${code}"`);
  }

  for (const code of HISTORICAL_SERIES_CODES) {
    const byIso = artifact.indicators[code];
    ensure(Boolean(byIso), `historical series missing indicator "${code}"`);
    if (!byIso) continue;
    ensure(
      Object.keys(byIso).length >= 100,
      `historical series coverage too low for "${code}" (${Object.keys(byIso).length} < 100)`,
    );

    for (const [iso, points] of Object.entries(byIso)) {
      ensure(knownIsos.has(iso), `historical series "${code}" references untracked iso "${iso}"`);
      let previousYear = '';
      for (const point of points) {
        const [year, value] = point;
        ensure(/^\d{4}$/.test(year), `historical series "${code}" ${iso} has invalid year "${year}"`);
        ensure(year > previousYear, `historical series "${code}" ${iso} years must be unique and ascending`);
        ensure(Number.isFinite(value), `historical series "${code}" ${iso} ${year} value must be finite`);
        previousYear = year;
      }
    }
  }
};

const validateEnhancementRelease = () => {
  ensure(/^\d+\.\d+\.\d+$/.test(datasetVersion), `datasetVersion must be semver (found ${datasetVersion})`);
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

type UnGaVotesArtifact = {
  fetchedAt: string;
  sourceTitle: string;
  sourceUrl: string;
  anchors: { blocA: string; blocB: string };
  sessions: string[];
  perCountry: Record<string, { blocA: number; blocB: number; rollCalls: number }>;
};

type OfacRegistryArtifact = {
  fetchedAt: string;
  sourceTitle: string;
  sourceUrl: string;
  entryTotal: number;
  perCountry: Record<
    string,
    { entryCount: number; programCount: number; topPrograms: Array<{ program: string; count: number }> }
  >;
};

type UcdpConflictArtifact = {
  fetchedAt: string;
  sourceTitle: string;
  sourceUrl: string;
  version: string;
  window: { fromYear: number; throughYear: number };
  perCountry: Record<
    string,
    {
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
    }
  >;
};

const validatePoliticalRegistries = () => {
  const votes = unGaVotes as UnGaVotesArtifact;
  const registry = ofacSanctions as OfacRegistryArtifact;
  const conflict = ucdpConflict as UcdpConflictArtifact;
  const knownIsos = new Set(Object.values(countryIso2));

  ensure(isIsoDate(votes.fetchedAt.slice(0, 10)), 'un_ga_votes.fetchedAt must be ISO timestamp');
  ensure(votes.sourceTitle.length > 0 && votes.sourceUrl.length > 0, 'un_ga_votes source metadata must be non-empty');
  ensure(/^https?:\/\//.test(votes.sourceUrl), 'un_ga_votes.sourceUrl must be absolute');
  ensure(votes.anchors.blocA.length > 0 && votes.anchors.blocB.length > 0, 'un_ga_votes anchors must be non-empty');
  ensure(votes.sessions.length >= 4, `un_ga_votes sessions too few (${votes.sessions.length} < 4)`);
  for (const session of votes.sessions) {
    ensure(/^\d{4}$/.test(session), `un_ga_votes session "${session}" must be YYYY`);
  }
  const recentYear = Math.max(...votes.sessions.map((session) => Number(session)));
  ensureWarn(
    currentYear - recentYear <= 4,
    `un_ga_votes latest session is stale (${recentYear} < ${currentYear - 4})`,
  );
  ensure(
    Object.keys(votes.perCountry).length >= 100,
    `un_ga_votes country coverage too low (${Object.keys(votes.perCountry).length} < 100)`,
  );
  const untrackedVoteIsos: string[] = [];
  for (const [iso, entry] of Object.entries(votes.perCountry)) {
    // The official CSV covers all UN members; only a subset is in our map.
    if (!knownIsos.has(iso)) untrackedVoteIsos.push(iso);
    ensure(/^[A-Z]{2}$/.test(iso), `un_ga_votes iso "${iso}" must be uppercase ISO-2`);
    ensure(entry.blocA >= 0 && entry.blocA <= 100, `un_ga_votes "${iso}" blocA out of [0,100]`);
    ensure(entry.blocB >= 0 && entry.blocB <= 100, `un_ga_votes "${iso}" blocB out of [0,100]`);
    ensure(entry.rollCalls >= 12, `un_ga_votes "${iso}" rollCalls below floor (${entry.rollCalls})`);
  }
  ensureWarn(
    untrackedVoteIsos.length === 0,
    `un_ga_votes includes ${untrackedVoteIsos.length} valid UN members outside the ${knownIsos.size}-country map ` +
      `(expected full-UN coverage; sample: ${untrackedVoteIsos.slice(0, 8).join(', ')})`,
  );

  ensure(isIsoDate(registry.fetchedAt.slice(0, 10)), 'ofac_sanctions_registry.fetchedAt must be ISO timestamp');
  ensure(registry.sourceTitle.length > 0 && registry.sourceUrl.length > 0, 'ofac registry source metadata must be non-empty');
  ensure(/^https?:\/\//.test(registry.sourceUrl), 'ofac registry sourceUrl must be absolute');
  ensure(registry.entryTotal > 0, `ofac registry entryTotal must be > 0 (got ${registry.entryTotal})`);
  ensure(
    Object.keys(registry.perCountry).length >= 10,
    `ofac registry country coverage too low (${Object.keys(registry.perCountry).length} < 10)`,
  );
  const untrackedOfacIsos: string[] = [];
  for (const [iso, entry] of Object.entries(registry.perCountry)) {
    // A country can be sanctioned without being part of our coverage map
    // (e.g. Nicaragua); the window just won't surface it.
    if (!knownIsos.has(iso)) untrackedOfacIsos.push(iso);
    ensure(/^[A-Z]{2}$/.test(iso), `ofac registry iso "${iso}" must be uppercase ISO-2`);
    ensure(entry.entryCount > 0, `ofac registry "${iso}" entryCount must be > 0`);
    ensure(entry.programCount > 0, `ofac registry "${iso}" programCount must be > 0`);
    ensure(entry.topPrograms.length >= 1, `ofac registry "${iso}" topPrograms must be non-empty`);
    ensure(
      entry.programCount >= entry.topPrograms.length,
      `ofac registry "${iso}" programCount (${entry.programCount}) below topPrograms length (${entry.topPrograms.length})`,
    );
    const programNames = new Set<string>();
    for (const top of entry.topPrograms) {
      ensure(top.program.length > 0, `ofac registry "${iso}" topProgram name must be non-empty`);
      ensure(top.count > 0, `ofac registry "${iso}" topProgram "${top.program}" count must be > 0`);
      ensure(
        top.count <= registry.entryTotal,
        `ofac registry "${iso}" topProgram "${top.program}" count (${top.count}) exceeds artifact entryTotal (${registry.entryTotal})`,
      );
      ensure(!programNames.has(top.program), `ofac registry "${iso}" duplicate topProgram "${top.program}"`);
      programNames.add(top.program);
    }
  }
  ensureWarn(
    untrackedOfacIsos.length === 0,
    `ofac registry includes ${untrackedOfacIsos.length} valid countries outside the ${knownIsos.size}-country map ` +
      `(sample: ${untrackedOfacIsos.slice(0, 8).join(', ')})`,
  );

  ensure(isIsoDate(conflict.fetchedAt.slice(0, 10)), 'ucdp_conflict.fetchedAt must be ISO timestamp');
  ensure(conflict.sourceTitle.length > 0 && conflict.sourceUrl.length > 0, 'ucdp source metadata must be non-empty');
  ensure(/^https?:\/\//.test(conflict.sourceUrl), 'ucdp sourceUrl must be absolute');
  ensure(conflict.version.length > 0, 'ucdp version must be non-empty');
  ensure(Number.isInteger(conflict.window.fromYear) && Number.isInteger(conflict.window.throughYear), 'ucdp window years must be integers');
  ensure(
    conflict.window.fromYear >= 1989 && conflict.window.throughYear >= conflict.window.fromYear,
    `ucdp window invalid (${conflict.window.fromYear}–${conflict.window.throughYear})`,
  );
  ensure(
    Object.keys(conflict.perCountry).length >= 100,
    `ucdp conflict country coverage too low (${Object.keys(conflict.perCountry).length} < 100)`,
  );
  for (const [iso, entry] of Object.entries(conflict.perCountry)) {
    ensure(knownIsos.has(iso), `ucdp conflict references unknown iso "${iso}"`);
    ensure(entry.lastYear >= conflict.window.fromYear && entry.lastYear <= conflict.window.throughYear,
      `ucdp conflict "${iso}" lastYear out of window (${entry.lastYear})`);
    ensure(entry.deathsLastYear >= 0 && entry.totalDeathsInWindow >= 0, `ucdp conflict "${iso}" negative deaths`);
    if (entry.totalDeathsInWindow === 0) {
      ensure(
        !entry.active && entry.deathsLastYear === 0,
        `ucdp conflict "${iso}" zero window deaths but active flag / deaths set`,
      );
    } else {
      ensure(entry.deathsLastYear <= entry.totalDeathsInWindow, `ucdp conflict "${iso}" window deaths inconsistent`);
    }
    // active = last-year activity; lastYear* flags mirror the final year exactly.
    ensure(
      entry.active ===
        (entry.deathsLastYear > 0 || entry.lastYearStateBased || entry.lastYearNonState || entry.lastYearOneSided),
      `ucdp conflict "${iso}" active flag disagrees with last-year signals`,
    );
    if (entry.active) {
      ensure(entry.deathsLastYear > 0 || entry.lastYearStateBased || entry.lastYearNonState || entry.lastYearOneSided,
        `ucdp conflict "${iso}" active without any last-year signal`);
    }
  }
};

const main = () => {
  validateSources();
  validateSourceReferenceParity();
  validateProvenanceRegistryParity();
  validateArtifactRegister();
  validateCountries();
  validateRelationships();
  validateIngestArtifacts();
  validateHistoricalSeriesArtifact();
  validateQualityHistory();
  validateEnhancementRelease();
  validatePoliticalRegistries();

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
    `Dataset validation passed (${geopoliticalDatasetV1.countries.length} countries, ${geopoliticalDatasetV1.relationships.length} relationships, release ${enhancementReleaseTelemetry.releaseTag}).`,
  );
};

main();
