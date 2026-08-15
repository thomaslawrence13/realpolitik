/**
 * World Bank Open Data API client (browser).
 * Free to use, no API key required, CORS-enabled.
 * https://datahelpdesk.worldbank.org/knowledgebase/articles/898581
 *
 * Fetches real-time macroeconomic and governance indicators for all tracked
 * countries. Results are cached in localStorage for 4 hours so the API is
 * not hammered on every page load while stats stay reasonably current.
 * Fetch/selection logic lives in lib/worldBankFetch so the ingest script and
 * the Cloudflare Worker refresh path share identical semantics.
 */

import { logger } from '../lib/logger';
import {
  countryIso2,
  currentFloorYear,
  fetchWorldBankPoints,
  iso2ToCountryId,
  pickNewestValues,
  WB_API,
  WB_INDICATORS,
  type IndicatorValues,
  type ObservationYears,
  type WbIndicatorCode,
  type WbIndicatorDef,
  type WbIndicatorKey,
} from '../lib/worldBankFetch';

export { countryIso2, iso2ToCountryId, WB_API } from '../lib/worldBankFetch';

/** World Bank indicator codes the client understands (canonical codes). */
export type WbIndicator = WbIndicatorCode;

const indicatorDefByKey = new Map(WB_INDICATORS.map((def) => [def.key, def]));

/** Bump prefix when the fetch shape changes so stale caches are ignored. */
const CACHE_PREFIX = 'rp_wb5_';
/** Short TTL so the tracker stays current without thrashing the API. */
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

type CacheEntry = {
  fetchedAt: number;
  data: IndicatorValues;
  /** ISO year of the newest observation kept in this cache entry (diagnostics). */
  latestYear?: string;
  /** ISO year selected for each country in `data`. */
  observedYears?: ObservationYears;
};

const readCache = (key: string): CacheEntry | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.data || typeof parsed.fetchedAt !== 'number') return null;
    return Date.now() - parsed.fetchedAt < CACHE_TTL_MS ? parsed : null;
  } catch {
    return null;
  }
};

const writeCache = (
  key: string,
  data: IndicatorValues,
  latestYear: string | null,
  observedYears: ObservationYears,
): void => {
  try {
    const envelope: CacheEntry = { fetchedAt: Date.now(), data, latestYear: latestYear ?? undefined, observedYears };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore — localStorage may be unavailable (private mode, quota exceeded, etc.)
  }
};

/**
 * Fetch a single World Bank indicator for all tracked countries.
 *
 * Requests recent years and keeps the **newest non-null year per country**
 * (not merely the first row the API returns). Cached for {@link CACHE_TTL_MS}
 * so the backend endpoint takes priority over repeated client-side calls.
 */
export const fetchIndicator = async (
  indicatorKey: WbIndicatorKey,
  signal?: AbortSignal,
): Promise<{
  values: IndicatorValues;
  latestYear: string | null;
  observedYears: ObservationYears;
  retrievedAt: string;
}> => {
  const def = indicatorDefByKey.get(indicatorKey);
  if (!def) return { values: {}, latestYear: null, observedYears: {}, retrievedAt: new Date().toISOString() };
  const cacheKey = `${CACHE_PREFIX}${def.code}`;
  const cached = readCache(cacheKey);
  if (cached) {
    logger.debug(`World Bank cache hit for ${def.code}`);
    return {
      values: cached.data,
      latestYear: cached.latestYear ?? null,
      observedYears: cached.observedYears ?? {},
      retrievedAt: new Date(cached.fetchedAt).toISOString(),
    };
  }

  try {
    const points = await fetchWorldBankPoints(def, { signal });
    const floorYear = currentFloorYear();
    const { values, newestObservation, observedYears } = pickNewestValues(points, floorYear);

    writeCache(cacheKey, values, newestObservation, observedYears);
    logger.debug(
      `World Bank fetch succeeded for ${def.code}, cached ${Object.keys(values).length} values` +
        (newestObservation ? ` (newest year ${newestObservation})` : ''),
    );
    return {
      values,
      latestYear: newestObservation,
      observedYears,
      retrievedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`World Bank fetch failed for ${def.code}`, error);
    throw error;
  }
};

export interface LiveIndicatorMetadata {
  latestYear: string | null;
  /** ISO year selected per country; avoids treating a global latest year as country-level freshness. */
  observedYears: ObservationYears;
  retrievedAt: string | null;
}

