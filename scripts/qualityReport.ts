import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countryProfiles,
  informationQualityContract,
  informationQualityTelemetry as staticTelemetry,
  ingestTelemetry,
} from '../src/data/countryData.js';
import { buildInformationQualityTelemetry } from '../src/data/quality/telemetry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATASETS_DIR = path.resolve(__dirname, '../src/data/datasets');
const OUTPUT_PATH = path.join(DATASETS_DIR, 'quality_report.json');

const runtimeTelemetry = buildInformationQualityTelemetry(countryProfiles, {
  layer: 'runtime-live',
  staticReferenceAverageScore: staticTelemetry.averageInformationScore,
});

const regressionBudgetBreaches: string[] = [];

if (!runtimeTelemetry.kpiStatus.averageInformationScoreWithinTarget) {
  regressionBudgetBreaches.push(
    `averageInformationScore ${runtimeTelemetry.averageInformationScore} is below target ${runtimeTelemetry.kpiTargets.minimumAverageInformationScore}`,
  );
}
if (!runtimeTelemetry.kpiStatus.lowQualityCountWithinTarget) {
  regressionBudgetBreaches.push(
    `lowQualityCount ${runtimeTelemetry.lowQualityCount} exceeds target ${runtimeTelemetry.kpiTargets.maximumLowQualityCountries}`,
  );
}
if (!runtimeTelemetry.kpiStatus.staleCountryCountWithinTarget) {
  regressionBudgetBreaches.push(
    `staleCountryCount ${runtimeTelemetry.staleCountryCount} exceeds target ${runtimeTelemetry.kpiTargets.maximumStaleCountries}`,
  );
}
if (!runtimeTelemetry.kpiStatus.staticRuntimeScoreDeltaWithinTarget) {
  regressionBudgetBreaches.push(
    `static/runtime score delta ${runtimeTelemetry.kpiStatus.staticRuntimeScoreDelta} exceeds target ${runtimeTelemetry.kpiTargets.maximumStaticRuntimeScoreDelta}`,
  );
}

const qualityReport = {
  generatedAt: new Date().toISOString(),
  contract: informationQualityContract,
  trendableAggregates: {
    averageInformationScore: runtimeTelemetry.averageInformationScore,
    lowQualityCount: runtimeTelemetry.lowQualityCount,
    staleCountryCount: runtimeTelemetry.staleCountryCount,
    highQualityCount: runtimeTelemetry.highQualityCount,
    ingestAverageCoveragePct: ingestTelemetry.averageCoveragePct,
    ingestMissingCountriesByWeakestIndicator: ingestTelemetry.weakestIndicators.map((indicator) => ({
      snapshotKey: indicator.snapshotKey,
      missingCountryCount: indicator.missingCountryCount,
      newestObservation: indicator.newestObservation,
    })),
  },
  baseline: {
    staticAverageInformationScore: staticTelemetry.averageInformationScore,
    runtimeAverageInformationScore: runtimeTelemetry.averageInformationScore,
    staticRuntimeScoreDelta: runtimeTelemetry.kpiStatus.staticRuntimeScoreDelta,
  },
  weakestCountries: runtimeTelemetry.weakestInformationCountries.slice(0, 10).map((country) => ({
    countryId: country.countryId,
    displayName: country.displayName,
    informationScore: country.informationScore,
    staleIndicatorCount: country.staleIndicatorCount,
    fallbackIndicatorCount: country.fallbackIndicatorCount,
    lowConfidenceIndicatorCount: country.lowConfidenceIndicatorCount,
    remediationDrivers: country.remediationDrivers,
  })),
  kpiStatus: runtimeTelemetry.kpiStatus,
  regressionBudgetBreaches,
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(qualityReport, null, 2)}\n`);
console.log(`Wrote quality report to ${OUTPUT_PATH}`);

if (regressionBudgetBreaches.length > 0) {
  console.error('Quality regression budget exceeded:');
  regressionBudgetBreaches.forEach((breach) => console.error(`- ${breach}`));
  process.exit(1);
}

