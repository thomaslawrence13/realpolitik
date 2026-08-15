/**
 * Runtime-agnostic World Bank Open Data fetch utilities.
 *
 * Shared by three runtimes — browser client, `scripts/ingest.ts`, and the
 * Cloudflare Worker cron — which must agree on the same indicator set, the
 * same "newest non-null year per country" selection, and the same recency
 * floor. This module imports nothing (no logger, no DOM), so it typechecks
 * cleanly under both the DOM lib and the Workers lib.
 */

export const WB_API = 'https://api.worldbank.org/v2';

/** How many most-recent annual observations to request per country. */
export const MRV_YEARS = 10;
/** Drop observations older than this — WDI lags 1–3y, but 2014-era rows are too stale to surface. */
export const MAX_OBSERVATION_AGE_YEARS = 6;

export type WbIndicatorKey =
  | 'militaryExpPct'
  | 'militaryExpUsd'
  | 'tradePct'
  | 'gdpGrowth'
  | 'gdpNominalUsd'
  | 'gdpPerCapitaUsd'
  | 'inflation'
  | 'politicalStability'
  | 'ruleOfLaw'
  | 'unemployment';

export type WbIndicatorCode =
  | 'MS.MIL.XPND.GD.ZS'
  | 'MS.MIL.XPND.CD'
  | 'TG.VAL.TOTL.GD.ZS'
  | 'NY.GDP.MKTP.KD.ZG'
  | 'NY.GDP.MKTP.CD'
  | 'NY.GDP.PCAP.CD'
  | 'FP.CPI.TOTL.ZG'
  | 'PV.EST'
  | 'RL.EST'
  | 'SL.UEM.TOTL.ZS';

export type WbIndicatorDef = {
  key: WbIndicatorKey;
  /** The canonical code used in diagnostics and KV payloads. */
  code: WbIndicatorCode;
  /** Dataset registry source credited in observation provenance. */
  provenanceSourceId: 'world-bank-wdi' | 'world-bank-wgi';
  /** The code actually accepted on the wire (WGI indicators need a GOV_ prefix). */
  requestCode: string;
  /** World Bank API catalogue id (WGI lives under source 3, not default WDI). */
  apiSourceId?: string;
  label: string;
};

export const WB_INDICATORS: WbIndicatorDef[] = [
  { key: 'militaryExpPct', code: 'MS.MIL.XPND.GD.ZS', provenanceSourceId: 'world-bank-wdi', requestCode: 'MS.MIL.XPND.GD.ZS', label: 'Military expenditure (% of GDP)' },
  { key: 'militaryExpUsd', code: 'MS.MIL.XPND.CD', provenanceSourceId: 'world-bank-wdi', requestCode: 'MS.MIL.XPND.CD', label: 'Military expenditure (current US$)' },
  { key: 'tradePct', code: 'TG.VAL.TOTL.GD.ZS', provenanceSourceId: 'world-bank-wdi', requestCode: 'TG.VAL.TOTL.GD.ZS', label: 'Trade (% of GDP)' },
  { key: 'gdpGrowth', code: 'NY.GDP.MKTP.KD.ZG', provenanceSourceId: 'world-bank-wdi', requestCode: 'NY.GDP.MKTP.KD.ZG', label: 'GDP growth (annual %)' },
  { key: 'gdpNominalUsd', code: 'NY.GDP.MKTP.CD', provenanceSourceId: 'world-bank-wdi', requestCode: 'NY.GDP.MKTP.CD', label: 'GDP (current US$)' },
  { key: 'gdpPerCapitaUsd', code: 'NY.GDP.PCAP.CD', provenanceSourceId: 'world-bank-wdi', requestCode: 'NY.GDP.PCAP.CD', label: 'GDP per capita (current US$)' },
  { key: 'inflation', code: 'FP.CPI.TOTL.ZG', provenanceSourceId: 'world-bank-wdi', requestCode: 'FP.CPI.TOTL.ZG', label: 'Inflation, consumer prices (annual %)' },
  { key: 'politicalStability', code: 'PV.EST', provenanceSourceId: 'world-bank-wgi', requestCode: 'GOV_WGI_PV.EST', apiSourceId: '3', label: 'Political stability and absence of violence' },
  { key: 'ruleOfLaw', code: 'RL.EST', provenanceSourceId: 'world-bank-wgi', requestCode: 'GOV_WGI_RL.EST', apiSourceId: '3', label: 'Rule of law' },
  { key: 'unemployment', code: 'SL.UEM.TOTL.ZS', provenanceSourceId: 'world-bank-wdi', requestCode: 'SL.UEM.TOTL.ZS', label: 'Unemployment, total (% of labour force)' },
];

export const WB_INDICATOR_BY_CODE = new Map(WB_INDICATORS.map((def) => [def.code, def]));
export const WB_INDICATOR_BY_KEY = new Map(WB_INDICATORS.map((def) => [def.key, def]));

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

/** ISO year keyed by country code for the value selected in an indicator map. */
export type ObservationYears = Record<string, string>;

export interface WbDataPoint {
  country: { id: string; value: string };
  date: string;
  value: number | null;
}

const MAX_WORLD_BANK_RESPONSE_CHARS = 5_000_000;
const MAX_WORLD_BANK_POINTS = 2_500;

