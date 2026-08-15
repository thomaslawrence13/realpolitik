/**
 * Refresh the FAOSTAT food security artifact.
 *
 * The archive is ~2 MB compressed and ~50 MB expanded across 68 indicators;
 * only the six the app surfaces are retained, so the committed artifact stays
 * in the tens of KB. The expanded CSV is never written to disk — the existing
 * 6 MB World Bank audit payload is the standing example of a raw dump that
 * outlived its usefulness in the repository.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateFaoFoodSecurity,
  FAO_INDICATORS,
  FAO_NAME_ALIASES,
  parseFaoFoodSecurityCsv,
  summarizeFaoArtifact,
} from '../src/lib/faoFoodSecurity.js';
import type { FaoFoodSecurityArtifact, FaoIndicatorKey } from '../src/lib/faoFoodSecurity.js';
import { buildNameToIso } from '../src/lib/unVotes.js';
import { countryIso2 } from '../src/lib/worldBankFetch.js';
import { extractTextFromZip } from '../src/lib/zip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

const SOURCE_TITLE = 'FAOSTAT Suite of Food Security Indicators';
const SOURCE_URL = 'https://www.fao.org/faostat/en/#data/FS';
const FAO_URL =
  'https://bulks-faostat.fao.org/production/Food_Security_Data_E_All_Data_(Normalized).zip';

/** Below this the extract is assumed truncated rather than genuinely small. */
const MINIMUM_EXPECTED_COUNTRIES = 100;

const main = async () => {
  console.log('Starting FAOSTAT food security refresh...');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fetchedAt = new Date().toISOString();

    const response = await fetch(FAO_URL, { headers: { 'User-Agent': 'realpolitik-data-refresh' } });
    if (!response.ok) throw new Error(`unable to download FAOSTAT zip: HTTP ${response.status}`);
    const zip = Buffer.from(await response.arrayBuffer());

    // The archive also carries codebooks (AreaCodes, ItemCodes, Flags); the
    // data file is the one with "All_Data" in its name.
    const csvText = extractTextFromZip(zip, {
      match: (name) => /All_Data.*\.csv$/i.test(name),
    });
    console.log(`FAOSTAT CSV: ${(csvText.length / 1024 / 1024).toFixed(1)} MB.`);

    const rows = parseFaoFoodSecurityCsv(csvText);
    if (rows.length === 0) throw new Error('parsed zero rows for the selected indicators — schema drift?');

    const nameToIso = buildNameToIso(countryIso2, FAO_NAME_ALIASES);
    const { perCountry, newestPeriodEndYear } = aggregateFaoFoodSecurity(rows, nameToIso);
    const countryCount = Object.keys(perCountry).length;
    if (countryCount < MINIMUM_EXPECTED_COUNTRIES) {
      throw new Error(
        `only ${countryCount} countries mapped (expected at least ${MINIMUM_EXPECTED_COUNTRIES}) — ` +
          'FAO area naming may have changed.',
      );
    }

    const artifact: FaoFoodSecurityArtifact = {
      fetchedAt,
      sourceTitle: SOURCE_TITLE,
      sourceUrl: SOURCE_URL,
      indicators: Object.values(FAO_INDICATORS).map((indicator) => ({
        key: indicator.key as FaoIndicatorKey,
        label: indicator.label,
        unit: indicator.unit,
      })),
      countryCount,
      newestPeriodEndYear,
      perCountry,
    };

    const artifactPath = path.join(DATA_DIR, 'fao_food_security.json');
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

    // Sidecar for the artifact register: the per-country values are code-split
    // and load only when a reader opens the panel, so dating the artifact must
    // not drag the whole payload into the eager bundle.
    const metaPath = path.join(DATA_DIR, 'fao_food_security_meta.json');
    fs.writeFileSync(metaPath, JSON.stringify(summarizeFaoArtifact(artifact), null, 2));

    console.log(`Saved FAOSTAT food security artifact to ${artifactPath}`);
    console.log(`Saved register sidecar to ${metaPath}`);
    console.log(
      `Rows kept: ${rows.length.toLocaleString()}; countries: ${countryCount}; ` +
        `newest period ends ${newestPeriodEndYear}.`,
    );
  } catch (error) {
    console.error('FAOSTAT refresh failed:', error);
    process.exit(1);
  }
};

await main();
