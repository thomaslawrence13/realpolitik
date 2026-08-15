import { geopoliticalDatasetV1 } from '../src/data/datasets/v1.js';
import { datasetAsOf } from '../src/data/countryData.js';
import ingestManifest from '../src/data/datasets/ingest_manifest.json';
import { ARTIFACT_STATUS_LABEL, describeArtifacts } from '../src/data/artifactRegistry.js';

const DAY_MS = 86_400_000;

const CURATED_MAX_AGE_DAYS = 90;
const INGEST_MAX_AGE_DAYS = 90;
const INGEST_WARN_AGE_DAYS = 30;
const COUNTRY_RECORD_MAX_AGE_DAYS = 365;

const today = () => new Date().toISOString().slice(0, 10);

const daysOld = (value: string): number => {
  const diff = Date.parse(today()) - Date.parse(value);
  return Number.isFinite(diff) ? Math.max(0, Math.floor(diff / DAY_MS)) : Number.NaN;
};

const main = () => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const newestAccessed = [...geopoliticalDatasetV1.sources]
    .map((source) => source.accessedOn)
    .sort()
    .at(-1);
  if (newestAccessed) {
    const age = daysOld(newestAccessed);
    if (age > CURATED_MAX_AGE_DAYS) {
      errors.push(
        `dataset source registry is ${age}d stale (newest accessedOn ${newestAccessed}, budget ${CURATED_MAX_AGE_DAYS}d) — research pass needed.`,
      );
    }
  }

  const oldestRecord = [...geopoliticalDatasetV1.countries].sort((a, b) =>
    a.lastUpdated.localeCompare(b.lastUpdated),
  )[0];
  if (oldestRecord) {
    const age = daysOld(oldestRecord.lastUpdated);
    if (age > COUNTRY_RECORD_MAX_AGE_DAYS) {
      errors.push(
        `oldest country record is ${age}d stale (${oldestRecord.id} stamped ${oldestRecord.lastUpdated}, budget ${COUNTRY_RECORD_MAX_AGE_DAYS}d).`,
      );
    }
  }

  const generatedAt = ingestManifest.generatedAt;
  const ingestAge = daysOld(generatedAt);
  const newestObservation = ingestManifest.indicators
    .map((indicator) => indicator.newestObservation)
    .filter((year): year is string => Boolean(year))
    .sort()
    .at(-1);

  if (ingestAge > INGEST_MAX_AGE_DAYS) {
    errors.push(
      `ingest manifest is ${ingestAge}d old (generatedAt ${generatedAt.slice(0, 10)}, budget ${INGEST_MAX_AGE_DAYS}d) — run npm run ingest.`,
    );
  } else if (ingestAge > INGEST_WARN_AGE_DAYS) {
    warnings.push(
      `ingest manifest is ${ingestAge}d old (generatedAt ${generatedAt.slice(0, 10)}, warn tip ${INGEST_WARN_AGE_DAYS}d).`,
    );
  }

  if (newestObservation) {
    const obsAge = daysOld(`${newestObservation}-12-31`);
    if (obsAge > 365 * 2) {
      warnings.push(
        `newest World Bank observation is from ${newestObservation} (${obsAge}d old in annual terms) — expect rollover annually.`,
      );
    }
  }

  // Artifact budgets live in the operational artifact register, so the age CI
  // enforces here is the same number the release view shows and the same one
  // the runtime overlay gate applies. The table always prints — a refresh run
  // that changes nothing should still leave proof of what it checked.
  const artifacts = describeArtifacts();
  console.log('Operational artifact register:');
  for (const artifact of artifacts) {
    console.log(
      `- ${ARTIFACT_STATUS_LABEL[artifact.status].padEnd(6)} ${artifact.title}: retrieved ` +
        `${artifact.retrievedOn} · ${artifact.ageDays}d of ${artifact.budgetDays}d · ${artifact.coverage}`,
    );
    if (artifact.status === 'stale') {
      errors.push(
        `${artifact.title} artifact is ${artifact.ageDays}d old (fetchedAt ${artifact.retrievedOn}, ` +
          `budget ${artifact.budgetDays}d) — run ${artifact.refreshCommand}.`,
      );
    } else if (artifact.status === 'aging') {
      warnings.push(
        `${artifact.title} artifact is ${artifact.ageDays}d old (fetchedAt ${artifact.retrievedOn}, ` +
          `warn tip ${artifact.warnAfterDays}d) — schedule ${artifact.refreshCommand}.`,
      );
    }
  }

  warnings.forEach((warning) => console.warn(`FRESHNESS WARN: ${warning}`));
  if (errors.length > 0) {
    console.error('FRESHNESS FAILED:');
    errors.forEach((error) => console.error(`- ${error}`));
    console.error(
      'Action: run backfill research + npm run ingest, commit artifacts, bump datasetVersion, then re-run validate:dataset.',
    );
    process.exit(1);
  }

  console.log(`Freshness OK (dataset as of ${datasetAsOf}).`);
};

main();