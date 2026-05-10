import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Use the ISO map defined for the client tools
import { countryIso2 } from '../src/data/worldBankClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

const WB_API = 'https://api.worldbank.org/v2';

async function fetchWbIndicator(
  indicator: string,
): Promise<Record<string, number>> {
  const isoCodes = Object.values(countryIso2).join(';');
  const url = `${WB_API}/country/${isoCodes}/indicator/${indicator}?format=json&mrv=3&per_page=1000`;
  
  console.log(`Fetching ${indicator}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`World Bank API (${indicator}): HTTP ${response.status}`);
  
  const json = await response.json();
  const points = json[1] ?? [];
  
  const result: Record<string, number> = {};
  for (const point of points) {
    const iso = point.country.id.toUpperCase();
    // Reverse lookup ISO->Country ID
    const entry = Object.entries(countryIso2).find(([id, code]) => code === iso);
    if (entry && point.value !== null && !(entry[0] in result)) {
      result[entry[0]] = point.value;
    }
  }
  return result;
}

async function main() {
  console.log('Starting data ingestion. Reaching out to World Bank APIs...');
  
  try {
    const militaryExp = await fetchWbIndicator('MS.MIL.XPND.GD.ZS');
    const tradePct = await fetchWbIndicator('TG.VAL.TOTL.GD.ZS');
    const gdpGrowth = await fetchWbIndicator('NY.GDP.MKTP.KD.ZG');
    const inflation = await fetchWbIndicator('FP.CPI.TOTL.ZG');
    
    const dataset = {
      version: '1.1.0-ingested',
      timestamp: new Date().toISOString(),
      world_bank_military_expenditure_pct: militaryExp,
      world_bank_trade_pct: tradePct,
      world_bank_gdp_growth: gdpGrowth,
      world_bank_inflation: inflation,
    };

    const outputPath = path.join(DATA_DIR, 'ingested_snapshot.json');
    fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));
    console.log(`Successfully saved ingested data to ${outputPath}`);
  } catch (error) {
    console.error('Data ingestion failed!', error);
    process.exit(1);
  }
}

main().catch(console.error);