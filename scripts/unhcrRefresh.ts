/**
 * Refresh the UNHCR displacement artifact.
 *
 * The reference year is discovered rather than hardcoded: UNHCR publishes a
 * completed year in the middle of the following one, so a pinned year would go
 * quietly stale for months and then break. This walks back from the current
 * year to the newest one that actually returns rows, and records which year it
 * settled on in the artifact — displayed figures always name their year.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateUnhcrDisplacement,
  parseUnhcrItems,
  type UnhcrArtifact,
  type UnhcrPopulationRow,
} from '../src/lib/unhcrDisplacement.js';
import { ISO3_TO_ISO2 } from '../src/lib/unVotesOfficial.js';
import { countryIso2 } from '../src/lib/worldBankFetch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

const SOURCE_TITLE = 'UNHCR Refugee Data Finder';
const SOURCE_URL = 'https://www.unhcr.org/refugee-statistics/';
const API_BASE = 'https://api.unhcr.org/population/v1/population/';
const PAGE_LIMIT = 1000;
/** How far back to look for a published year before giving up. */
const MAX_YEARS_BACK = 4;

interface UnhcrResponse {
  maxPages: number;
  items: Array<Record<string, unknown>>;
}

const fetchYear = async (year: number, dimension: 'coo' | 'coa'): Promise<UnhcrPopulationRow[]> => {
  const rows: UnhcrPopulationRow[] = [];
  let page = 1;
  let maxPages = 1;
  do {
    const url = new URL(API_BASE);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    url.searchParams.set('page', String(page));
    url.searchParams.set('yearFrom', String(year));
    url.searchParams.set('yearTo', String(year));
    url.searchParams.set(`${dimension}_all`, 'true');

    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'realpolitik-data-refresh' },
    });
    if (!response.ok) throw new Error(`UNHCR ${dimension} ${year}: HTTP ${response.status}`);
    const payload = (await response.json()) as UnhcrResponse;
    maxPages = Number.isFinite(payload.maxPages) ? payload.maxPages : 1;
    rows.push(...parseUnhcrItems(payload.items ?? [], dimension));
    page++;
  } while (page <= maxPages);
  return rows;
};

const main = async () => {
  console.log('Starting UNHCR displacement refresh...');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fetchedAt = new Date().toISOString();

    let referenceYear = 0;
    let origin: UnhcrPopulationRow[] = [];
    let asylum: UnhcrPopulationRow[] = [];
    const startYear = new Date().getUTCFullYear();

    for (let year = startYear; year > startYear - MAX_YEARS_BACK; year--) {
      const candidateOrigin = await fetchYear(year, 'coo');
      if (candidateOrigin.length === 0) {
        console.log(`No UNHCR rows published for ${year} yet — trying ${year - 1}.`);
        continue;
      }
      origin = candidateOrigin;
      asylum = await fetchYear(year, 'coa');
      referenceYear = year;
      break;
    }

    if (referenceYear === 0) {
      throw new Error(`no published UNHCR year found in the last ${MAX_YEARS_BACK} years`);
    }

    const trackedIso2 = new Set(Object.values(countryIso2));
    const perCountry = aggregateUnhcrDisplacement(origin, asylum, ISO3_TO_ISO2, trackedIso2);
    if (Object.keys(perCountry).length === 0) {
      throw new Error('no UNHCR row mapped to a tracked country — ISO mapping may have drifted');
    }

    const artifact: UnhcrArtifact = {
      fetchedAt,
      referenceYear,
      sourceTitle: `${SOURCE_TITLE} (${referenceYear})`,
      sourceUrl: SOURCE_URL,
      originCountryCount: new Set(origin.map((row) => row.iso3)).size,
      asylumCountryCount: new Set(asylum.map((row) => row.iso3)).size,
      perCountry,
    };

    const artifactPath = path.join(DATA_DIR, 'unhcr_displacement.json');
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

    console.log(`Saved UNHCR displacement artifact to ${artifactPath}`);
    console.log(
      `Reference year ${referenceYear}; origin rows ${origin.length}, asylum rows ${asylum.length}; ` +
        `tracked countries with reported displacement: ${Object.keys(perCountry).length}.`,
    );
  } catch (error) {
    console.error('UNHCR refresh failed:', error);
    process.exit(1);
  }
};

await main();
