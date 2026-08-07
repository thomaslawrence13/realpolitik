import type { FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import { geoMercator, geoPath, geoArea } from 'd3-geo';
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

/**
 * Project lon/lat (degrees, WGS84) into map world coordinates.
 * Prefer this for relationship anchors when a country has a curated geo centroid —
 * multipolygon path.centroids often land in the ocean (US, France, Norway, NZ…).
 */
export const projectLonLat = (lng: number, lat: number): [number, number] | null => {
  const projected = projection([lng, lat]);
  if (!projected) return null;
  const [x, y] = projected;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y];
};

/**
 * Centroid of the largest polygon only — avoids multipolygon "ocean" centroids.
 */
const largestPolygonCentroid = (country: CountryFeature): [number, number] | null => {
  const geometry = country.geometry;
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    const c = path.centroid(country as never) as [number, number];
    return Number.isFinite(c[0]) && Number.isFinite(c[1]) ? c : null;
  }
  if (geometry.type === 'MultiPolygon') {
    let best: { type: 'Feature'; properties: Record<string, never>; geometry: Polygon } | null = null;
    let bestArea = -Infinity;
    for (const poly of (geometry as MultiPolygon).coordinates) {
      const candidate = {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: poly },
      };
      const area = geoArea(candidate as never);
      if (area > bestArea) {
        bestArea = area;
        best = candidate;
      }
    }
    if (!best) return null;
    const c = path.centroid(best as never) as [number, number];
    return Number.isFinite(c[0]) && Number.isFinite(c[1]) ? c : null;
  }
  const c = path.centroid(country as never) as [number, number];
  return Number.isFinite(c[0]) && Number.isFinite(c[1]) ? c : null;
};

export const countryCentroids = new Map(
  countries.flatMap((country) => {
    const c = largestPolygonCentroid(country);
    return c ? [[country.properties.name, c] as const] : [];
  }),
);

// Pre-compute all path `d` strings once so MapCanvas never calls the d3 projection at render time.
export const countryPathStrings = new Map(
  countries.map((country) => [country.properties.name, path(country as never) ?? '']),
);