// Some World Bank source-3/WGI rows return Taiwan with an empty country id
// while the country name is still present. Keep this normalization narrow and
// explicit so a malformed source id cannot accidentally become a tracked key.
const WB_COUNTRY_NAME_ALIASES: Record<string, string> = {
  'TAIWAN, CHINA': 'TW',
};

export const normalizeWorldBankPointIso = (point: WbDataPoint): string | null => {
  const id = String(point.country?.id ?? '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(id)) return id;
  const name = String(point.country?.value ?? '').trim().toUpperCase();
  return WB_COUNTRY_NAME_ALIASES[name] ?? null;
};

/**
 * Keep the newest non-null annual observation per country, dropping rows older
 * than the recency floor. Returns values keyed by ISO alpha-2 plus the newest
 * observation year across all countries (diagnostics).
 */
export const pickNewestValues = (
  points: WbDataPoint[],
  floorYear: string,
): { values: IndicatorValues; newestObservation: string | null; observedYears: ObservationYears } => {
  const best = new Map<string, { year: string; value: number }>();
  for (const point of points) {
    if (point.value === null || point.value === undefined) continue;
    const iso = normalizeWorldBankPointIso(point);
    if (!iso) continue;
    const year = String(point.date ?? '').slice(0, 4);
    if (!/^\d{4}$/.test(year) || year < floorYear) continue;
    const prev = best.get(iso);
    if (!prev || year > prev.year) {
      best.set(iso, { year, value: point.value });
    }
  }

  const values: IndicatorValues = {};
  const observedYears: ObservationYears = {};
  let newestObservation: string | null = null;
  for (const [iso, row] of best) {
    values[iso] = row.value;
    observedYears[iso] = row.year;
    if (!newestObservation || row.year > newestObservation) {
      newestObservation = row.year;
    }
  }
  return { values, newestObservation, observedYears };
};

/** Convert a WDI year into an explicit annual observation date. */
export const observationDateFromYear = (year: string | null | undefined): string | null => {
  if (!year || !/^\d{4}$/.test(year)) return null;
  return `${year}-12-31`;
};

export const currentFloorYear = () => String(new Date().getUTCFullYear() - MAX_OBSERVATION_AGE_YEARS);

export const buildWorldBankIndicatorUrl = (
  def: WbIndicatorDef,
  isoCodes = Object.values(countryIso2).join(';'),
): string => {
  const normalizedIsoCodes = isoCodes
    .split(';')
    .map((iso) => iso.trim().toUpperCase())
    .filter(Boolean);
  if (
    normalizedIsoCodes.length === 0 ||
    normalizedIsoCodes.length > Object.keys(countryIso2).length ||
    normalizedIsoCodes.some((iso) => !/^[A-Z]{2}$/.test(iso))
  ) {
    throw new Error('World Bank request contains invalid country codes');
  }
  const sourceParam = def.apiSourceId ? `&source=${def.apiSourceId}` : '';
  return (
    `${WB_API}/country/${normalizedIsoCodes.join(';')}/indicator/${def.requestCode}` +
    `?format=json&mrv=${MRV_YEARS}&per_page=2000${sourceParam}`
  );
};

/** Validate the untrusted API response before it enters reconciliation. */
export const parseWorldBankResponse = (value: unknown): WbDataPoint[] => {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error('World Bank API returned an invalid envelope');
  }
  const rows = value[1];
  if (rows === null) return [];
  if (!Array.isArray(rows) || rows.length > MAX_WORLD_BANK_POINTS) {
    throw new Error('World Bank API returned an invalid row set');
  }

  return rows.flatMap((row): WbDataPoint[] => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    const candidate = row as Record<string, unknown>;
    const country = candidate.country;
    if (!country || typeof country !== 'object' || Array.isArray(country)) return [];
    const countryRecord = country as Record<string, unknown>;
    if (
      typeof countryRecord.id !== 'string' ||
      typeof countryRecord.value !== 'string' ||
      typeof candidate.date !== 'string' ||
      !(candidate.value === null || (typeof candidate.value === 'number' && Number.isFinite(candidate.value)))
    ) return [];
    return [{
      country: { id: countryRecord.id, value: countryRecord.value },
      date: candidate.date,
      value: candidate.value,
    }];
  });
};

/** Fetch the raw annual rows for one indicator across all tracked ISO codes. */
export const fetchWorldBankPoints = async (
  def: WbIndicatorDef,
  options: { signal?: AbortSignal; isoCodes?: string } = {},
): Promise<WbDataPoint[]> => {
  const isoCodes = options.isoCodes ?? Object.values(countryIso2).join(';');
  // Per-page covers all countries × MRV years with headroom.
  const url = buildWorldBankIndicatorUrl(def, isoCodes);

  const response = await fetch(url, {
    signal: options.signal,
    // Prefer the network when the caller may hold a stale HTTP cache of the API.
    cache: 'no-cache',
  });
  if (!response.ok) {
    throw new Error(`World Bank API (${def.code}): HTTP ${response.status}`);
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WORLD_BANK_RESPONSE_CHARS) {
    throw new Error(`World Bank API (${def.code}): response too large`);
  }
  const body = await response.text();
  if (body.length > MAX_WORLD_BANK_RESPONSE_CHARS) {
    throw new Error(`World Bank API (${def.code}): response too large`);
  }
  try {
    return parseWorldBankResponse(JSON.parse(body));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`World Bank API (${def.code}): invalid JSON`);
    }
    throw error;
  }
};
