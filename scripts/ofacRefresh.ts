import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateOfacByCountry, parseSdnCsv } from '../src/lib/ofacSdn.js';
import type { OfacSummary } from '../src/lib/ofacSdn.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

const SOURCE_TITLE = 'US Treasury OFAC Specially Designated Nationals (SDN) list';
const SOURCE_URL = 'https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists';
const OFAC_SOURCES = [
  'https://www.treasury.gov/ofac/downloads/sdn.csv',
  'https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.csv',
];

const download = async (urls: string[]): Promise<string> => {
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/csv', 'User-Agent': 'realpolitik-data-refresh' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`OFAC source failed (${url}): ${lastError.message}`);
    }
  }
  throw new Error(`all OFAC mirrors failed; last error: ${lastError?.message}`);
};

async function main() {
  console.log('Starting OFAC sanctions registry refresh...');

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fetchedAt = new Date().toISOString();

    const csvText = await download(OFAC_SOURCES);
    const rows = parseSdnCsv(csvText);
    if (rows.length === 0) throw new Error('parsed zero sanction entries — column layout may have changed');

    const perCountry = aggregateOfacByCountry(rows);
    const entryTotal = rows.length;

    const artifactPath = path.join(DATA_DIR, 'ofac_sanctions_registry.json');
    const artifact: OfacSummary = {
      fetchedAt,
      sourceTitle: SOURCE_TITLE,
      sourceUrl: SOURCE_URL,
      entryTotal,
      perCountry,
    };
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

    console.log(`Saved OFAC registry to ${artifactPath}`);
    console.log(`Entries: ${entryTotal.toLocaleString()}; countries with listings: ${Object.keys(perCountry).length}.`);
  } catch (error) {
    console.error('OFAC refresh failed:', error);
    process.exit(1);
  }
}

main();