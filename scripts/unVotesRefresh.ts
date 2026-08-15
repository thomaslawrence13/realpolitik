import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOfficialArtifact, computeUnVotesAgreementOfficial, parseUnVotesOfficialCsv } from '../src/lib/unVotesOfficial.js';
import type { UnVotesArtifact } from '../src/lib/unVotes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

/** Official UN Digital Library GA voting CSV (updated ~annually). */
const UN_DIGITAL_LIBRARY_RECORD = 'https://digitallibrary.un.org/record/4060887';
const UN_VOTES_CSV_URL = `${UN_DIGITAL_LIBRARY_RECORD}/files/2026_02_06_ga_voting.csv`;

async function main() {
  console.log('Starting building official UN GA voting artifact...');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fetchedAt = new Date().toISOString();

    console.log(`Downloading official UNGA voting CSV (${UN_VOTES_CSV_URL})...`);
    const response = await fetch(UN_VOTES_CSV_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (realpolitik-data-refresh)' },
    });
    if (!response.ok) {
      throw new Error(`unable to download UN voting CSV: HTTP ${response.status}`);
    }
    const csvText = await response.text();
    console.log(`CSV size: ${(csvText.length / 1024 / 1024).toFixed(1)} MB.`);

    const rows = parseUnVotesOfficialCsv(csvText);
    if (rows.length === 0) throw new Error('parsed zero rows from the official CSV — schema drift?');
    console.log(`Parsed ${rows.length.toLocaleString()} recorded-vote rows.`);

    let latestYear = 0;
    for (const row of rows) if (row.session > latestYear) latestYear = row.session;
    const { sessions, perCountry } = computeUnVotesAgreementOfficial(rows, {
      sinceYear: Math.max(2016, latestYear - 10),
      minRollCalls: 12,
    });

    const artifactPath = path.join(DATA_DIR, 'un_ga_votes.json');
    const artifact: UnVotesArtifact = buildOfficialArtifact({ sessions, perCountry }, fetchedAt);
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

    console.log(`Saved official UN voting artifact to ${artifactPath}`);
    console.log(`Years covered: ${sessions.length}; countries: ${Object.keys(perCountry).length}.`);
  } catch (error) {
    console.error('UN votes refresh failed:', error);
    process.exit(1);
  }
}

await main();