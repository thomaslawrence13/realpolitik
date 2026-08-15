/**
 * Print the operational artifact register: what has actually been retrieved,
 * when, how old that is against its refresh budget, and what each artifact
 * does not evidence.
 *
 * `freshness:check` enforces the same budgets as part of the release gate;
 * this command is the read-only view an operator can run at any time (or pipe
 * into a refresh PR) without loading the whole dataset.
 *
 * Exits non-zero when any artifact is past budget, so it can be used as a
 * standalone check in a workflow step.
 */

import { ARTIFACT_STATUS_LABEL, buildArtifactRegisterTelemetry } from '../src/data/artifactRegistry.js';

const register = buildArtifactRegisterTelemetry();

console.log(`Operational artifact register · assessed ${register.assessedAt.slice(0, 16).replace('T', ' ')} UTC`);
console.log(
  `${register.artifacts.length} artifacts · fresh ${register.freshCount} · ageing ${register.agingCount} · stale ${register.staleCount}`,
);
console.log('');

for (const artifact of register.artifacts) {
  console.log(`${ARTIFACT_STATUS_LABEL[artifact.status].toUpperCase()} — ${artifact.title}`);
  console.log(`  publisher    ${artifact.publisher}`);
  console.log(`  path         ${artifact.path}`);
  console.log(
    `  retrieved    ${artifact.retrievedOn} (${artifact.ageDays}d old · budget ${artifact.budgetDays}d · warn ${artifact.warnAfterDays}d)`,
  );
  console.log(`  coverage     ${artifact.coverage}${artifact.vintage ? ` · ${artifact.vintage}` : ''}`);
  console.log(`  credits      ${artifact.sourceId ?? 'registry evidence only (no source descriptor)'}`);
  console.log(`  boundary     ${artifact.boundary}`);
  console.log(`  refresh      ${artifact.refreshCommand}`);
  console.log('');
}

if (!register.allWithinBudget) {
  console.error('Artifact register: one or more artifacts are past their refresh budget.');
  process.exit(1);
}

console.log('All artifacts are within their refresh budgets.');
