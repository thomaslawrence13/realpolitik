/**
 * World Bank Open Data API client.
 * Free to use, no API key required, CORS-enabled.
 * https://datahelpdesk.worldbank.org/knowledgebase/articles/898581
 *
 * Fetches real-time macroeconomic and governance indicators for all tracked
 * countries. Results are cached in localStorage for 24 hours so the API is
 * not hammered on every page load.
 */

const WB_API = 'https://api.worldbank.org/v2';

/** ISO alpha-2 country codes for all tracked countries. */
export const countryIso2: Record<string, string> = {
  'united-states':  'US',
  'china':          'CN',
  'russia':         'RU',
  'india':          'IN',
  'germany':        'DE',
  'poland':         'PL',
  'turkey':         'TR',
  'japan':          'JP',
  'iran':           'IR',
  'saudi-arabia':   'SA',
  'brazil':         'BR',
  'ukraine':        'UA',
  'france':         'FR',
  'united-kingdom': 'GB',
  'canada':         'CA',
  'mexico':         'MX',
  'argentina':      'AR',
  'venezuela':      'VE',
  'australia':      'AU',
  'south-korea':    'KR',
  'indonesia':      'ID',
  'vietnam':        'VN',
  'thailand':       'TH',
  'philippines':    'PH',
  'myanmar':        'MM',
  'bangladesh':     'BD',
  'pakistan':       'PK',
  'israel':         'IL',
  'iraq':           'IQ',
  'uae':            'AE',
  'syria':          'SY',
  'taiwan':         'TW',
};

/** Map of ISO alpha-2 code → country ID (reverse of countryIso2). */
export const iso2ToCountryId: Record<string, string> = Object.fromEntries(
  Object.entries(countryIso2).map(([id, iso]) => [iso, id]),
);

/** A map of ISO alpha-2 code → latest numeric value (null = no data). */
export type IndicatorValues = Record<string, number | null>;

export type WbIndicator =
  | 'MS.MIL.XPND.GD.ZS' // Military expenditure (% of GDP)
  | 'TG.VAL.TOTL.GD.ZS' // Trade (% of GDP)
  | 'NY.GDP.MKTP.KD.ZG' // GDP growth (annual %)
  | 'FP.CPI.TOTL.ZG'    // Inflation, consumer prices (annual %)
  | 'PV.EST';            // Political Stability and Absence of Violence/Terrorism (WGI)

interface WbDataPoint {
  country: { id: string; value: string };
  date: string;
  value: number | null;
}

const CACHE_PREFIX = 'rp_wb2_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const readCache = (key: string): IndicatorValues | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { fetchedAt, data } = JSON.parse(raw) as { fetchedAt: number; data: IndicatorValues };
    return Date.now() - fetchedAt < CACHE_TTL_MS ? data : null;
  } catch {
    return null;
  }
};

const writeCache = (key: string, data: IndicatorValues): void => {
  try {
    localStorage.setItem(key, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch {
    // Ignore — localStorage may be unavailable (private mode, quota exceeded, etc.)
  }
};

/**
 * Fetch a single World Bank indicator for all tracked countries.
 *
 * Uses mrv=3 (up to 3 most-recent observations) so we fall back to a prior
 * year if the latest value is not yet published, then picks the first
 * non-null value per country.
 *
 * Returns a map of ISO alpha-2 → most recent non-null value.
 * Results are cached in localStorage for 24 hours.
 */
export const fetchIndicator = async (
  indicator: WbIndicator,
  signal?: AbortSignal,
): Promise<IndicatorValues> => {
  const cacheKey = `${CACHE_PREFIX}${indicator}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const isoCodes = Object.values(countryIso2).join(';');
  // per_page=300 is well above 32 countries × 3 years = 96 rows, avoiding pagination.
  const url = `${WB_API}/country/${isoCodes}/indicator/${indicator}?format=json&mrv=3&per_page=300`;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`World Bank API (${indicator}): HTTP ${response.status}`);

  const json = (await response.json()) as [unknown, WbDataPoint[] | null];
  const points = json[1] ?? [];

  // Keep only the first (most recent) non-null value per country.
  const result: IndicatorValues = {};
  for (const point of points) {
    const iso = point.country.id.toUpperCase();
    if (point.value !== null && !(iso in result)) {
      result[iso] = point.value;
    }
  }

  writeCache(cacheKey, result);
  return result;
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
}

/**
 * Fetch all live indicators in parallel.
 *
 * Each indicator fetch is individually error-tolerant: a failing endpoint
 * silently returns an empty map so one bad indicator does not block the rest.
 * The caller receives whatever partial data is available.
 */
export const fetchLiveData = async (signal?: AbortSignal): Promise<LiveData> => {
  const safe = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const empty: IndicatorValues = {};

  const [militaryExpPct, tradePct, gdpGrowth, inflation, politicalStability] = await Promise.all([
    safe(fetchIndicator('MS.MIL.XPND.GD.ZS', signal), empty),
    safe(fetchIndicator('TG.VAL.TOTL.GD.ZS', signal), empty),
    safe(fetchIndicator('NY.GDP.MKTP.KD.ZG', signal), empty),
    safe(fetchIndicator('FP.CPI.TOTL.ZG', signal), empty),
    safe(fetchIndicator('PV.EST', signal), empty),
  ]);

  return { militaryExpPct, tradePct, gdpGrowth, inflation, politicalStability };
};
