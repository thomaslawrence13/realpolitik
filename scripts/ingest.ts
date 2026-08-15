import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countryIso2 } from '../src/data/worldBankClient.js';
import {
  WEO_INDICATORS,
  countryIso3,
  fetchWeoIndicator,
  type WeoFetchResult,
  type WeoSnapshotKey,
} from '../src/data/imfWeoClient.js';
import type { ImfWeoSnapshot } from '../src/data/pipeline/externalProviders.js';
import { buildHistoricalSeriesArtifact } from '../src/lib/historicalSeriesArtifact.js';
import type { WbDataPoint, WbIndicatorCode } from '../src/lib/worldBankFetch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');
const RAW_DATA_DIR = path.join(DATA_DIR, 'raw');

const WB_API = 'https://api.worldbank.org/v2';
const isoCodes = Object.values(countryIso2).join(';');
const isoToCountryId = new Map(Object.entries(countryIso2).map(([countryId, iso]) => [iso, countryId]));

type SnapshotKey =
  | 'world_bank_military_expenditure_pct'
  | 'world_bank_military_expenditure_usd'
  | 'world_bank_trade_pct'
  | 'world_bank_gdp_growth'
  | 'world_bank_inflation'
  | 'world_bank_political_stability'
  | 'world_bank_rule_of_law'
  | 'world_bank_unemployment'
  | 'world_bank_population'
  | 'world_bank_urban_pct'
  | 'world_bank_gdp_usd'
  | 'world_bank_gdp_per_capita_usd'
  | 'world_bank_energy_import_pct';

type IndicatorConfig = {
  snapshotKey: SnapshotKey;
  code: string;
  label: string;
  apiSourceId?: string;
  provenanceSourceId?: 'world-bank-wdi' | 'world-bank-wgi';
};

type WorldBankPoint = {
  country: { id: string; value: string };
  date: string;
  value: number | null;
};

type IndicatorFetchResult = {
  values: Record<string, number>;
  /** countryId → ISO date of that country's newest observation. */
  observedAt: Record<string, string>;
  rawPoints: WorldBankPoint[];
  newestObservation: string | null;
  coverageCount: number;
  missingCountryCount: number;
};

type IngestSnapshot = {
  version: string;
  timestamp: string;
  countryCountRequested: number;
  /**
   * Reference date of each country's newest observation, per series.
   *
   * Precomputed here so the app never has to parse the raw audit payload: that
   * file is several megabytes of per-year API rows, and importing it to recover
   * ~1,600 dates put all of it into the client bundle.
   */
  observation_dates: Partial<Record<SnapshotKey, Record<string, string>>>;
} & Record<SnapshotKey, Record<string, number>>;

type ManifestIndicator = {
  snapshotKey: string;
  code: string;
  sourceId: string;
  label: string;
  coverageCount: number;
  missingCountryCount: number;
  newestObservation: string | null;
};

type IngestManifest = {
  version: string;
  generatedAt: string;
  /** Kept for backwards compatibility with readers that expect a single provider. */
  provider: string;
  requestedCountryCount: number;
  indicators: ManifestIndicator[];
  /** Per-source breakdown, newest-first by publication cadence. */
  sources: Array<{
    sourceId: string;
    provider: string;
    requestedCountryCount: number;
    indicators: ManifestIndicator[];
  }>;
};

