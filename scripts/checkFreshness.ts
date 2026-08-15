import { geopoliticalDatasetV1 } from '../src/data/datasets/v1.js';
import { datasetAsOf } from '../src/data/countryData.js';
import ingestManifest from '../src/data/datasets/ingest_manifest.json';
import unVotesArtifact from '../src/data/datasets/un_ga_votes.json';
import ofacArtifact from '../src/data/datasets/ofac_sanctions_registry.json';
import ucdpArtifact from '../src/data/datasets/ucdp_conflict.json';

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

  const unVotesFetchedAt = (unVotesArtifact as { fetchedAt: string }).fetchedAt;
  const unVotesAge = daysOld(unVotesFetchedAt);
  if (unVotesAge > 420) {
    errors.push(
      `UN votes artifact is ${unVotesAge}d old (fetchedAt ${unVotesFetchedAt.slice(0, 10)}, budget 420d) — run npm run refresh:unvotes.`,
    );
  }

  const ofacFetchedAt = (ofacArtifact as { fetchedAt: string }).fetchedAt;
  const ofacAge = daysOld(ofacFetchedAt);
  if (ofacAge > 120) {
    errors.push(
      `OFAC registry artifact is ${ofacAge}d old (fetchedAt ${ofacFetchedAt.slice(0, 10)}, budget 120d) — run npm run refresh:ofac.`,
    );
  } else if (ofacAge > 60) {
    warnings.push(
      `OFAC registry artifact is ${ofacAge}d old (fetchedAt ${ofacFetchedAt.slice(0, 10)}, warn tip 60d).`,
    );
  }

  const ucdpFetchedAt = (ucdpArtifact as { fetchedAt: string }).fetchedAt;
  const ucdpAge = daysOld(ucdpFetchedAt);
  // UCDP publishes the yearly OV-CY each mid-year; ~14 months is the true
  // staleness point, with a warning tip well before.
  if (ucdpAge > 420) {
    errors.push(
      `UCDP conflict artifact is ${ucdpAge}d old (fetchedAt ${ucdpFetchedAt.slice(0, 10)}, budget 420d) — run npm run refresh:ucdp.`,
    );
  } else if (ucdpAge > 240) {
    warnings.push(
      `UCDP conflict artifact is ${ucdpAge}d old (fetchedAt ${ucdpFetchedAt.slice(0, 10)}, warn tip 240d).`,
    );
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