import { countryProfiles } from '../src/data/countryData.js';
import { simulateCountry, simulationWeightSets, defaultScenarioInputs } from '../src/simulation.js';
import { historicalBaselineFixture, writeHistoricalFixture } from './backtestFixture.js';

async function main() {
  console.log('Starting historical backtest sequence...');
  const outputPath = writeHistoricalFixture();
  const historicalBaseline = historicalBaselineFixture;

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
        weightSet,
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
