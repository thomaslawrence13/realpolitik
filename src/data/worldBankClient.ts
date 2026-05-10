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

export type WbIndicator =
  | 'MS.MIL.XPND.GD.ZS' // Military expenditure (% of GDP)
  | 'TG.VAL.TOTL.GD.ZS' // Trade (% of GDP)
  | 'NY.GDP.MKTP.KD.ZG' // GDP growth (annual %)
  | 'FP.CPI.TOTL.ZG'    // Inflation, consumer prices (annual %)
  | 'PV.EST'             // Political Stability and Absence of Violence/Terrorism (WGI)
  | 'RL.EST'             // Rule of Law (WGI, –2.5 to +2.5)
  | 'SL.UEM.TOTL.ZS';   // Unemployment, total (% of labour force)

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
  // per_page=1000 accommodates 134 countries × 3 years = 402 rows with headroom.
  const url = `${WB_API}/country/${isoCodes}/indicator/${indicator}?format=json&mrv=3&per_page=1000`;

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
  /** RL.EST — Rule of Law (WGI, –2.5 to +2.5) */
  ruleOfLaw: IndicatorValues;
  /** SL.UEM.TOTL.ZS — Unemployment, total (% of labour force) */
  unemployment: IndicatorValues;
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

  const [militaryExpPct, tradePct, gdpGrowth, inflation, politicalStability, ruleOfLaw, unemployment] = await Promise.all([
    safe(fetchIndicator('MS.MIL.XPND.GD.ZS', signal), empty),
    safe(fetchIndicator('TG.VAL.TOTL.GD.ZS', signal), empty),
    safe(fetchIndicator('NY.GDP.MKTP.KD.ZG', signal), empty),
    safe(fetchIndicator('FP.CPI.TOTL.ZG', signal), empty),
    safe(fetchIndicator('PV.EST', signal), empty),
    safe(fetchIndicator('RL.EST', signal), empty),
    safe(fetchIndicator('SL.UEM.TOTL.ZS', signal), empty),
  ]);

  return { militaryExpPct, tradePct, gdpGrowth, inflation, politicalStability, ruleOfLaw, unemployment };
};
