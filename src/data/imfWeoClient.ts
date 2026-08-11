/**
 * IMF World Economic Outlook (WEO) client — via the public DataMapper API.
 * https://www.imf.org/external/datamapper/api/v1/
 *
 * Why this source: the WEO is the most current authoritative macro series
 * available without a licence. It publishes every April and October with
 * current-year estimates and forward projections, where reported-outturn
 * series (World Bank WDI and friends) trail the reference year by 1–2 years.
 * It also covers economies the World Bank omits — Taiwan most notably.
 *
 * Why ingest-time only: the DataMapper API sends no `Access-Control-Allow-Origin`
 * header, so a browser fetch is blocked. `npm run ingest` pulls it in Node and
 * commits a snapshot, which the app reads synchronously at load. Do not call
 * `fetchWeoIndicator` from client code — it will fail CORS in the browser.
 */

const WEO_API = 'https://www.imf.org/external/datamapper/api/v1';

/**
 * Tracked country id → IMF economy code (ISO 3166-1 alpha-3, with IMF's own
 * codes where they diverge: Kosovo is `UVK`, not `XKX`).
 *
 * Cuba and North Korea are intentionally absent — neither reports to the WEO,
 * so they fall through to the curated dataset like they always have.
 */
export const countryIso3: Record<string, string> = {
  // --- Americas ---
  'united-states':             'USA',
  'canada':                    'CAN',
  'mexico':                    'MEX',
  'brazil':                    'BRA',
  'argentina':                 'ARG',
  'venezuela':                 'VEN',
  'colombia':                  'COL',
  'chile':                     'CHL',
  'peru':                      'PER',
  'bolivia':                   'BOL',
  'ecuador':                   'ECU',
  'paraguay':                  'PRY',
  'uruguay':                   'URY',
  'guatemala':                 'GTM',
  'costa-rica':                'CRI',
  'panama':                    'PAN',
  'dominican-republic':        'DOM',
  // --- Europe ---
  'germany':                   'DEU',
  'france':                    'FRA',
  'united-kingdom':            'GBR',
  'italy':                     'ITA',
  'spain':                     'ESP',
  'poland':                    'POL',
  'netherlands':               'NLD',
  'belgium':                   'BEL',
  'sweden':                    'SWE',
  'norway':                    'NOR',
  'denmark':                   'DNK',
  'finland':                   'FIN',
  'switzerland':               'CHE',
  'austria':                   'AUT',
  'portugal':                  'PRT',
  'greece':                    'GRC',
  'czechia':                   'CZE',
  'romania':                   'ROU',
  'hungary':                   'HUN',
  'ukraine':                   'UKR',
  'turkey':                    'TUR',
  'bulgaria':                  'BGR',
  'croatia':                   'HRV',
  'slovakia':                  'SVK',
  'estonia':                   'EST',
  'latvia':                    'LVA',
  'lithuania':                 'LTU',
  'serbia':                    'SRB',
  'ireland':                   'IRL',
  'iceland':                   'ISL',
  'luxembourg':                'LUX',
  'slovenia':                  'SVN',
  'cyprus':                    'CYP',
  'albania':                   'ALB',
  'bosnia-and-herzegovina':    'BIH',
  'north-macedonia':           'MKD',
  'montenegro':                'MNE',
  'kosovo':                    'UVK',
  'belarus':                   'BLR',
  'moldova':                   'MDA',
  // --- Russia & Central Asia ---
  'russia':                    'RUS',
  'kazakhstan':                'KAZ',
  'uzbekistan':                'UZB',
  'tajikistan':                'TJK',
  'kyrgyzstan':                'KGZ',
  'turkmenistan':              'TKM',
  'azerbaijan':                'AZE',
  'armenia':                   'ARM',
  'georgia':                   'GEO',
  // --- Middle East ---
  'iran':                      'IRN',
  'iraq':                      'IRQ',
  'israel':                    'ISR',
  'saudi-arabia':              'SAU',
  'uae':                       'ARE',
  'jordan':                    'JOR',
  'kuwait':                    'KWT',
  'qatar':                     'QAT',
  'oman':                      'OMN',
  'bahrain':                   'BHR',
  'syria':                     'SYR',
  'lebanon':                   'LBN',
  'yemen':                     'YEM',
  'libya':                     'LBY',
  // --- South Asia ---
  'india':                     'IND',
  'pakistan':                  'PAK',
  'bangladesh':                'BGD',
  'sri-lanka':                 'LKA',
  'nepal':                     'NPL',
  'afghanistan':               'AFG',
  // --- East Asia ---
  'china':                     'CHN',
  'japan':                     'JPN',
  'south-korea':               'KOR',
  'taiwan':                    'TWN',
  'mongolia':                  'MNG',
  // --- South-East Asia ---
  'vietnam':                   'VNM',
  'thailand':                  'THA',
  'philippines':               'PHL',
  'indonesia':                 'IDN',
  'malaysia':                  'MYS',
  'singapore':                 'SGP',
  'myanmar':                   'MMR',
  'cambodia':                  'KHM',
  'laos':                      'LAO',
  'brunei':                    'BRN',
  // --- Oceania ---
  'australia':                 'AUS',
  'new-zealand':               'NZL',
  'papua-new-guinea':          'PNG',
  // --- North Africa ---
  'egypt':                     'EGY',
  'morocco':                   'MAR',
  'algeria':                   'DZA',
  'tunisia':                   'TUN',
  // --- Sub-Saharan Africa ---
  'nigeria':                   'NGA',
  'south-africa':              'ZAF',
  'ethiopia':                  'ETH',
  'kenya':                     'KEN',
  'ghana':                     'GHA',
  'tanzania':                  'TZA',
  'dem-rep-congo':             'COD',
  'angola':                    'AGO',
  'sudan':                     'SDN',
  'south-sudan':               'SSD',
  'somalia':                   'SOM',
  'zimbabwe':                  'ZWE',
  'mozambique':                'MOZ',
  'rwanda':                    'RWA',
  'uganda':                    'UGA',
  'mali':                      'MLI',
  'niger':                     'NER',
  'cote-divoire':              'CIV',
  'cameroon':                  'CMR',
  'senegal':                   'SEN',
  'botswana':                  'BWA',
  'zambia':                    'ZMB',
  'burkina-faso':              'BFA',
  'madagascar':                'MDG',};

