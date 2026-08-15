import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorldBankIndicatorUrl,
  currentFloorYear,
  parseWorldBankResponse,
  pickNewestValues,
  WB_INDICATORS,
} from './worldBankFetch';
import type { WbDataPoint } from './worldBankFetch';

const point = (iso: string, year: string, value: number | null): WbDataPoint => ({
  country: { id: iso, value: iso },
  date: year,
  value,
});

test('pickNewestValues keeps the newest non-null year per country', () => {
  const { values, newestObservation, observedYears } = pickNewestValues(
    [point('US', '2021', 1), point('US', '2024', 4), point('US', '2023', null)],
    '2020',
  );
  assert.equal(values.US, 4);
  assert.equal(newestObservation, '2024');
  assert.deepEqual(observedYears, { US: '2024' });
});

test('pickNewestValues drops rows older than the recency floor', () => {
  const { values } = pickNewestValues([point('DE', '2018', 9), point('DE', '2025', 2)], '2020');
  assert.deepEqual(values, { DE: 2 });
});

test('pickNewestValues skips null values and unknown iso shapes', () => {
  const { values, newestObservation } = pickNewestValues(
    [point('FR', '2024', null), { country: { id: 'xx', value: '' }, date: '2024', value: 5 }],
    '2020',
  );
  assert.deepEqual(values, { XX: 5 });
  assert.equal(newestObservation, '2024');
});

test('pickNewestValues normalizes the World Bank Taiwan/WGI country alias', () => {
  const { values, observedYears } = pickNewestValues(
    [{ country: { id: '', value: 'Taiwan, China' }, date: '2024', value: 0.4 }],
    '2020',
  );
  assert.deepEqual(values, { TW: 0.4 });
  assert.deepEqual(observedYears, { TW: '2024' });
});

test('pickNewestValues returns empty for no input', () => {
  const { values, newestObservation } = pickNewestValues([], '2020');
  assert.deepEqual(values, {});
  assert.equal(newestObservation, null);
});

test('indicator catalog is unique by key and code', () => {
  const keys = new Set(WB_INDICATORS.map((def) => def.key));
  const codes = new Set(WB_INDICATORS.map((def) => def.code));
  assert.equal(keys.size, WB_INDICATORS.length);
  assert.equal(codes.size, WB_INDICATORS.length);
});

test('indicator catalog distinguishes WGI provenance from WDI provenance', () => {
  const politicalStability = WB_INDICATORS.find((def) => def.key === 'politicalStability');
  const ruleOfLaw = WB_INDICATORS.find((def) => def.key === 'ruleOfLaw');
  const gdpGrowth = WB_INDICATORS.find((def) => def.key === 'gdpGrowth');

  assert.equal(politicalStability?.provenanceSourceId, 'world-bank-wgi');
  assert.equal(ruleOfLaw?.provenanceSourceId, 'world-bank-wgi');
  assert.equal(gdpGrowth?.provenanceSourceId, 'world-bank-wdi');
});

test('World Bank URL construction keeps API catalogue ids separate from provenance ids', () => {
  const wgi = WB_INDICATORS.find((def) => def.key === 'politicalStability');
  const wdi = WB_INDICATORS.find((def) => def.key === 'gdpGrowth');
  assert.ok(wgi);
  assert.ok(wdi);

  const wgiUrl = new URL(buildWorldBankIndicatorUrl(wgi, 'US;TW'));
  assert.ok(wgiUrl.pathname.endsWith('/country/US;TW/indicator/GOV_WGI_PV.EST'));
  assert.equal(wgiUrl.searchParams.get('source'), '3');
  assert.equal(wgi.provenanceSourceId, 'world-bank-wgi');

  const wdiUrl = new URL(buildWorldBankIndicatorUrl(wdi, 'US'));
  assert.ok(wdiUrl.pathname.endsWith('/country/US/indicator/NY.GDP.MKTP.KD.ZG'));
  assert.equal(wdiUrl.searchParams.has('source'), false);
  assert.equal(wdi.provenanceSourceId, 'world-bank-wdi');
});

test('World Bank URL construction rejects malformed country path input', () => {
  const indicator = WB_INDICATORS[0]!;
  assert.throws(
    () => buildWorldBankIndicatorUrl(indicator, 'US/../../admin'),
    /invalid country codes/,
  );
});

test('World Bank response parsing drops malformed and non-finite rows', () => {
  const rows = parseWorldBankResponse([
    {},
    [
      point('US', '2024', 2.5),
      point('DE', '2024', Number.POSITIVE_INFINITY),
      { country: null, date: '2024', value: 1 },
    ],
  ]);
  assert.deepEqual(rows, [point('US', '2024', 2.5)]);
  assert.throws(() => parseWorldBankResponse({}), /invalid envelope/);
});

test('currentFloorYear tracks the recency window', () => {
  const year = Number.parseInt(currentFloorYear(), 10);
  const thisYear = new Date().getUTCFullYear();
  assert.equal(year, thisYear - 6);
});
