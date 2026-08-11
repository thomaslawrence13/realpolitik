/**
 * World Bank Open Data API client.
 * Free to use, no API key required, CORS-enabled.
 * https://datahelpdesk.worldbank.org/knowledgebase/articles/898581
 *
 * Fetches real-time macroeconomic and governance indicators for all tracked
 * countries. Results are cached in localStorage for 4 hours so the API is
 * not hammered on every page load while stats stay reasonably current.
 */

import { logger } from '../lib/logger';

const WB_API = 'https://api.worldbank.org/v2';

/** ISO alpha-2 country codes for all tracked countries. */
export const countryIso2: Record<string, string> = {
  // --- Americas ---
  'united-states':          'US',
  'canada':                 'CA',
  'mexico':                 'MX',
  'brazil':                 'BR',
  'argentina':              'AR',
  'venezuela':              'VE',
  'colombia':               'CO',
  'chile':                  'CL',
  'peru':                   'PE',
  'bolivia':                'BO',
  'ecuador':                'EC',
  'paraguay':               'PY',
  'uruguay':                'UY',
  'cuba':                   'CU',
  'guatemala':              'GT',
  'costa-rica':             'CR',
  'panama':                 'PA',
  'dominican-republic':     'DO',
  // --- Europe ---
  'germany':                'DE',
  'france':                 'FR',
  'united-kingdom':         'GB',
  'italy':                  'IT',
  'spain':                  'ES',
  'poland':                 'PL',
  'netherlands':            'NL',
  'belgium':                'BE',
  'sweden':                 'SE',
  'norway':                 'NO',
  'denmark':                'DK',
  'finland':                'FI',
  'switzerland':            'CH',
  'austria':                'AT',
  'portugal':               'PT',
  'greece':                 'GR',
  'czechia':                'CZ',
  'romania':                'RO',
  'hungary':                'HU',
  'ukraine':                'UA',
  'turkey':                 'TR',
  'bulgaria':               'BG',
  'croatia':                'HR',
  'slovakia':               'SK',
  'estonia':                'EE',
  'latvia':                 'LV',
  'lithuania':              'LT',
  'serbia':                 'RS',
  'ireland':                'IE',
  'iceland':                'IS',
  'luxembourg':             'LU',
  'slovenia':               'SI',
  'cyprus':                 'CY',
  'albania':                'AL',
  'bosnia-and-herzegovina': 'BA',
  'north-macedonia':        'MK',
  'montenegro':             'ME',
  'kosovo':                 'XK',
  'belarus':                'BY',
  'moldova':                'MD',
  // --- Russia & Central Asia ---
  'russia':                 'RU',
  'kazakhstan':             'KZ',
  'uzbekistan':             'UZ',
  'tajikistan':             'TJ',
  'kyrgyzstan':             'KG',
  'turkmenistan':           'TM',
  'azerbaijan':             'AZ',
  'armenia':                'AM',
  'georgia':                'GE',
  // --- Middle East ---
  'iran':                   'IR',
  'iraq':                   'IQ',
  'israel':                 'IL',
  'saudi-arabia':           'SA',
  'uae':                    'AE',
  'jordan':                 'JO',
  'kuwait':                 'KW',
  'qatar':                  'QA',
  'oman':                   'OM',
  'bahrain':                'BH',
  'syria':                  'SY',
  'lebanon':                'LB',
  'yemen':                  'YE',
  'libya':                  'LY',
  // --- South Asia ---
  'india':                  'IN',
  'pakistan':               'PK',
  'bangladesh':             'BD',
  'sri-lanka':              'LK',
  'nepal':                  'NP',
  'afghanistan':            'AF',
  // --- East Asia ---
  'china':                  'CN',
  'japan':                  'JP',
  'south-korea':            'KR',
  'north-korea':            'KP',
  'taiwan':                 'TW',
  'mongolia':               'MN',
  // --- South-East Asia ---
  'vietnam':                'VN',
  'thailand':               'TH',
  'philippines':            'PH',
  'indonesia':              'ID',
  'malaysia':               'MY',
  'singapore':              'SG',
  'myanmar':                'MM',
  'cambodia':               'KH',
  'laos':                   'LA',
  'brunei':                 'BN',
  // --- Oceania ---
  'australia':              'AU',
  'new-zealand':            'NZ',
  'papua-new-guinea':       'PG',
  // --- North Africa ---
  'egypt':                  'EG',
  'morocco':                'MA',
  'algeria':                'DZ',
  'tunisia':                'TN',
  // --- Sub-Saharan Africa ---
  'nigeria':                'NG',
  'south-africa':           'ZA',
  'ethiopia':               'ET',
  'kenya':                  'KE',
  'ghana':                  'GH',
  'tanzania':               'TZ',
  'dem-rep-congo':          'CD',
  'angola':                 'AO',
  'sudan':                  'SD',
  'south-sudan':            'SS',
  'somalia':                'SO',
  'zimbabwe':               'ZW',
  'mozambique':             'MZ',
  'rwanda':                 'RW',
  'uganda':                 'UG',
  'mali':                   'ML',
  'niger':                  'NE',
  'cote-divoire':           'CI',
  'cameroon':               'CM',
  'senegal':                'SN',
  'botswana':               'BW',
  'zambia':                 'ZM',
  'burkina-faso':           'BF',
  'madagascar':             'MG',
};

