import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeSanctionsAuthorities } from './sanctionsAuthorities.js';

test('a country listed by no authority yields no summary', () => {
  assert.equal(summarizeSanctionsAuthorities({}), null);
  // Zero listings is not the same as being listed with a count of zero.
  assert.equal(
    summarizeSanctionsAuthorities({ ofac: { entryCount: 0 }, eu: { listingCount: 0, newestDesignation: null } }),
    null,
  );
});

test('authorities are ordered by legal reach, not by listing count', () => {
  const summary = summarizeSanctionsAuthorities({
    unsc: { listingCount: 121, newestListedOn: '2012-12-20' },
    ofac: { entryCount: 2707 },
    eu: { listingCount: 539, newestDesignation: '2025-10-01' },
  });

  assert.ok(summary);
  // OFAC has 20x the UN count, but a binding multilateral regime still leads:
  // sorting by count would invert the legal weight the order conveys.
  assert.deepEqual(
    summary.entries.map((entry) => entry.authority),
    ['un-security-council', 'us-ofac', 'eu'],
  );
  assert.equal(summary.authorityCount, 3);
  assert.equal(summary.hasMultilateral, true);
});

test('each authority carries its own attribution basis', () => {
  const summary = summarizeSanctionsAuthorities({
    unsc: { listingCount: 10, newestListedOn: null },
    ofac: { entryCount: 20 },
    eu: { listingCount: 30, newestDesignation: null },
  });

  assert.ok(summary);
  assert.deepEqual(
    summary.entries.map((entry) => entry.basis),
    ['regime', 'programme', 'identity'],
  );
});

test('a unilaterally-listed country is not reported as multilateral', () => {
  const summary = summarizeSanctionsAuthorities({ ofac: { entryCount: 44 } });

  assert.ok(summary);
  assert.equal(summary.authorityCount, 1);
  assert.equal(summary.hasMultilateral, false);
  assert.equal(summary.entries[0]?.authority, 'us-ofac');
});

test('no combined total is produced across authorities', () => {
  const summary = summarizeSanctionsAuthorities({
    unsc: { listingCount: 121, newestListedOn: null },
    eu: { listingCount: 539, newestDesignation: null },
  });

  assert.ok(summary);
  // The summary must expose how many authorities acted, never a summed listing
  // count: the lists overlap and their denominators differ.
  assert.equal('listingTotal' in summary, false);
  assert.equal(summary.authorityCount, 2);
});
