import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countryIso2 } from '../src/data/worldBankClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');
const RAW_DATA_DIR = path.join(DATA_DIR, 'raw');

const WB_API = 'https://api.worldbank.org/v2';
const isoCodes = Object.values(countryIso2).join(';');
const isoToCountryId = new Map(Object.entries(countryIso2).map(([countryId, iso]) => [iso, countryId]));

type IndicatorConfig = {
  snapshotKey:
    | 'world_bank_military_expenditure_pct'
    | 'world_bank_trade_pct'
    | 'world_bank_gdp_growth'
    | 'world_bank_inflation'
    | 'world_bank_political_stability'
    | 'world_bank_rule_of_law'
    | 'world_bank_unemployment';
  code: string;
  label: string;
  sourceId?: string;
};

type WorldBankPoint = {
  country: { id: string; value: string };
  date: string;
  value: number | null;
};

type IndicatorFetchResult = {
  values: Record<string, number>;
  rawPoints: WorldBankPoint[];
  newestObservation: string | null;
  coverageCount: number;
  missingCountryCount: number;
};

type IngestSnapshot = {
  version: string;
  timestamp: string;
  countryCountRequested: number;
  world_bank_military_expenditure_pct: Record<string, number>;
  world_bank_trade_pct: Record<string, number>;
  world_bank_gdp_growth: Record<string, number>;
  world_bank_inflation: Record<string, number>;
  world_bank_political_stability: Record<string, number>;
  world_bank_rule_of_law: Record<string, number>;
  world_bank_unemployment: Record<string, number>;
};

type IngestManifest = {
  version: string;
  generatedAt: string;
  provider: string;
  requestedCountryCount: number;
  indicators: Array<{
    snapshotKey: IndicatorConfig['snapshotKey'];
    code: string;
    label: string;
    coverageCount: number;
    missingCountryCount: number;
    newestObservation: string | null;
  }>;
};

const indicators: IndicatorConfig[] = [
  {
    snapshotKey: 'world_bank_military_expenditure_pct',
    code: 'MS.MIL.XPND.GD.ZS',
    label: 'Military expenditure (% of GDP)',
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
    sourceId: '3',
  },
  {
    snapshotKey: 'world_bank_rule_of_law',
    code: 'GOV_WGI_RL.EST',
    label: 'Rule of law',
    sourceId: '3',
  },
  {
    snapshotKey: 'world_bank_unemployment',
    code: 'SL.UEM.TOTL.ZS',
    label: 'Unemployment, total (% of labour force)',
  },
];

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

async function fetchWbIndicator(
  indicator: IndicatorConfig,
): Promise<IndicatorFetchResult> {
  const sourceParam = indicator.sourceId ? `&source=${indicator.sourceId}` : '';
  const url = `${WB_API}/country/${isoCodes}/indicator/${indicator.code}?format=json&mrv=3&per_page=1000${sourceParam}`;

  console.log(`Fetching ${indicator.code} (${indicator.label})...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`World Bank API (${indicator.code}): HTTP ${response.status}`);

  const json = (await response.json()) as [unknown, WorldBankPoint[] | null];
  const points = json[1] ?? [];

  const result: Record<string, number> = {};
  for (const point of points) {
    const iso = point.country.id.toUpperCase();
    const countryId = isoToCountryId.get(iso);
    if (countryId && point.value !== null && !(countryId in result)) {
      result[countryId] = point.value;
    }
  }

  return {
    values: result,
    rawPoints: points,
    newestObservation: points.find((point) => point.value !== null)?.date ?? null,
    coverageCount: Object.keys(result).length,
    missingCountryCount: Object.keys(countryIso2).length - Object.keys(result).length,
  };
}

async function main() {
  console.log('Starting data ingestion. Reaching out to World Bank APIs...');

  try {
    ensureDir(DATA_DIR);
    ensureDir(RAW_DATA_DIR);

    const fetchedAt = new Date().toISOString();
    const results = await Promise.all(indicators.map(async (indicator) => [indicator, await fetchWbIndicator(indicator)] as const));

    const dataset: IngestSnapshot = {
      version: '1.3.0-ingested',
      timestamp: fetchedAt,
      countryCountRequested: Object.keys(countryIso2).length,
      world_bank_military_expenditure_pct: {},
      world_bank_trade_pct: {},
      world_bank_gdp_growth: {},
      world_bank_inflation: {},
      world_bank_political_stability: {},
      world_bank_rule_of_law: {},
      world_bank_unemployment: {},
    };

    const manifest: IngestManifest = {
      version: '1.1.0',
      generatedAt: fetchedAt,
      provider: 'world-bank-open-data',
      requestedCountryCount: Object.keys(countryIso2).length,
      indicators: [],
    };

    const rawAudit: Record<string, WorldBankPoint[]> = {};

    for (const [indicator, result] of results) {
      dataset[indicator.snapshotKey] = result.values;
      rawAudit[indicator.code] = result.rawPoints;
      manifest.indicators.push({
        snapshotKey: indicator.snapshotKey,
        code: indicator.code,
        label: indicator.label,
        coverageCount: result.coverageCount,
        missingCountryCount: result.missingCountryCount,
        newestObservation: result.newestObservation,
      });
    }

    const snapshotPath = path.join(DATA_DIR, 'ingested_snapshot.json');
    const manifestPath = path.join(DATA_DIR, 'ingest_manifest.json');
    const rawAuditPath = path.join(RAW_DATA_DIR, 'world_bank_latest.json');

    fs.writeFileSync(snapshotPath, JSON.stringify(dataset, null, 2));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    fs.writeFileSync(rawAuditPath, JSON.stringify({ fetchedAt, indicators: rawAudit }, null, 2));

    console.log(`Saved normalized snapshot to ${snapshotPath}`);
    console.log(`Saved ingest manifest to ${manifestPath}`);
    console.log(`Saved raw audit payload to ${rawAuditPath}`);
  } catch (error) {
    console.error('Data ingestion failed!', error);
    process.exit(1);
  }
}

main().catch(console.error);
