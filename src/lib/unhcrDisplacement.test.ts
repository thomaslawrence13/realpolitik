import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateUnhcrDisplacement,
  displacementPer1000,
  parseUnhcrItems,
  toCount,
} from './unhcrDisplacement.js';

const ISO3_TO_ISO2 = { SYR: 'SY', DEU: 'DE', ATA: 'AQ' };
const TRACKED = new Set(['SY', 'DE']);

test('toCount handles the numeric and string forms UNHCR returns', () => {
  assert.equal(toCount(1234), 1234);
  assert.equal(toCount('0'), 0);
  assert.equal(toCount('4,865,764'), 4865764);
  // "-" marks an unreported cell; it contributes nothing to a sum.
  assert.equal(toCount('-'), 0);
  assert.equal(toCount(undefined), 0);
  assert.equal(toCount(Number.NaN), 0);
});

test('parseUnhcrItems reads the requested dimension and skips the echoed one', () => {
  const items = [
    {
      year: 2025,
      coo_iso: 'SYR',
      coa_iso: '-',
      refugees: 4865764,
      asylum_seekers: 154355,
      idps: 5542227,
      stateless: '0',
      ooc: 100,
    },
  ];

  const origin = parseUnhcrItems(items, 'coo');
  assert.equal(origin.length, 1);
  assert.equal(origin[0]?.iso3, 'SYR');
  assert.equal(origin[0]?.refugees, 4865764);

  // Reading the asylum key off an origin response must yield nothing rather
  // than silently attributing Syria's figures to a "-" country.
  assert.deepEqual(parseUnhcrItems(items, 'coa'), []);
});

test('origin and asylum figures stay on separate fields', () => {
  const origin = parseUnhcrItems(
    [{ coo_iso: 'SYR', refugees: 4865764, asylum_seekers: 154355, idps: 5542227, stateless: '0', ooc: '0' }],
    'coo',
  );
  const asylum = parseUnhcrItems(
    [{ coa_iso: 'DEU', refugees: 2655191, asylum_seekers: 297503, idps: '0', stateless: '0', ooc: '0' }],
    'coa',
  );

  const perCountry = aggregateUnhcrDisplacement(origin, asylum, ISO3_TO_ISO2, TRACKED);

  assert.equal(perCountry['SY']?.refugeesFromCountry, 4865764);
  assert.equal(perCountry['SY']?.refugeesHosted, 0);
  assert.equal(perCountry['SY']?.idps, 5542227);

  assert.equal(perCountry['DE']?.refugeesHosted, 2655191);
  assert.equal(perCountry['DE']?.refugeesFromCountry, 0);
});

test('IDPs are counted once, from the origin side only', () => {
  // UNHCR echoes internal displacement on both sides of the response; reading
  // both would double every IDP figure.
  const rows = [{ coo_iso: 'SYR', refugees: 0, asylum_seekers: 0, idps: 5542227, stateless: '0', ooc: '0' }];
  const asylumRows = [
    { coa_iso: 'SYR', refugees: 0, asylum_seekers: 0, idps: 5542227, stateless: '0', ooc: '0' },
  ];

  const perCountry = aggregateUnhcrDisplacement(
    parseUnhcrItems(rows, 'coo'),
    parseUnhcrItems(asylumRows, 'coa'),
    ISO3_TO_ISO2,
    TRACKED,
  );
  assert.equal(perCountry['SY']?.idps, 5542227);
});

test('untracked countries and all-zero rows produce no entry', () => {
  const origin = parseUnhcrItems(
    [
      { coo_iso: 'ATA', refugees: 500, asylum_seekers: 0, idps: '0', stateless: '0', ooc: '0' },
      { coo_iso: 'DEU', refugees: '0', asylum_seekers: '0', idps: '0', stateless: '0', ooc: '0' },
    ],
    'coo',
  );

  const perCountry = aggregateUnhcrDisplacement(origin, [], ISO3_TO_ISO2, TRACKED);

  // Antarctica is not tracked; Germany reported nothing. Writing a zero for
  // Germany would render "unreported" as a measured absence of displacement.
  assert.deepEqual(Object.keys(perCountry), []);
});

test('displacementPer1000 refuses to divide by a missing population', () => {
  assert.equal(displacementPer1000(1_000_000, 50_000_000), 20);
  assert.equal(displacementPer1000(500, 0), null);
  assert.equal(displacementPer1000(500, Number.NaN), null);
});