/** Map of ISO alpha-2 code → country ID (reverse of countryIso2). */
export const iso2ToCountryId: Record<string, string> = Object.fromEntries(
  Object.entries(countryIso2).map(([id, iso]) => [iso, id]),
);

/** A map of ISO alpha-2 code → latest numeric value (null = no data). */
export type IndicatorValues = Record<string, number | null>;

/** A map of ISO alpha-2 code → the four-digit year that value describes. */
export type IndicatorYears = Record<string, string>;

export type WbIndicator =
  | 'MS.MIL.XPND.GD.ZS' // Military expenditure (% of GDP)
  | 'TG.VAL.TOTL.GD.ZS' // Trade (% of GDP)
  | 'NY.GDP.MKTP.KD.ZG' // GDP growth (annual %)
  | 'FP.CPI.TOTL.ZG'    // Inflation, consumer prices (annual %)
  | 'PV.EST'             // Political Stability and Absence of Violence/Terrorism (WGI)
  | 'RL.EST'             // Rule of Law (WGI, –2.5 to +2.5)
  | 'SL.UEM.TOTL.ZS';   // Unemployment, total (% of labour force)

const indicatorSourceId: Partial<Record<WbIndicator, string>> = {
  // Worldwide Governance Indicators live under source 3 rather than the default WDI source.
  'PV.EST': '3',
  'RL.EST': '3',
};

const indicatorRequestCode: Record<WbIndicator, string> = {
  'MS.MIL.XPND.GD.ZS': 'MS.MIL.XPND.GD.ZS',
  'TG.VAL.TOTL.GD.ZS': 'TG.VAL.TOTL.GD.ZS',
  'NY.GDP.MKTP.KD.ZG': 'NY.GDP.MKTP.KD.ZG',
  'FP.CPI.TOTL.ZG': 'FP.CPI.TOTL.ZG',
  'PV.EST': 'GOV_WGI_PV.EST',
  'RL.EST': 'GOV_WGI_RL.EST',
  'SL.UEM.TOTL.ZS': 'SL.UEM.TOTL.ZS',
};

interface WbDataPoint {
  country: { id: string; value: string };
  date: string;
  value: number | null;
}

/** First element of a World Bank response — pagination plus series metadata. */
interface WbResponseEnvelope {
  /** ISO date the World Bank last refreshed this series. */
  lastupdated?: string;
}

/** Bump prefix when the fetch shape changes so stale caches are ignored. */
const CACHE_PREFIX = 'rp_wb4_';
/** Short TTL so the tracker stays current without thrashing the API. */
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
/** How many most-recent annual observations to request (prefer newest non-null). */
const MRV_YEARS = 6;

/** One indicator's values plus the reference year behind each of them. */
export interface IndicatorResult {
  values: IndicatorValues;
  /** ISO-2 → four-digit reference year, so the UI can cite each number's vintage. */
  years: IndicatorYears;
  /** Newest reference year across all countries in this result. */
  latestYear?: string;
  /** When the World Bank last refreshed the series, from the response envelope. */
  seriesUpdatedAt?: string;
}