const indicators: IndicatorConfig[] = [
  {
    snapshotKey: 'world_bank_military_expenditure_pct',
    code: 'MS.MIL.XPND.GD.ZS',
    label: 'Military expenditure (% of GDP)',
  },
  {
    snapshotKey: 'world_bank_military_expenditure_usd',
    code: 'MS.MIL.XPND.CD',
    label: 'Military expenditure (current US$)',
  },
  {
    snapshotKey: 'world_bank_trade_pct',
    code: 'TG.VAL.TOTL.GD.ZS',
    label: 'Trade (% of GDP)',
  },
  {
    snapshotKey: 'world_bank_gdp_growth',
    code: 'NY.GDP.MKTP.KD.ZG',
    label: 'GDP growth (annual %)',
  },
  {
    snapshotKey: 'world_bank_inflation',
    code: 'FP.CPI.TOTL.ZG',
    label: 'Inflation, consumer prices (annual %)',
  },
  {
    snapshotKey: 'world_bank_political_stability',
    code: 'GOV_WGI_PV.EST',
    label: 'Political stability and absence of violence',
    apiSourceId: '3',
    provenanceSourceId: 'world-bank-wgi',
  },
  {
    snapshotKey: 'world_bank_rule_of_law',
    code: 'GOV_WGI_RL.EST',
    label: 'Rule of law',
    apiSourceId: '3',
    provenanceSourceId: 'world-bank-wgi',
  },
  {
    snapshotKey: 'world_bank_unemployment',
    code: 'SL.UEM.TOTL.ZS',
    label: 'Unemployment, total (% of labour force)',
  },
  // Structural series below feed the map choropleths and inspector panels.
  // They move slowly, so they are ingested rather than fetched per page load —
  // adding them to the live browser fetch would double request count for data
  // that changes once a year.
  {
    snapshotKey: 'world_bank_population',
    code: 'SP.POP.TOTL',
    label: 'Population, total',
  },
  {
    snapshotKey: 'world_bank_urban_pct',
    code: 'SP.URB.TOTL.IN.ZS',
    label: 'Urban population (% of total)',
  },
  {
    snapshotKey: 'world_bank_gdp_usd',
    code: 'NY.GDP.MKTP.CD',
    label: 'GDP, current US$',
  },
  {
    snapshotKey: 'world_bank_gdp_per_capita_usd',
    code: 'NY.GDP.PCAP.CD',
    label: 'GDP per capita, current US$',
  },
  {
    snapshotKey: 'world_bank_energy_import_pct',
    code: 'EG.IMP.CONS.ZS',
    label: 'Energy imports, net (% of energy use)',
  },
];

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

/** Drop observations older than this — WDI lags 1–3y, but 2014-era rows are too stale to surface. */
const MAX_OBSERVATION_AGE_YEARS = 6;
const minAcceptedYear = () => String(new Date().getUTCFullYear() - MAX_OBSERVATION_AGE_YEARS);

/** Prefer newest non-null annual observation per country (not API row order). */
const pickNewestValues = (
  points: WorldBankPoint[],
): {
  values: Record<string, number>;
  observedAt: Record<string, string>;
  newestObservation: string | null;
} => {
  const floorYear = minAcceptedYear();
  const best = new Map<string, { year: string; value: number }>();
  for (const point of points) {
    if (point.value === null || point.value === undefined) continue;
    const iso = point.country.id.toUpperCase();
    const countryId = isoToCountryId.get(iso);
    if (!countryId) continue;
    const year = String(point.date ?? '').slice(0, 4);
    if (!/^\d{4}$/.test(year) || year < floorYear) continue;
    const prev = best.get(countryId);
    if (!prev || year > prev.year) {
      best.set(countryId, { year, value: point.value });
    }
  }

  const values: Record<string, number> = {};
  const observedAt: Record<string, string> = {};
  let newestObservation: string | null = null;
  for (const [countryId, row] of best) {
    values[countryId] = row.value;
    // WDI series are annual; date them to the year end so staleness maths and
    // vintage comparisons have a real date to work with.
    observedAt[countryId] = `${row.year}-12-31`;
    if (!newestObservation || row.year > newestObservation) {
      newestObservation = row.year;
    }
  }
  return { values, observedAt, newestObservation };
};

