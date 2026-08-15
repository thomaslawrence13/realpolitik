/**
 * Refresh the BIS financial vulnerability artifact.
 *
 * Four small SDMX queries, each asking only for the latest observation, so the
 * whole refresh is well under 100 KB on the wire. The dimension keys are
 * spelled out below because SDMX keys are positional and a silently wrong
 * position returns real numbers attributed to the wrong concept — the
 * credit-gap flow in particular publishes the ratio, the HP-filter trend and
 * the gap under the same key shape, distinguished only by the last dimension.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateBisSeries,
  BIS_SERIES,
  parseSdmxSeries,
  type BisArtifact,
  type BisSeriesKey,
  type SdmxJson,
  type SdmxPoint,
} from '../src/lib/bisFinancial.js';
import { countryIso2 } from '../src/lib/worldBankFetch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

const SOURCE_TITLE = 'BIS Statistics — credit, debt service and policy rates';
const SOURCE_URL = 'https://data.bis.org/';
const API_BASE = 'https://stats.bis.org/api/v2/data/dataflow/BIS';

interface BisQuery {
  key: BisSeriesKey;
  dataflow: string;
  /**
   * Positional SDMX key. An empty segment is a wildcard over that dimension,
   * which is how one request covers every reporting country.
   */
  seriesKey: string;
  /** Dimension carrying the country code — differs between BIS dataflows. */
  countryDimension: string;
  description: string;
}

const QUERIES: BisQuery[] = [
  {
    key: 'creditToGdpGap',
    dataflow: 'WS_CREDIT_GAP',
    // FREQ.BORROWERS_CTY.TC_BORROWERS.TC_LENDERS.CG_DTYPE
    // P = private non-financial sector, A = all lenders, C = gap (actual minus
    // trend). B is the HP-filter trend and A the raw ratio — using either in
    // place of C silently publishes a ~200% "gap".
    seriesKey: 'Q..P.A.C',
    countryDimension: 'BORROWERS_CTY',
    description: 'credit-to-GDP gap',
  },
  {
    key: 'creditToGdpRatio',
    dataflow: 'WS_CREDIT_GAP',
    seriesKey: 'Q..P.A.A',
    countryDimension: 'BORROWERS_CTY',
    description: 'credit-to-GDP ratio',
  },
  {
    key: 'debtServiceRatio',
    dataflow: 'WS_DSR',
    // FREQ.BORROWERS_CTY.DSR_BORROWERS — P = private non-financial sector.
    seriesKey: 'Q..P',
    countryDimension: 'BORROWERS_CTY',
    description: 'debt service ratio',
  },
  {
    key: 'policyRate',
    dataflow: 'WS_CBPOL',
    // FREQ.REF_AREA — monthly headline policy rate.
    seriesKey: 'M.',
    countryDimension: 'REF_AREA',
    description: 'central bank policy rate',
  },
];

const fetchSeries = async (query: BisQuery): Promise<SdmxPoint[]> => {
  const url = `${API_BASE}/${query.dataflow}/1.0/${query.seriesKey}?lastNObservations=1`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.sdmx.data+json',
      'User-Agent': 'realpolitik-data-refresh',
    },
  });
  if (!response.ok) throw new Error(`BIS ${query.dataflow} (${query.description}): HTTP ${response.status}`);
  const payload = (await response.json()) as SdmxJson;
  const points = parseSdmxSeries(payload);
  if (points.length === 0) {
    throw new Error(`BIS ${query.dataflow} returned no points for ${query.seriesKey} — key shape may have changed.`);
  }
  return points;
};

const main = async () => {
  console.log('Starting BIS financial indicators refresh...');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fetchedAt = new Date().toISOString();

    const entries: Array<{ key: BisSeriesKey; countryDimension: string; points: SdmxPoint[] }> = [];
    for (const query of QUERIES) {
      const points = await fetchSeries(query);
      console.log(`  ${query.description}: ${points.length} series.`);
      entries.push({ key: query.key, countryDimension: query.countryDimension, points });
    }

    const trackedIso2 = new Set(Object.values(countryIso2));
    const perCountry = aggregateBisSeries(entries, trackedIso2);
    const countryCount = Object.keys(perCountry).length;
    if (countryCount === 0) {
      throw new Error('no BIS series mapped to a tracked country — reference-area coding may have changed.');
    }

    const artifact: BisArtifact = {
      fetchedAt,
      sourceTitle: SOURCE_TITLE,
      sourceUrl: SOURCE_URL,
      series: BIS_SERIES,
      countryCount,
      perCountry,
    };

    const artifactPath = path.join(DATA_DIR, 'bis_financial.json');
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

    console.log(`Saved BIS financial artifact to ${artifactPath}`);
    console.log(`Tracked countries with BIS reporting: ${countryCount}.`);
  } catch (error) {
    console.error('BIS refresh failed:', error);
    process.exit(1);
  }
};

await main();