type CacheEnvelope = {
  fetchedAt: number;
  data: IndicatorValues;
  years?: IndicatorYears;
  /** ISO year of the newest observation kept in this cache entry (diagnostics). */
  latestYear?: string;
  seriesUpdatedAt?: string;
};

const readCache = (key: string): IndicatorResult | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed?.data || typeof parsed.fetchedAt !== 'number') return null;
    if (Date.now() - parsed.fetchedAt >= CACHE_TTL_MS) return null;
    return {
      values: parsed.data,
      years: parsed.years ?? {},
      latestYear: parsed.latestYear,
      seriesUpdatedAt: parsed.seriesUpdatedAt,
    };
  } catch {
    return null;
  }
};

const writeCache = (key: string, result: IndicatorResult): void => {
  try {
    const envelope: CacheEnvelope = {
      fetchedAt: Date.now(),
      data: result.values,
      years: result.years,
      latestYear: result.latestYear,
      seriesUpdatedAt: result.seriesUpdatedAt,
    };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore — localStorage may be unavailable (private mode, quota exceeded, etc.)
  }
};

/**
 * Fetch a single World Bank indicator for all tracked countries.
 *
 * Requests up to {@link MRV_YEARS} recent observations and keeps the **newest
 * non-null year per country** (not merely the first row the API returns).
 * Cached for {@link CACHE_TTL_MS}.
 */
export const fetchIndicator = async (
  indicator: WbIndicator,
  signal?: AbortSignal,
): Promise<IndicatorResult> => {
  const cacheKey = `${CACHE_PREFIX}${indicator}`;
  const cached = readCache(cacheKey);
  if (cached) {
    logger.debug(`World Bank cache hit for ${indicator}`);
    return cached;
  }

  try {
    const isoCodes = Object.values(countryIso2).join(';');
    // per_page covers 134 countries × MRV years with headroom.
    const sourceParam = indicatorSourceId[indicator] ? `&source=${indicatorSourceId[indicator]}` : '';
    const url =
      `${WB_API}/country/${isoCodes}/indicator/${indicatorRequestCode[indicator]}` +
      `?format=json&mrv=${MRV_YEARS}&per_page=2000${sourceParam}`;

    const response = await fetch(url, {
      signal,
      // Prefer network when the browser still has a stale HTTP cache of the API.
      cache: 'no-cache',
    });
    if (!response.ok) {
      throw new Error(`World Bank API (${indicator}): HTTP ${response.status}`);
    }

    const json = (await response.json()) as [WbResponseEnvelope | undefined, WbDataPoint[] | null];
    const points = json[1] ?? [];

    // Newest non-null observation per ISO, by calendar year.
    const best = new Map<string, { year: string; value: number }>();
    for (const point of points) {
      if (point.value === null || point.value === undefined) continue;
      const iso = point.country.id.toUpperCase();
      const year = String(point.date ?? '').slice(0, 4);
      if (!/^\d{4}$/.test(year)) continue;
      const prev = best.get(iso);
      if (!prev || year > prev.year) {
        best.set(iso, { year, value: point.value });
      }
    }

    const values: IndicatorValues = {};
    const years: IndicatorYears = {};
    let latestYear = '';
    for (const [iso, row] of best) {
      values[iso] = row.value;
      years[iso] = row.year;
      if (row.year > latestYear) latestYear = row.year;
    }

    const result: IndicatorResult = {
      values,
      years,
      latestYear: latestYear || undefined,
      // The World Bank stamps every response with the date it last refreshed the
      // series — worth keeping, since it distinguishes "old data" from "data we
      // fetched a while ago".
      seriesUpdatedAt: json[0]?.lastupdated,
    };

    writeCache(cacheKey, result);
    logger.debug(
      `World Bank fetch succeeded for ${indicator}, cached ${Object.keys(values).length} values` +
        (latestYear ? ` (newest year ${latestYear})` : ''),
    );
    return result;
  } catch (error) {
    logger.error(`World Bank fetch failed for ${indicator}`, error);
    throw error;
  }
};

