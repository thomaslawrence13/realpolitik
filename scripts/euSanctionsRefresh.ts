/**
 * Refresh the EU Consolidated Financial Sanctions artifact.
 *
 * The published export is ~25 MB of XML, so the download is parsed and reduced
 * in memory and only the per-country summary is committed. Nothing about the
 * raw file belongs in the repository: the app needs counts and legal bases, not
 * 6,000 alias records, and the existing 6 MB World Bank audit payload is
 * already the cautionary tale for committing raw source dumps.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateEuByCountry, parseEuSanctionsXml } from '../src/lib/euSanctions.js';
import type { EuSanctionsArtifact } from '../src/lib/euSanctions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

const SOURCE_TITLE = 'EU Consolidated Financial Sanctions List';
const SOURCE_URL =
  'https://finance.ec.europa.eu/eu-and-world/sanctions-restrictive-measures/overview-sanctions-and-related-resources_en';
/**
 * The public download token is a fixed value published by DG FISMA for
 * unauthenticated access to the consolidated export; it is not a credential.
 */
const EU_SOURCES = [
  'https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw',
  'https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList/content?token=dG9rZW4tMjAxNw',
];

/** Below this the download is assumed truncated rather than genuinely short. */
const MINIMUM_EXPECTED_LISTINGS = 3000;

const download = async (urls: string[]): Promise<string> => {
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/xml', 'User-Agent': 'realpolitik-data-refresh' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`EU source failed (${url}): ${lastError.message}`);
    }
  }
  throw new Error(`all EU mirrors failed; last error: ${lastError?.message}`);
};

const main = async () => {
  console.log('Starting EU consolidated financial sanctions refresh...');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fetchedAt = new Date().toISOString();

    const xml = await download(EU_SOURCES);
    console.log(`EU XML: ${(xml.length / 1024 / 1024).toFixed(1)} MB.`);

    const { generatedAt, listings } = parseEuSanctionsXml(xml);
    if (listings.length < MINIMUM_EXPECTED_LISTINGS) {
      throw new Error(
        `parsed only ${listings.length} designations (expected at least ${MINIMUM_EXPECTED_LISTINGS}) — ` +
          'truncated download or schema drift.',
      );
    }

    const { perCountry, unattributedTotal } = aggregateEuByCountry(listings);
    if (Object.keys(perCountry).length === 0) {
      throw new Error('no designation carried a country — citizenship/address fields may have changed.');
    }

    const artifact: EuSanctionsArtifact = {
      fetchedAt,
      generatedAt,
      sourceTitle: SOURCE_TITLE,
      sourceUrl: SOURCE_URL,
      listingTotal: listings.length,
      personTotal: listings.filter((listing) => listing.subjectType === 'person').length,
      enterpriseTotal: listings.filter((listing) => listing.subjectType === 'enterprise').length,
      unattributedTotal,
      unLinkedTotal: listings.filter((listing) => listing.unitedNationId !== null).length,
      perCountry,
    };

    const artifactPath = path.join(DATA_DIR, 'eu_sanctions_registry.json');
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

    console.log(`Saved EU sanctions registry to ${artifactPath}`);
    console.log(
      `Designations: ${artifact.listingTotal.toLocaleString()} (${artifact.personTotal} persons, ` +
        `${artifact.enterpriseTotal} entities); attributed countries: ${Object.keys(perCountry).length}; ` +
        `unattributed: ${unattributedTotal}; implementing a UN listing: ${artifact.unLinkedTotal}.`,
    );
  } catch (error) {
    console.error('EU sanctions refresh failed:', error);
    process.exit(1);
  }
};

await main();
