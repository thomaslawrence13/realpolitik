import type { FeatureCollection, Geometry } from 'geojson';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldTopology from 'world-atlas/countries-110m.json';

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

export const projection = geoMercator().fitSize([MAP_WIDTH, MAP_HEIGHT], worldFeatures);
export const path = geoPath(projection);

export const countries = worldFeatures.features as CountryFeature[];

export const countryCentroids = new Map(
  countries.map((country) => [
    country.properties.name,
    path.centroid(country as never) as [number, number],
  ]),
);