export interface LiveData {
  /** MS.MIL.XPND.GD.ZS — Military expenditure as % of GDP */
  militaryExpPct: IndicatorValues;
  /** TG.VAL.TOTL.GD.ZS — Total trade (imports + exports) as % of GDP */
  tradePct: IndicatorValues;
  /** NY.GDP.MKTP.KD.ZG — GDP growth (annual %) */
  gdpGrowth: IndicatorValues;
  /** FP.CPI.TOTL.ZG — Consumer price inflation (annual %) */
  inflation: IndicatorValues;
  /** PV.EST — Political Stability and Absence of Violence (WGI, –2.5 to +2.5) */
  politicalStability: IndicatorValues;
  /** RL.EST — Rule of Law (WGI, –2.5 to +2.5) */
  ruleOfLaw: IndicatorValues;
  /** SL.UEM.TOTL.ZS — Unemployment, total (% of labour force) */
  unemployment: IndicatorValues;
  /**
   * Reference year of each live value, keyed by indicator code then ISO-2, so
   * the UI can state what period a displayed number covers instead of implying
   * it is current as of the fetch.
   */
  vintages: Partial<Record<WbIndicator, IndicatorYears>>;
  /** Indicator code → the date the World Bank last refreshed that series. */
  seriesUpdatedAt: Partial<Record<WbIndicator, string>>;
  /** Per-fetch diagnostics so the UI can distinguish partial from full failure. */
  diagnostics: {
    totalIndicators: number;
    succeededIndicators: number;
    failedIndicators: number;
    failedCodes: WbIndicator[];
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
  const requests: Array<[WbIndicator, Promise<IndicatorResult>]> = [
    ['MS.MIL.XPND.GD.ZS', fetchIndicator('MS.MIL.XPND.GD.ZS', signal)],
    ['TG.VAL.TOTL.GD.ZS', fetchIndicator('TG.VAL.TOTL.GD.ZS', signal)],
    ['NY.GDP.MKTP.KD.ZG', fetchIndicator('NY.GDP.MKTP.KD.ZG', signal)],
    ['FP.CPI.TOTL.ZG', fetchIndicator('FP.CPI.TOTL.ZG', signal)],
    ['PV.EST', fetchIndicator('PV.EST', signal)],
    ['RL.EST', fetchIndicator('RL.EST', signal)],
    ['SL.UEM.TOTL.ZS', fetchIndicator('SL.UEM.TOTL.ZS', signal)],
  ];
  const settled = await Promise.allSettled(requests.map(([, promise]) => promise));
  const valueByCode = new Map<WbIndicator, IndicatorValues>();
  const vintages: Partial<Record<WbIndicator, IndicatorYears>> = {};
  const seriesUpdatedAt: Partial<Record<WbIndicator, string>> = {};
  const failedCodes: WbIndicator[] = [];

  settled.forEach((result, index) => {
    const code = requests[index]![0];
    if (result.status === 'fulfilled') {
      valueByCode.set(code, result.value.values);
      vintages[code] = result.value.years;
      if (result.value.seriesUpdatedAt) seriesUpdatedAt[code] = result.value.seriesUpdatedAt;
      return;
    }
    if (result.reason instanceof Error) {
      logger.warn(`Failed to fetch indicator ${code}: ${result.reason.message}`);
    }
    failedCodes.push(code);
    valueByCode.set(code, empty);
  });

  const diagnostics = {
    totalIndicators: requests.length,
    succeededIndicators: requests.length - failedCodes.length,
    failedIndicators: failedCodes.length,
    failedCodes,
  };

  if (failedCodes.length === 0) {
    logger.info('World Bank data fetch succeeded for all indicators');
  } else if (failedCodes.length === requests.length) {
    logger.warn('World Bank data fetch failed for all indicators', diagnostics);
  } else {
    logger.info(`World Bank data fetch partial success (${diagnostics.succeededIndicators}/${requests.length})`, diagnostics);
  }

  return {
    militaryExpPct: valueByCode.get('MS.MIL.XPND.GD.ZS') ?? empty,
    tradePct: valueByCode.get('TG.VAL.TOTL.GD.ZS') ?? empty,
    gdpGrowth: valueByCode.get('NY.GDP.MKTP.KD.ZG') ?? empty,
    inflation: valueByCode.get('FP.CPI.TOTL.ZG') ?? empty,
    politicalStability: valueByCode.get('PV.EST') ?? empty,
    ruleOfLaw: valueByCode.get('RL.EST') ?? empty,
    unemployment: valueByCode.get('SL.UEM.TOTL.ZS') ?? empty,
    vintages,
    seriesUpdatedAt,
    diagnostics,
  };
};