/** Reverse lookup: IMF economy code → tracked country id. */
export const iso3ToCountryId: Record<string, string> = Object.fromEntries(
  Object.entries(countryIso3).map(([id, iso]) => [iso, id]),
);

export type WeoIndicator =
  | 'NGDP_RPCH'    // Real GDP growth (annual % change)
  | 'PCPIPCH'      // Inflation, average consumer prices (annual % change)
  | 'NGDPD'        // GDP, current prices (billions USD)
  | 'NGDPDPC'      // GDP per capita, current prices (USD)
  | 'LUR'          // Unemployment rate (% of labour force)
  | 'GGXWDG_NGDP'  // General government gross debt (% of GDP)
  | 'BCA_NGDPD'    // Current account balance (% of GDP)
  | 'LP';          // Population (millions)

export interface WeoIndicatorConfig {
  code: WeoIndicator;
  /** Key used in the committed snapshot file. */
  snapshotKey: WeoSnapshotKey;
  label: string;
  unit: string;
}

export type WeoSnapshotKey =
  | 'imf_gdp_growth'
  | 'imf_inflation'
  | 'imf_gdp_usd_billions'
  | 'imf_gdp_per_capita_usd'
  | 'imf_unemployment'
  | 'imf_government_debt_pct_gdp'
  | 'imf_current_account_pct_gdp'
  | 'imf_population_millions';

export const WEO_INDICATORS: WeoIndicatorConfig[] = [
  { code: 'NGDP_RPCH', snapshotKey: 'imf_gdp_growth', label: 'Real GDP growth', unit: '% change' },
  { code: 'PCPIPCH', snapshotKey: 'imf_inflation', label: 'Inflation, average consumer prices', unit: '% change' },
  { code: 'NGDPD', snapshotKey: 'imf_gdp_usd_billions', label: 'GDP, current prices', unit: 'USD bn' },
  { code: 'NGDPDPC', snapshotKey: 'imf_gdp_per_capita_usd', label: 'GDP per capita, current prices', unit: 'USD' },
  { code: 'LUR', snapshotKey: 'imf_unemployment', label: 'Unemployment rate', unit: '% labour force' },
  { code: 'GGXWDG_NGDP', snapshotKey: 'imf_government_debt_pct_gdp', label: 'General government gross debt', unit: '% GDP' },
  { code: 'BCA_NGDPD', snapshotKey: 'imf_current_account_pct_gdp', label: 'Current account balance', unit: '% GDP' },
  { code: 'LP', snapshotKey: 'imf_population_millions', label: 'Population', unit: 'millions' },
];

/** A single WEO observation: the value plus the year it describes. */
export interface WeoObservation {
  value: number;
  /** Four-digit reference year. */
  year: string;
  /**
   * True when the year is not yet complete, so the figure is an IMF staff
   * estimate rather than a settled outturn. Only set when no completed year
   * was available at all.
   */
  projection: boolean;
  /**
   * The IMF's figure for the *current* year, kept separate from the headline
   * value. This is a staff projection, so it must never be presented as an
   * observation — but it is the genuinely forward-looking signal the WEO exists
   * to provide, so the UI can surface it as an explicitly labelled outlook.
   */
  outlook?: { value: number; year: string };
}

