import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countryProfiles } from '../src/data/countryData.js';
import { simulateCountry, simulationWeightSets, defaultScenarioInputs } from '../src/simulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data/datasets');

async function main() {
  console.log('Starting historical backtest sequence...');
  
  // Scaffold historical baseline for a larger cross-section
  const historicalBaseline = {
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
      'south-africa': { alignment: 'nonAligned', risk: 45 }
    }
  };

  const outputPath = path.join(DATA_DIR, 'historical_2015_outcomes.json');
  fs.writeFileSync(outputPath, JSON.stringify(historicalBaseline, null, 2));

  console.log(`Saved historical ground-truth to ${outputPath}`);
  
  console.log('\n--- Running Calibration ---');
  console.log('Validating simulation engine outputs against 2015 ground-truth...');
  
  const profiles = countryProfiles;
  const profilesById = new Map(profiles.map(p => [p.id, p]));

  let bestWeightSet = null;
  let highestAccuracy = 0;
  let lowestMae = Infinity;

  const totalCases = Object.keys(historicalBaseline.actualOutcomes).length;

  for (const [key, weightSet] of Object.entries(simulationWeightSets)) {
    console.log(`\nEvaluating Weight Set: ${weightSet.label}`);
    
    let totalError = 0;
    let correctAlignments = 0;
  
    for (const [countryId, expected] of Object.entries(historicalBaseline.actualOutcomes)) {
      const profile = profilesById.get(countryId);
      if (!profile) {
        console.warn(`  [Warning] Missing profile for ${countryId}. Skipping.`);
        continue;
      }
      
      const simulated = simulateCountry(profile, 0, {
        includeHistory: false,
        scenarioInputs: defaultScenarioInputs,
        weightSet
      });
      
      if (simulated.alignment === expected.alignment) correctAlignments++;
  
      const riskDiff = Math.abs(simulated.risk - expected.risk);
      totalError += riskDiff;
  
      console.log(`  [${countryId}] Expected: ${expected.alignment.padEnd(12)} (Risk: ${expected.risk})`);
      console.log(`           Simulated: ${simulated.alignment.padEnd(12)} (Risk: ${simulated.risk.toFixed(1)}) | Error: ${riskDiff.toFixed(2)}`);
    }
  
    const mae = totalError / totalCases;
    const accuracy = (correctAlignments / totalCases) * 100;
    
    console.log(`  -> Alignment Accuracy: ${accuracy.toFixed(1)}% | Mean Risk Error: ${mae.toFixed(2)}`);

    if (accuracy > highestAccuracy || (accuracy === highestAccuracy && mae < lowestMae)) {
      bestWeightSet = key;
      highestAccuracy = accuracy;
      lowestMae = mae;
    }
  }

  console.log(`\n================================`);
  console.log(`🏆 Optimal Calibration Found`);
  console.log(`================================`);
  console.log(`Optimal Weight Set:  ${bestWeightSet}`);
  console.log(`Alignment Accuracy:  ${highestAccuracy.toFixed(1)}%`);
  console.log(`Risk Mean Abs Error: ${lowestMae.toFixed(2)}\n`);

  if (highestAccuracy >= 80 && lowestMae < 15) {
    console.log('✅ Calibration PASSED. Sim engine weights fall within acceptable tolerance parameters.');
  } else {
    console.log('❌ Calibration FAILED. Global adjustments required in src/simulation.ts to reach minimum viability.');
    process.exit(1);
  }
}

main().catch(console.error);