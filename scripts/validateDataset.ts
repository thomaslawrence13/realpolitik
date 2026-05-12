import { geopoliticalDatasetV1 } from '../src/data/datasets/v1.js';

const errors: string[] = [];

const addError = (message: string) => {
  errors.push(message);
};

const ensure = (condition: boolean, message: string) => {
  if (!condition) addError(message);
};

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
    if (ids.has(source.id)) addError(`duplicate source id "${source.id}"`);
    ids.add(source.id);
  }
};

const validateCountries = () => {
  const countries = geopoliticalDatasetV1.countries;
  const countryIds = new Set<string>();
  const mapNames = new Set<string>();
  const sourceIds = new Set(geopoliticalDatasetV1.sources.map((source) => source.id));

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

    for (const sourceId of country.sourceIds) {
      ensure(sourceIds.has(sourceId), `country "${country.id}" references unknown source "${sourceId}"`);
    }
  }
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
    const key = canonicalPairKey(edge.sourceCountryId, edge.targetCountryId);
    if (pairKeys.has(key)) addError(`duplicate relationship pair "${key}"`);
    pairKeys.add(key);
  }
};

const main = () => {
  validateTimeline();
  validateSources();
  validateCountries();
  validateRelationships();

  if (errors.length > 0) {
    console.error('Dataset validation failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(
    `Dataset validation passed (${geopoliticalDatasetV1.countries.length} countries, ${geopoliticalDatasetV1.relationships.length} relationships, ${geopoliticalDatasetV1.scenarioTimeline.length} periods).`,
  );
};

main();
