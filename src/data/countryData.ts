import { geopoliticalDatasetV1 } from './datasets/v1';
import type { CountryProfile, CountryRelationship, CountryRecord, DatasetSource, RelationshipEdge } from '../types';

const dataset = geopoliticalDatasetV1;
const sourceById = new Map(dataset.sources.map((source) => [source.id, source]));
const countryById = new Map(dataset.countries.map((country) => [country.id, country]));

// Build adjacency index once so buildRelationships is O(1) per country instead of O(N×R)
const relationshipsByCountryId = new Map<string, RelationshipEdge[]>();
dataset.relationships.forEach((edge) => {
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

const countries = dataset.countries
  .map<CountryProfile>((country) => ({
    ...country,
    sources: resolveSources(country.sourceIds),
    relationships: buildRelationships(country.id),
  }))
  .sort((left, right) => left.displayName.localeCompare(right.displayName));

export const datasetVersion = dataset.version;
export const methodologyNotes = dataset.methodologyNotes;
export const scenarioTimeline = dataset.scenarioTimeline;
export const countryProfiles = countries;
export const allianceNetworks = Array.from(new Set(countries.map((country) => country.allianceNetwork))).sort();

// O(1) lookup maps for country access
const countryByMapName = new Map(countries.map((c) => [c.mapName, c]));
const countryByIdMap = new Map(countries.map((c) => [c.id, c]));

export const getCountryByMapName = (mapName: string) => countryByMapName.get(mapName);
export const getCountryById = (countryId: string) => countryByIdMap.get(countryId);

export const getCountryRelationships = (countryId: string) => {
  return getCountryById(countryId)?.relationships ?? [];
};

export const getCountryMap = () => {
  return new Map(countries.map((country) => [country.mapName, country]));
};

export const getCountryRecords = (): CountryRecord[] => countries;
