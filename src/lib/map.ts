import type { FeatureCollection, Geometry } from 'geojson';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldTopology from 'world-atlas/countries-50m.json';

export const MAP_WIDTH = 980;
export const MAP_HEIGHT = 520;

const topology = worldTopology as { objects: { countries: unknown } };

export type CountryFeature = {
  id?: string;
  properties: { name: string };
  geometry: Geometry;
};

const worldFeatures = feature(
  topology as never,
  topology.objects.countries as never,
) as unknown as FeatureCollection<Geometry, { name: string }>;

export const countries = worldFeatures.features as CountryFeature[];

// Countries to exclude from projection fitting (Antarctica distorts Mercator
// severely and Fr. S. Antarctic Lands is similarly far south).
const EXCLUDED_FROM_FIT = new Set(['Antarctica', 'Fr. S. Antarctic Lands']);

// Fit the projection to the world excluding Antarctica for better use of the
// available canvas height (Antarctica is mostly unpopulated and Mercator
// distorts it extremely at the southern extreme).
const featuresForFit: FeatureCollection<Geometry, { name: string }> = {
  type: 'FeatureCollection',
  features: worldFeatures.features.filter((f) => !EXCLUDED_FROM_FIT.has(f.properties.name)),
};

export const projection = geoMercator().fitSize([MAP_WIDTH, MAP_HEIGHT], featuresForFit);
export const path = geoPath(projection);

export const countryCentroids = new Map(
  countries.map((country) => [
    country.properties.name,
    path.centroid(country as never) as [number, number],
  ]),
);

// Pre-compute all path `d` strings once so MapCanvas never calls the d3 projection at render time.
export const countryPathStrings = new Map(
  countries.map((country) => [country.properties.name, path(country as never) ?? '']),
);
