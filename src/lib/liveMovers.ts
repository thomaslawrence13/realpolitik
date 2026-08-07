import type { CountryProfile } from '../types';

export type LiveMoverMetric =
  | 'composite'
  | 'gdpGrowth'
  | 'inflation'
  | 'trade'
  | 'military'
  | 'coverage';

export type LiveMoverEntry = {
  mapName: string;
  displayName: string;
  region: string;
  growthDelta: number | null;
  inflationDelta: number | null;
  tradeDelta: number | null;
  militaryDelta: number | null;
  coverageDelta: number;
  /** Absolute composite magnitude used for default ranking. */
  compositeScore: number;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Rank countries by how much **observed** stats moved after live/ingest enrichment
 * relative to the static pipeline bootstrap profiles.
 */
export const computeLiveMovers = (
  staticProfiles: readonly CountryProfile[],
  liveProfiles: readonly CountryProfile[],
): LiveMoverEntry[] => {
  const staticById = new Map(staticProfiles.map((p) => [p.id, p]));
  const entries: LiveMoverEntry[] = [];

  for (const live of liveProfiles) {
    const base = staticById.get(live.id);
    if (!base) continue;

    const growthDelta =
      live.economicStats && base.economicStats
        ? round1(live.economicStats.gdpGrowthPct - base.economicStats.gdpGrowthPct)
        : null;
    const inflationDelta =
      live.economicStats && base.economicStats
        ? round1(live.economicStats.inflationPct - base.economicStats.inflationPct)
        : null;
    const tradeDelta =
      live.economicStats && base.economicStats
        ? round1(live.economicStats.tradeGdpPct - base.economicStats.tradeGdpPct)
        : null;
    const militaryDelta =
      live.militaryStats && base.militaryStats
        ? round1(live.militaryStats.militaryExpGdpPct - base.militaryStats.militaryExpGdpPct)
        : null;
    const coverageDelta = Math.round(live.sourceCoverage - base.sourceCoverage);

    const compositeScore =
      Math.abs(growthDelta ?? 0) * 2 +
      Math.abs(inflationDelta ?? 0) * 1.2 +
      Math.abs(tradeDelta ?? 0) * 0.15 +
      Math.abs(militaryDelta ?? 0) * 3 +
      Math.abs(coverageDelta) * 0.25;

    if (compositeScore < 0.05) continue;

    entries.push({
      mapName: live.mapName,
      displayName: live.displayName,
      region: live.region,
      growthDelta,
      inflationDelta,
      tradeDelta,
      militaryDelta,
      coverageDelta,
      compositeScore,
    });
  }

  return entries;
};

export const sortLiveMovers = (
  movers: LiveMoverEntry[],
  metric: LiveMoverMetric,
  limit = 12,
): LiveMoverEntry[] => {
  const ranked = movers.slice();
  const abs = (value: number | null) => Math.abs(value ?? 0);

  if (metric === 'gdpGrowth') {
    ranked.sort((a, b) => abs(b.growthDelta) - abs(a.growthDelta));
  } else if (metric === 'inflation') {
    ranked.sort((a, b) => abs(b.inflationDelta) - abs(a.inflationDelta));
  } else if (metric === 'trade') {
    ranked.sort((a, b) => abs(b.tradeDelta) - abs(a.tradeDelta));
  } else if (metric === 'military') {
    ranked.sort((a, b) => abs(b.militaryDelta) - abs(a.militaryDelta));
  } else if (metric === 'coverage') {
    ranked.sort((a, b) => Math.abs(b.coverageDelta) - Math.abs(a.coverageDelta));
  } else {
    ranked.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  return ranked.slice(0, limit);
};
