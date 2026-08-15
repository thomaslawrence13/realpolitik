import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countryProfiles,
  enhancementReleaseTelemetry,
  informationQualityContract,
  informationQualityTelemetry as staticTelemetry,
  ingestTelemetry,
} from '../src/data/countryData.js';
import { buildInformationQualityTelemetry } from '../src/data/quality/telemetry.js';
import { buildArtifactRegisterTelemetry } from '../src/data/artifactRegistry.js';
import {
  appendQualitySnapshot,
  emptyQualityHistory,
  readQualityHistory,
  summarizeQualityTrend,
  type QualitySnapshot,
} from '../src/lib/qualityHistory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATASETS_DIR = path.resolve(__dirname, '../src/data/datasets');
const OUTPUT_PATH = path.join(DATASETS_DIR, 'quality_report.json');
const HISTORY_PATH = path.join(DATASETS_DIR, 'quality_history.json');

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
if (!enhancementReleaseTelemetry.releaseAccepted) {
  regressionBudgetBreaches.push(
    `${enhancementReleaseTelemetry.releaseTag} acceptance criteria not met for ${enhancementReleaseTelemetry.scope}`,
  );
}

const generatedAt = new Date().toISOString();
const artifactRegister = buildArtifactRegisterTelemetry();

/**
 * Extend the retained series before writing the report, so the trend block
 * below describes this run in context rather than in isolation. The history is
 * committed alongside the report: a trend that lives only in CI logs answers
 * the question for whoever was watching that day and nobody else.
 */
const previousHistory = fs.existsSync(HISTORY_PATH)
  ? readQualityHistory(JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')))
  : emptyQualityHistory();

const snapshot: QualitySnapshot = {
  generatedAt,
  day: generatedAt.slice(0, 10),
  averageInformationScore: runtimeTelemetry.averageInformationScore,
  lowQualityCount: runtimeTelemetry.lowQualityCount,
  staleCountryCount: runtimeTelemetry.staleCountryCount,
  highQualityCount: runtimeTelemetry.highQualityCount,
  ingestAverageCoveragePct: ingestTelemetry.averageCoveragePct,
  artifactsWithinBudget: artifactRegister.artifacts.filter((artifact) => artifact.withinBudget).length,
  artifactCount: artifactRegister.artifacts.length,
  releaseAccepted: enhancementReleaseTelemetry.releaseAccepted,
};

const history = appendQualitySnapshot(previousHistory, snapshot);
const trend = summarizeQualityTrend(history);

fs.writeFileSync(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`);

const qualityReport = {
  generatedAt,
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
  enhancementRelease: enhancementReleaseTelemetry,
  /** Movement against retained history; null fields mean no prior entry, not no change. */
  trend,
  artifactRegister: {
    artifactCount: artifactRegister.artifacts.length,
    freshCount: artifactRegister.freshCount,
    agingCount: artifactRegister.agingCount,
    staleCount: artifactRegister.staleCount,
    allWithinBudget: artifactRegister.allWithinBudget,
  },
  regressionBudgetBreaches,
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(qualityReport, null, 2)}\n`);
console.log(`Wrote quality report to ${OUTPUT_PATH}`);
console.log(`Quality history: ${history.entries.length} retained entr${history.entries.length === 1 ? 'y' : 'ies'} → ${HISTORY_PATH}`);

if (trend.sincePrevious) {
  const { averageInformationScore, staleCountryCount, ingestAverageCoveragePct } = trend.sincePrevious;
  const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);
  console.log(
    `Since ${trend.previousDay}: information score ${signed(averageInformationScore)}, ` +
      `stale countries ${signed(staleCountryCount)}, ingest coverage ${signed(ingestAverageCoveragePct)}.`,
  );
} else {
  console.log('No prior quality entry retained yet — this run starts the series.');
}

if (regressionBudgetBreaches.length > 0) {
  console.error('Quality regression budget exceeded:');
  regressionBudgetBreaches.forEach((breach) => console.error(`- ${breach}`));
  process.exit(1);
}
