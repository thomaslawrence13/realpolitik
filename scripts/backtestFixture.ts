import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');
const FIXTURE_PATH = path.join(DATA_DIR, 'historical_2015_outcomes.json');

export const historicalBaselineFixture = {
  version: '2015-historical',
  timestamp: '2015-01-01T00:00:00Z',
  actualOutcomes: {
    'united-states': { alignment: 'blocA', risk: 20 },
    'china': { alignment: 'blocB', risk: 35 },
    'russia': { alignment: 'blocB', risk: 65 },
    'ukraine': { alignment: 'unstable', risk: 85 },
    'united-kingdom': { alignment: 'blocA', risk: 15 },
    'france': { alignment: 'blocA', risk: 20 },
    'germany': { alignment: 'blocA', risk: 15 },
    'japan': { alignment: 'blocA', risk: 25 },
    'iran': { alignment: 'blocB', risk: 75 },
    'north-korea': { alignment: 'blocB', risk: 85 },
    'india': { alignment: 'nonAligned', risk: 40 },
    'brazil': { alignment: 'nonAligned', risk: 30 },
    'south-africa': { alignment: 'nonAligned', risk: 45 },
  },
} as const;

export const writeHistoricalFixture = () => {
  fs.writeFileSync(FIXTURE_PATH, `${JSON.stringify(historicalBaselineFixture, null, 2)}\n`);
  return FIXTURE_PATH;
};