export interface LiveData {
  /** MS.MIL.XPND.GD.ZS — estimated military expenditure as % of GDP */
  militaryExpPct: IndicatorValues;
  /** MS.MIL.XPND.CD — military expenditure in current US dollars */
  militaryExpUsd: IndicatorValues;
  /** TG.VAL.TOTL.GD.ZS — Total trade (imports and exports) as % of GDP */
  tradePct: IndicatorValues;
  /** NY.GDP.MKTP.KD.ZG — GDP growth (annual %) */
  gdpGrowth: IndicatorValues;
  /** NY.GDP.MKTP.CD — GDP in current US dollars */
  gdpNominalUsd: IndicatorValues;
  /** NY.GDP.PCAP.CD — GDP per capita in current US dollars */
  gdpPerCapitaUsd: IndicatorValues;
  /** FP.CPI.TOTL.ZG — Consumer price inflation (annual %) */
  inflation: IndicatorValues;
  /** PV.EST — Political Stability and Absence of Violence (WGI, –2.5 to +2.5) */
  politicalStability: IndicatorValues;
  /** RL.EST — Rule of Law (WGI, –2.5 to +2.5) */
  ruleOfLaw: IndicatorValues;
  /** SL.UEM.TOTL.ZS — Unemployment, total (% of labour force) */
  unemployment: IndicatorValues;
  /** Whether in flight values came from that node's own API call. */
  source?: 'direct' | 'backend';
  /** Server-side refresh timestamp when `source` is backend (diagnostics). */
  refreshedAt?: string | null;
  /** Observation and retrieval metadata for each World Bank indicator. */
  indicatorMetadata: Partial<Record<WbIndicatorKey, LiveIndicatorMetadata>>;
  /** Per-fetch diagnostics so the UI can distinguish partial from full failures. */
  diagnostics: {
    totalIndicators: number;
    succeededIndicators: number;
    failedIndicators: number;
    failedCodes: WbIndicatorCode[];
  };
}

/**
 * Fetch all live indicators in parallel.
 *
 * Each indicator fetch is individually error-tolerant: a failing endpoint
 * silently returns an empty map so one bad indicator does not block the rest.
 * The caller receives whatever partial data is available.
 */
export const fetchLiveData = async (signal?: AbortSignal): Promise<LiveData> => {
  logger.info('Starting World Bank data fetch');
  const empty: IndicatorValues = {};
  const settled = await Promise.allSettled(
    WB_INDICATORS.map((def) => fetchIndicator(def.key, signal)),
  );
  const valueByKey = new Map<WbIndicatorKey, IndicatorValues>();
  const metadataByKey = new Map<WbIndicatorKey, LiveIndicatorMetadata>();
  const failedCodes: WbIndicatorCode[] = [];

  settled.forEach((result, index) => {
    const def = WB_INDICATORS[index]!;
    if (result.status === 'fulfilled') {
      valueByKey.set(def.key, result.value.values);
      metadataByKey.set(def.key, {
        latestYear: result.value.latestYear,
        observedYears: result.value.observedYears,
        retrievedAt: result.value.retrievedAt,
      });
      return;
    }
    if (result.reason instanceof Error) {
      logger.warn(`Failed to fetch indicator ${def.code}: ${result.reason.message}`);
    }
    failedCodes.push(def.code);
    valueByKey.set(def.key, empty);
  });

  const diagnostics = {
    totalIndicators: WB_INDICATORS.length,
    succeededIndicators: WB_INDICATORS.length - failedCodes.length,
    failedIndicators: failedCodes.length,
    failedCodes,
  };

  if (failedCodes.length === 0) {
    logger.info('World Bank data fetch succeeded for all indicators');
  } else if (failedCodes.length === WB_INDICATORS.length) {
    logger.warn('World Bank data fetch failed for all indicators', diagnostics);
  } else {
    logger.info(`World Bank data fetch partial success (${diagnostics.succeededIndicators}/${WB_INDICATORS.length})`, diagnostics);
  }

  return {
    militaryExpPct: valueByKey.get('militaryExpPct') ?? empty,
    militaryExpUsd: valueByKey.get('militaryExpUsd') ?? empty,
    tradePct: valueByKey.get('tradePct') ?? empty,
    gdpGrowth: valueByKey.get('gdpGrowth') ?? empty,
    gdpNominalUsd: valueByKey.get('gdpNominalUsd') ?? empty,
    gdpPerCapitaUsd: valueByKey.get('gdpPerCapitaUsd') ?? empty,
    inflation: valueByKey.get('inflation') ?? empty,
    politicalStability: valueByKey.get('politicalStability') ?? empty,
    ruleOfLaw: valueByKey.get('ruleOfLaw') ?? empty,
    unemployment: valueByKey.get('unemployment') ?? empty,
    source: 'direct',
    refreshedAt: null,
    indicatorMetadata: Object.fromEntries(metadataByKey),
    diagnostics,
  };
};