/** countryId → observation, for one indicator. */
export type WeoIndicatorValues = Record<string, WeoObservation>;

interface WeoApiResponse {
  values?: Record<string, Record<string, Record<string, number | null>>>;
}

/**
 * Pick the observation to publish for one economy.
 *
 * The WEO series runs years past the present — projections to roughly +5y. The
 * app describes the world as it is, so the headline value is the newest
 * *completed* year: a year that has not finished cannot have an outturn, and
 * quietly serving a forecast as though it were data is exactly the kind of thing
 * a provenance-first tool should not do.
 *
 * The current-year figure is still captured, as `outlook`, so the forward view
 * stays available to anything that labels it honestly. Only when an economy has
 * no completed year at all does a projection become the headline, and then it is
 * flagged `projection: true`.
 */
export const pickObservation = (
  series: Record<string, number | null>,
  currentYear: number,
): WeoObservation | null => {
  let latestCompleted: { value: number; year: string } | null = null;
  let currentYearEntry: { value: number; year: string } | null = null;

  for (const [year, value] of Object.entries(series)) {
    if (value == null || !Number.isFinite(value)) continue;
    if (!/^\d{4}$/.test(year)) continue;
    const numericYear = Number(year);

    if (numericYear === currentYear) {
      currentYearEntry = { value, year };
      continue;
    }
    if (numericYear > currentYear) continue;
    if (!latestCompleted || year > latestCompleted.year) {
      latestCompleted = { value, year };
    }
  }

  if (latestCompleted) {
    return {
      ...latestCompleted,
      projection: false,
      ...(currentYearEntry ? { outlook: currentYearEntry } : {}),
    };
  }
  if (currentYearEntry) {
    return { ...currentYearEntry, projection: true };
  }
  return null;
};

export interface WeoFetchResult {
  values: WeoIndicatorValues;
  /** Newest reference year present across all economies, for the manifest. */
  newestObservation: string | null;
  coverageCount: number;
  missingCountryCount: number;
}

/**
 * Identify the client to the IMF, the convention public data APIs expect.
 *
 * This is not optional politeness: imf.org sits behind a WAF that rejects
 * requests without a contact-bearing User-Agent — including Node's default —
 * with a 403. Keep the `(+url)` contact suffix if you change this string.
 */
const USER_AGENT = 'realpolitik-ingest/1.0 (+https://github.com/thomaslawrence13/realpolitik)';

/** Retry budget for transient upstream failures (429 / 5xx / network). */
const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

/**
 * Fetch one WEO indicator for every tracked economy.
 *
 * Node-only — see the CORS note at the top of this file.
 */
export const fetchWeoIndicator = async (
  indicator: WeoIndicator,
  options?: { currentYear?: number; signal?: AbortSignal },
): Promise<WeoFetchResult> => {
  const currentYear = options?.currentYear ?? new Date().getUTCFullYear();

  let response: Response | null = null;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(`${WEO_API}/${indicator}`, {
        signal: options?.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (response.ok) break;
      if (!isRetryableStatus(response.status)) {
        throw new Error(`IMF WEO API (${indicator}): HTTP ${response.status}`);
      }
      lastError = new Error(`IMF WEO API (${indicator}): HTTP ${response.status}`);
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      lastError = error as Error;
    }
    if (attempt < MAX_ATTEMPTS) await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
  }

  if (!response?.ok) {
    throw lastError ?? new Error(`IMF WEO API (${indicator}): request failed`);
  }

  const json = (await response.json()) as WeoApiResponse;
  const byEconomy = json.values?.[indicator];
  if (!byEconomy) {
    throw new Error(`IMF WEO API (${indicator}): response contained no series`);
  }

  const values: WeoIndicatorValues = {};
  let newestObservation: string | null = null;

  for (const [economyCode, series] of Object.entries(byEconomy)) {
    const countryId = iso3ToCountryId[economyCode];
    if (!countryId || !series) continue;
    const observation = pickObservation(series, currentYear);
    if (!observation) continue;
    values[countryId] = observation;
    if (!newestObservation || observation.year > newestObservation) {
      newestObservation = observation.year;
    }
  }

  const trackedCount = Object.keys(countryIso3).length;
  return {
    values,
    newestObservation,
    coverageCount: Object.keys(values).length,
    missingCountryCount: trackedCount - Object.keys(values).length,
  };
};
