import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { aggregateUcdpConflict, parseUcdpOvCsv } from '../src/lib/ucdp.js';
import type { UcdpArtifact } from '../src/lib/ucdp.js';
import { buildNameToIso } from '../src/lib/unVotes.js';
import { UCDP_NAME_ALIASES } from '../src/lib/ucdp.js';
import { countryIso2 } from '../src/lib/worldBankFetch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

const UCDP_OVCY_URL = 'https://ucdp.uu.se/downloads/organizedviolencecy/organizedviolencecy-261-csv.zip';
const SOURCE_TITLE =
  'UCDP Country-Year Dataset on Organized Violence within Country Borders, version 26.1 (Uppsala Conflict Data Program)';
const SOURCE_URL = 'https://ucdp.uu.se/downloads/';
const VERSION = '26.1';
const WINDOW_FROM_YEAR = 2016;

/** Minimal ZIP reader for a single CSV entry (methods 0=stored, 8=deflate). */
const extractCsvFromZip = (zip: Buffer): string => {
  if (zip.length < 22) throw new Error('zip too small');
  const eocdOffset = zip.length - 22;
  if (zip[0] !== 0x50 || zip[1] !== 0x4b) throw new Error('not a zip (bad magic)');
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const cdSize = zip.readUInt32LE(eocdOffset + 12);
  const cdOffset = zip.readUInt32LE(eocdOffset + 16);
  const centralDir = zip.subarray(cdOffset, cdOffset + cdSize);
  let cursor = 0;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
    if (centralDir.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = centralDir.readUInt16LE(cursor + 10);
    const compressedSize = centralDir.readUInt32LE(cursor + 20);
    const uncompressedSize = centralDir.readUInt32LE(cursor + 24);
    const nameLength = centralDir.readUInt16LE(cursor + 28);
    const extraLength = centralDir.readUInt16LE(cursor + 30);
    const commentLength = centralDir.readUInt16LE(cursor + 32);
    const localOffset = centralDir.readUInt32LE(cursor + 42);
    const name = centralDir.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (/\.csv$/i.test(name)) {
      const local = zip.subarray(localOffset);
      const dataStart = local.readUInt16LE(26) + local.readUInt16LE(28) + 30; // nameLen + extraLen
      const raw = zip.subarray(localOffset + dataStart, localOffset + dataStart + compressedSize);
      const content =
        method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : undefined;
      if (!content) throw new Error(`unsupported zip method ${method} for ${name}`);
      if (content.length !== uncompressedSize) throw new Error(`zip size mismatch for ${name}`);
      return content.toString('utf8');
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error('no CSV entry found in zip');
};

const main = async () => {
  console.log('Starting building UCDP conflict artifact...');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fetchedAt = new Date().toISOString();
    const response = await fetch(UCDP_OVCY_URL, { headers: { 'User-Agent': 'realpolitik-data-refresh' } });
    if (!response.ok) throw new Error(`unable to download UCDP zip: HTTP ${response.status}`);
    const zip = Buffer.from(await response.arrayBuffer());
    const csvText = extractCsvFromZip(zip);
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