async function fetchWbIndicator(
  indicator: IndicatorConfig,
): Promise<IndicatorFetchResult> {
  const sourceParam = indicator.apiSourceId ? `&source=${indicator.apiSourceId}` : '';
  // mrv=10 recovers sparse reporters (conflict zones, small states) that lack the
  // latest 1–3 years but still publish older WDI observations.
  const url =
    `${WB_API}/country/${isoCodes}/indicator/${indicator.code}` +
    `?format=json&mrv=10&per_page=2000${sourceParam}`;

  console.log(`Fetching ${indicator.code} (${indicator.label})...`);
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`World Bank API (${indicator.code}): HTTP ${response.status}`);

  const json = (await response.json()) as [unknown, WorldBankPoint[] | null];
  const points = json[1] ?? [];
  const { values, observedAt, newestObservation } = pickNewestValues(points);

  return {
    values,
    observedAt,
    rawPoints: points,
    newestObservation,
    coverageCount: Object.keys(values).length,
    missingCountryCount: Object.keys(countryIso2).length - Object.keys(values).length,
  };
}

const emptySnapshotValues = (): Record<SnapshotKey, Record<string, number>> => ({
  world_bank_military_expenditure_pct: {},
  world_bank_military_expenditure_usd: {},
  world_bank_trade_pct: {},
  world_bank_gdp_growth: {},
  world_bank_inflation: {},
  world_bank_political_stability: {},
  world_bank_rule_of_law: {},
  world_bank_unemployment: {},
  world_bank_population: {},
  world_bank_urban_pct: {},
  world_bank_gdp_usd: {},
  world_bank_gdp_per_capita_usd: {},
  world_bank_energy_import_pct: {},
});

/**
 * Fetch the IMF World Economic Outlook.
 *
 * Requests are sequential rather than parallel: the DataMapper endpoint returns
 * the *entire* series for every economy on each call (~120 KB a piece), and
 * firing eight of those at once has drawn rate limiting.
 */
async function fetchWeoSnapshot(fetchedAt: string): Promise<{
  snapshot: ImfWeoSnapshot;
  manifestIndicators: ManifestIndicator[];
}> {
  const currentYear = new Date().getUTCFullYear();
  const snapshot = {
    version: '1.0.0-weo',
    timestamp: fetchedAt,
    countryCountRequested: Object.keys(countryIso3).length,
  } as ImfWeoSnapshot;
  const manifestIndicators: ManifestIndicator[] = [];

  for (const indicator of WEO_INDICATORS) {
    console.log(`Fetching IMF WEO ${indicator.code} (${indicator.label})...`);
    let result: WeoFetchResult;
    try {
      result = await fetchWeoIndicator(indicator.code, { currentYear });
    } catch (error) {
      // A single missing WEO series must not sink the whole ingest — the World
      // Bank half still has value, and the app falls back per indicator anyway.
      console.warn(`  skipped ${indicator.code}: ${(error as Error).message}`);
      snapshot[indicator.snapshotKey] = {};
      manifestIndicators.push({
        snapshotKey: indicator.snapshotKey,
        code: indicator.code,
        sourceId: 'imf-weo',
        label: indicator.label,
        coverageCount: 0,
        missingCountryCount: Object.keys(countryIso3).length,
        newestObservation: null,
      });
      continue;
    }

    snapshot[indicator.snapshotKey] = result.values;
    manifestIndicators.push({
      snapshotKey: indicator.snapshotKey,
      code: indicator.code,
      sourceId: 'imf-weo',
      label: indicator.label,
      coverageCount: result.coverageCount,
      missingCountryCount: result.missingCountryCount,
      newestObservation: result.newestObservation,
    });
    console.log(
      `  ${result.coverageCount}/${Object.keys(countryIso3).length} economies, newest ${result.newestObservation ?? 'n/a'}`,
    );
  }

  return { snapshot, manifestIndicators };
}

