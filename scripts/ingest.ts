import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countryIso2,
  currentFloorYear,
  fetchWorldBankPoints,
  iso2ToCountryId,
  pickNewestValues,
  WB_INDICATORS,
  type IndicatorValues,
  type WbDataPoint,
  type WbIndicatorDef,
} from '../src/lib/worldBankFetch.js';
import { buildHistoricalSeriesArtifact } from '../src/lib/historicalSeriesArtifact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');
const RAW_DATA_DIR = path.join(DATA_DIR, 'raw');

/** The persisted ingest snapshot keys values by country ID (contract with externalProviders.ts). */
const pickValuesKeyedByCountryId = (values: IndicatorValues): Record<string, number> => {
  const byId: Record<string, number> = {};
  for (const [iso, value] of Object.entries(values)) {
    const countryId = iso2ToCountryId[iso];
    if (countryId && value !== null && value !== undefined) byId[countryId] = value;
  }
  return byId;
};

type IngestSnapshot = {
  version: string;
  timestamp: string;
  countryCountRequested: number;
  world_bank_military_expenditure_pct: Record<string, number>;
  world_bank_military_expenditure_usd: Record<string, number>;
  world_bank_trade_pct: Record<string, number>;
  world_bank_gdp_growth: Record<string, number>;
  world_bank_gdp_nominal_usd: Record<string, number>;
  world_bank_gdp_per_capita_usd: Record<string, number>;
  world_bank_inflation: Record<string, number>;
  world_bank_political_stability: Record<string, number>;
  world_bank_rule_of_law: Record<string, number>;
  world_bank_unemployment: Record<string, number>;
  observationYears: Record<string, Record<string, string>>;
};

type IngestManifest = {
  version: string;
  generatedAt: string;
  provider: string;
  requestedCountryCount: number;
  indicators: Array<{
    snapshotKey: string;
    code: string;
    sourceId: WbIndicatorDef['provenanceSourceId'];
    label: string;
    coverageCount: number;
    missingCountryCount: number;
    newestObservation: string | null;
  }>;
};

const SNAPSHOT_KEYS: Record<WbIndicatorDef['key'], keyof IngestSnapshot> = {
  militaryExpPct: 'world_bank_military_expenditure_pct',
  militaryExpUsd: 'world_bank_military_expenditure_usd',
  tradePct: 'world_bank_trade_pct',
  gdpGrowth: 'world_bank_gdp_growth',
  gdpNominalUsd: 'world_bank_gdp_nominal_usd',
  gdpPerCapitaUsd: 'world_bank_gdp_per_capita_usd',
  inflation: 'world_bank_inflation',
  politicalStability: 'world_bank_political_stability',
  ruleOfLaw: 'world_bank_rule_of_law',
  unemployment: 'world_bank_unemployment',
};

const snapshotKeyForDef = (def: WbIndicatorDef) => SNAPSHOT_KEYS[def.key];

const fetchIndicator = async (
  def: WbIndicatorDef,
): Promise<{
  values: IndicatorValues;
  rawPoints: WbDataPoint[];
  newestObservation: string | null;
  observedYears: Record<string, string>;
}> => {
  console.log(`Fetching ${def.code} (${def.label})...`);
  const rawPoints = await fetchWorldBankPoints(def);
  const { values, newestObservation, observedYears } = pickNewestValues(rawPoints, currentFloorYear());
  return { values, rawPoints, newestObservation, observedYears };
};

async function main() {
  console.log('Starting data ingestion. Reaching out to World Bank APIs...');

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(RAW_DATA_DIR, { recursive: true });

    const fetchedAt = new Date().toISOString();
    const results = await Promise.all(
      WB_INDICATORS.map(async (def) => [def, await fetchIndicator(def)] as const),
    );

    const dataset: IngestSnapshot = {
      version: '1.5.0-ingested',
      timestamp: fetchedAt,
      countryCountRequested: Object.keys(countryIso2).length,
      world_bank_military_expenditure_pct: {},
      world_bank_military_expenditure_usd: {},
      world_bank_trade_pct: {},
      world_bank_gdp_growth: {},
      world_bank_gdp_nominal_usd: {},
      world_bank_gdp_per_capita_usd: {},
      world_bank_inflation: {},
      world_bank_political_stability: {},
      world_bank_rule_of_law: {},
      world_bank_unemployment: {},
      observationYears: {},
    };

    const manifest: IngestManifest = {
      version: '1.3.0',
      generatedAt: fetchedAt,
      provider: 'world-bank-open-data',
      requestedCountryCount: Object.keys(countryIso2).length,
      indicators: [],
    };

    const rawAudit: Record<string, WbDataPoint[]> = {};

    for (const [def, result] of results) {
      dataset[snapshotKeyForDef(def)] = pickValuesKeyedByCountryId(result.values);
      dataset.observationYears[snapshotKeyForDef(def)] = Object.fromEntries(
        Object.entries(result.observedYears)
          .map(([iso, year]) => [iso2ToCountryId[iso], year] as const)
          .filter(([countryId]) => Boolean(countryId)),
      );
      rawAudit[def.code] = result.rawPoints;
      manifest.indicators.push({
        snapshotKey: snapshotKeyForDef(def),
        code: def.code,
        sourceId: def.provenanceSourceId,
        label: def.label,
        coverageCount: Object.keys(result.values).length,
        missingCountryCount: Object.keys(countryIso2).length - Object.keys(result.values).length,
        newestObservation: result.newestObservation,
      });
    }

    const snapshotPath = path.join(DATA_DIR, 'ingested_snapshot.json');
    const manifestPath = path.join(DATA_DIR, 'ingest_manifest.json');
    const rawAuditPath = path.join(RAW_DATA_DIR, 'world_bank_latest.json');
    const historicalPath = path.join(DATA_DIR, 'historical_indicator_series.json');

    fs.writeFileSync(snapshotPath, JSON.stringify(dataset, null, 2));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    fs.writeFileSync(rawAuditPath, JSON.stringify({ fetchedAt, indicators: rawAudit }, null, 2));

    fs.writeFileSync(
      historicalPath,
      JSON.stringify(buildHistoricalSeriesArtifact(fetchedAt, rawAudit), null, 2),
    );

    console.log(`Saved normalized snapshot to ${snapshotPath}`);
    console.log(`Saved ingest manifest to ${manifestPath}`);
    console.log(`Saved raw audit payload to ${rawAuditPath}`);
    console.log(`Saved historical series payload to ${historicalPath}`);
  } catch (error) {
    console.error('Data ingestion failed!', error);
    process.exit(1);
  }
}

main().catch(console.error);
