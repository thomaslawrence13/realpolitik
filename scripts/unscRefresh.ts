/**
 * Refresh the UN Security Council Consolidated List artifact.
 *
 * The published XML is the Council's own machine-readable list, so no key,
 * account or licence negotiation stands between the repository and the
 * authority — which is precisely why it is wired ahead of sources that need
 * credentials. The artifact keeps the UN's own `dateGenerated` stamp beside
 * our `fetchedAt`, because "when we downloaded it" and "when the Council last
 * regenerated it" are different facts and only the second one dates the law.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateUnscByCountry, parseUnscConsolidatedXml } from '../src/lib/unscSanctions.js';
import type { UnscArtifact } from '../src/lib/unscSanctions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

const SOURCE_TITLE = 'United Nations Security Council Consolidated List';
const SOURCE_URL = 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list';
const UNSC_SOURCES = [
  'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
  'https://main.un.org/securitycouncil/sites/default/files/consolidated.xml',
];

/** Below this the download is assumed truncated rather than genuinely short. */
const MINIMUM_EXPECTED_LISTINGS = 500;

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
      console.warn(`UN SC source failed (${url}): ${lastError.message}`);
    }
  }
  throw new Error(`all UN SC mirrors failed; last error: ${lastError?.message}`);
};

const main = async () => {
  console.log('Starting UN Security Council consolidated list refresh...');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fetchedAt = new Date().toISOString();

    const xml = await download(UNSC_SOURCES);
    console.log(`UN SC XML: ${(xml.length / 1024).toFixed(0)} KB.`);

    const { generatedAt, listings } = parseUnscConsolidatedXml(xml);
    if (listings.length < MINIMUM_EXPECTED_LISTINGS) {
      throw new Error(
        `parsed only ${listings.length} listings (expected at least ${MINIMUM_EXPECTED_LISTINGS}) — ` +
          'truncated download or schema drift.',
      );
    }

    const { perCountry, thematicRegimes, countryRegimeCount } = aggregateUnscByCountry(listings);
    if (Object.keys(perCountry).length === 0) {
      throw new Error('no listing mapped to a country regime — UN_LIST_TYPE values may have changed.');
    }

    const artifact: UnscArtifact = {
      fetchedAt,
      generatedAt,
      sourceTitle: SOURCE_TITLE,
      sourceUrl: SOURCE_URL,
      listingTotal: listings.length,
      individualTotal: listings.filter((listing) => listing.kind === 'individual').length,
      entityTotal: listings.filter((listing) => listing.kind === 'entity').length,
      countryRegimeCount,
      thematicRegimes,
      perCountry,
    };

    const artifactPath = path.join(DATA_DIR, 'unsc_sanctions_registry.json');
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

    console.log(`Saved UN SC registry to ${artifactPath}`);
    console.log(
      `Listings: ${artifact.listingTotal.toLocaleString()} (${artifact.individualTotal} individuals, ` +
        `${artifact.entityTotal} entities); country regimes: ${countryRegimeCount}; ` +
        `mapped countries: ${Object.keys(perCountry).length}.`,
    );
    if (thematicRegimes.length > 0) {
      console.log(
        `Thematic regimes held back from country attribution: ${thematicRegimes
          .map((row) => `${row.regime} (${row.listingCount})`)
          .join(', ')}.`,
      );
    }
  } catch (error) {
    console.error('UN SC refresh failed:', error);
    process.exit(1);
  }
};

await main();