async function main() {
  console.log('Starting data ingestion (IMF World Economic Outlook + World Bank)...');

  try {
    ensureDir(DATA_DIR);
    ensureDir(RAW_DATA_DIR);

    const fetchedAt = new Date().toISOString();
    const results = await Promise.all(indicators.map(async (indicator) => [indicator, await fetchWbIndicator(indicator)] as const));
    const weo = await fetchWeoSnapshot(fetchedAt);

    const dataset: IngestSnapshot = {
      version: '1.6.0-ingested',
      timestamp: fetchedAt,
      countryCountRequested: Object.keys(countryIso2).length,
      observation_dates: {},
      ...emptySnapshotValues(),
    };

    const worldBankIndicators: ManifestIndicator[] = [];
    const rawAudit: Record<string, WorldBankPoint[]> = {};

    for (const [indicator, result] of results) {
      dataset[indicator.snapshotKey] = result.values;
      dataset.observation_dates[indicator.snapshotKey] = result.observedAt;
      rawAudit[indicator.code] = result.rawPoints;
      worldBankIndicators.push({
        snapshotKey: indicator.snapshotKey,
        code: indicator.code,
        sourceId: indicator.provenanceSourceId ?? 'world-bank-wdi',
        label: indicator.label,
        coverageCount: result.coverageCount,
        missingCountryCount: result.missingCountryCount,
        newestObservation: result.newestObservation,
      });
    }

    const worldBankWdiIndicators = worldBankIndicators.filter(
      (indicator) => indicator.sourceId === 'world-bank-wdi',
    );
    const worldBankWgiIndicators = worldBankIndicators.filter(
      (indicator) => indicator.sourceId === 'world-bank-wgi',
    );
    const manifest: IngestManifest = {
      version: '2.0.0',
      generatedAt: fetchedAt,
      provider: 'world-bank-open-data',
      requestedCountryCount: Object.keys(countryIso2).length,
      // Flat list retains the v1 shape for existing readers.
      indicators: [...weo.manifestIndicators, ...worldBankIndicators],
      sources: [
        {
          sourceId: 'imf-weo',
          provider: 'imf-datamapper-weo',
          requestedCountryCount: Object.keys(countryIso3).length,
          indicators: weo.manifestIndicators,
        },
        {
          sourceId: 'world-bank-wdi',
          provider: 'world-bank-open-data',
          requestedCountryCount: Object.keys(countryIso2).length,
          indicators: worldBankWdiIndicators,
        },
        {
          sourceId: 'world-bank-wgi',
          provider: 'world-bank-worldwide-governance-indicators',
          requestedCountryCount: Object.keys(countryIso2).length,
          indicators: worldBankWgiIndicators,
        },
      ],
    };

    const snapshotPath = path.join(DATA_DIR, 'ingested_snapshot.json');
    const weoSnapshotPath = path.join(DATA_DIR, 'imf_weo_snapshot.json');
    const manifestPath = path.join(DATA_DIR, 'ingest_manifest.json');
    const rawAuditPath = path.join(RAW_DATA_DIR, 'world_bank_latest.json');
    const historicalSeriesPath = path.join(DATA_DIR, 'historical_indicator_series.json');
    const historicalSeries = buildHistoricalSeriesArtifact(
      fetchedAt,
      rawAudit as Partial<Record<WbIndicatorCode, WbDataPoint[]>>,
    );

    fs.writeFileSync(snapshotPath, JSON.stringify(dataset, null, 2));
    fs.writeFileSync(weoSnapshotPath, JSON.stringify(weo.snapshot, null, 2));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    fs.writeFileSync(rawAuditPath, JSON.stringify({ fetchedAt, indicators: rawAudit }, null, 2));
    fs.writeFileSync(historicalSeriesPath, JSON.stringify(historicalSeries, null, 2));

    console.log(`Saved normalized World Bank snapshot to ${snapshotPath}`);
    console.log(`Saved IMF WEO snapshot to ${weoSnapshotPath}`);
    console.log(`Saved ingest manifest to ${manifestPath}`);
    console.log(`Saved raw audit payload to ${rawAuditPath}`);
    console.log(`Saved compact historical series to ${historicalSeriesPath}`);
  } catch (error) {
    console.error('Data ingestion failed!', error);
    process.exit(1);
  }
}

main().catch(console.error);
