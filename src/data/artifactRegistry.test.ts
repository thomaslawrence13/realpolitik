import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARTIFACT_IDS,
  ARTIFACT_REGISTER,
  artifactAgeDays,
  artifactPayloads,
  artifactStatusFor,
  buildArtifactRegisterTelemetry,
  describeArtifact,
  describeArtifacts,
  type ArtifactId,
} from './artifactRegistry';
import { SOURCE_REGISTRY } from './sourceRegistry';

const DAY_MS = 86_400_000;

/** `now` positioned a given number of days after the artifact was fetched. */
const clockAt = (id: ArtifactId, ageDays: number): number =>
  Date.parse(artifactPayloads[id].fetchedAt) + ageDays * DAY_MS;

test('every artifact descriptor carries a usable refresh budget', () => {
  for (const id of ARTIFACT_IDS) {
    const descriptor = ARTIFACT_REGISTER[id];
    assert.ok(descriptor.budgetDays > 0, `${id} budget must be positive`);
    assert.ok(
      descriptor.warnAfterDays < descriptor.budgetDays,
      `${id} warn tip must precede its budget`,
    );
    assert.match(descriptor.refreshCommand, /^npm run /, `${id} needs a runnable refresh command`);
    assert.ok(descriptor.boundary.length > 0, `${id} must state what it does not evidence`);
    assert.ok(descriptor.path.startsWith('src/data/datasets/'), `${id} path must point at a committed artifact`);
  }
});

test('artifacts credit only registered sources, or nothing at all', () => {
  for (const id of ARTIFACT_IDS) {
    const { sourceId } = ARTIFACT_REGISTER[id];
    if (sourceId === null) continue;
    assert.ok(SOURCE_REGISTRY[sourceId], `${id} credits unregistered source "${sourceId}"`);
  }
});

test('status thresholds move fresh → ageing → stale at the declared budgets', () => {
  const id: ArtifactId = 'ofac-sdn';
  const { warnAfterDays, budgetDays } = ARTIFACT_REGISTER[id];

  assert.equal(describeArtifact(id, clockAt(id, 0)).status, 'fresh');
  assert.equal(describeArtifact(id, clockAt(id, warnAfterDays)).status, 'fresh');
  assert.equal(describeArtifact(id, clockAt(id, warnAfterDays + 1)).status, 'aging');
  assert.equal(describeArtifact(id, clockAt(id, budgetDays)).status, 'aging');
  assert.equal(describeArtifact(id, clockAt(id, budgetDays + 1)).status, 'stale');
});

test('an artifact inside its budget is applied; one past budget is withheld', () => {
  const id: ArtifactId = 'ucdp-organized-violence';
  const { budgetDays } = ARTIFACT_REGISTER[id];
  assert.equal(describeArtifact(id, clockAt(id, budgetDays)).withinBudget, true);
  assert.equal(describeArtifact(id, clockAt(id, budgetDays + 1)).withinBudget, false);
});

test('an undateable artifact is treated as stale rather than trusted', () => {
  assert.ok(Number.isNaN(artifactAgeDays('not-a-timestamp')));
  assert.equal(artifactStatusFor(ARTIFACT_REGISTER['unga-votes'], Number.NaN), 'stale');
});

test('a clock behind the fetch stamp does not produce a negative age', () => {
  assert.equal(describeArtifact('unga-votes', clockAt('unga-votes', -30)).ageDays, 0);
});

test('register coverage counts match the committed payloads', () => {
  const rows = new Map(describeArtifacts().map((row) => [row.id, row]));
  assert.equal(
    rows.get('unga-votes')?.countryCount,
    Object.keys(artifactPayloads['unga-votes'].perCountry).length,
  );
  assert.equal(
    rows.get('ofac-sdn')?.countryCount,
    Object.keys(artifactPayloads['ofac-sdn'].perCountry).length,
  );
  assert.equal(
    rows.get('ucdp-organized-violence')?.countryCount,
    Object.keys(artifactPayloads['ucdp-organized-violence'].perCountry).length,
  );
  assert.equal(
    rows.get('ucdp-organized-violence')?.vintage,
    `v${artifactPayloads['ucdp-organized-violence'].version}`,
  );
});

test('the register lists the most urgent artifact first', () => {
  // Age OFAC past its budget while the others stay inside theirs.
  const now = clockAt('ofac-sdn', ARTIFACT_REGISTER['ofac-sdn'].budgetDays + 1);
  const rows = describeArtifacts(now);
  assert.equal(rows[0]?.id, 'ofac-sdn');
  assert.equal(rows[0]?.status, 'stale');
});

test('telemetry counts every artifact exactly once', () => {
  const telemetry = buildArtifactRegisterTelemetry();
  assert.equal(telemetry.artifacts.length, ARTIFACT_IDS.length);
  assert.equal(
    telemetry.freshCount + telemetry.agingCount + telemetry.staleCount,
    ARTIFACT_IDS.length,
  );
  assert.equal(telemetry.allWithinBudget, telemetry.staleCount === 0);
});

test('committed artifacts are within budget as of the commit', () => {
  // Guards the checked-in state: a merge that lands stale artifacts fails here
  // as well as in the freshness gate.
  const telemetry = buildArtifactRegisterTelemetry();
  assert.deepEqual(
    telemetry.artifacts.filter((artifact) => !artifact.withinBudget).map((artifact) => artifact.id),
    [],
  );
});
