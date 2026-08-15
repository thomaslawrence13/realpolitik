import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHistoricalSeriesArtifact } from '../src/lib/historicalSeriesArtifact.js';
import type { WbDataPoint, WbIndicatorCode } from '../src/lib/worldBankFetch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');
const rawPath = path.join(DATA_DIR, 'raw/world_bank_latest.json');
const outputPath = path.join(DATA_DIR, 'historical_indicator_series.json');

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8')) as {
  fetchedAt: string;
  indicators: Partial<Record<WbIndicatorCode, WbDataPoint[]>>;
};
const artifact = buildHistoricalSeriesArtifact(raw.fetchedAt, raw.indicators);
fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
console.log(`Wrote compact historical series artifact to ${outputPath}`);
