import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateUcdpConflict, parseUcdpOvCsv } from '../src/lib/ucdp.js';
import type { UcdpArtifact } from '../src/lib/ucdp.js';
import { buildNameToIso } from '../src/lib/unVotes.js';
import { UCDP_NAME_ALIASES } from '../src/lib/ucdp.js';
import { countryIso2 } from '../src/lib/worldBankFetch.js';
import { extractTextFromZip } from '../src/lib/zip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

const UCDP_OVCY_URL = 'https://ucdp.uu.se/downloads/organizedviolencecy/organizedviolencecy-261-csv.zip';
const SOURCE_TITLE =
  'UCDP Country-Year Dataset on Organized Violence within Country Borders, version 26.1 (Uppsala Conflict Data Program)';
const SOURCE_URL = 'https://ucdp.uu.se/downloads/';
const VERSION = '26.1';
const WINDOW_FROM_YEAR = 2016;

const main = async () => {
  console.log('Starting building UCDP conflict artifact...');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fetchedAt = new Date().toISOString();
    const response = await fetch(UCDP_OVCY_URL, { headers: { 'User-Agent': 'realpolitik-data-refresh' } });
    if (!response.ok) throw new Error(`unable to download UCDP zip: HTTP ${response.status}`);
    const zip = Buffer.from(await response.arrayBuffer());
    const csvText = extractTextFromZip(zip);
    console.log(`UCDP CSV: ${(csvText.length / 1024).toFixed(0)} KB.`);

    const rows = parseUcdpOvCsv(csvText);
    if (rows.length === 0) throw new Error('parsed zero country-year rows — schema drift?');
    const nameToIso = buildNameToIso(countryIso2, UCDP_NAME_ALIASES);
    const { years, perCountry } = aggregateUcdpConflict(rows, nameToIso, { fromYear: WINDOW_FROM_YEAR });

    const artifactPath = path.join(DATA_DIR, 'ucdp_conflict.json');
    const artifact: UcdpArtifact = {
      fetchedAt,
      sourceTitle: SOURCE_TITLE,
      sourceUrl: SOURCE_URL,
      version: VERSION,
      window: { fromYear: WINDOW_FROM_YEAR, throughYear: Math.max(...years, WINDOW_FROM_YEAR) },
      perCountry,
    };
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
    console.log(`Saved UCDP conflict artifact to ${artifactPath}`);
    console.log(`Years: ${years.length}; countries: ${Object.keys(perCountry).length}.`);
  } catch (error) {
    console.error('UCDP refresh failed:', error);
    process.exit(1);
  }
};

await main();