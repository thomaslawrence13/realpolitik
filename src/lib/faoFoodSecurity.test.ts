import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateFaoFoodSecurity,
  parseFaoFoodSecurityCsv,
  periodEndYear,
} from './faoFoodSecurity.js';
import { buildNameToIso } from './unVotes.js';

const HEADER =
  'Area Code,Area Code (M49),Area,Item Code,Item,Element Code,Element,Year Code,Year,Unit,Value,Flag,Note';

const row = (area: string, item: string, year: string, value: string, flag = 'E') =>
  `"2","'004","${area}","${item}","Indicator","6121","Value","x","${year}","%","${value}","${flag}",`;

const CSV = [
  HEADER,
  row('Afghanistan', '210041', '2000-2002', '47.8'),
  row('Afghanistan', '210041', '2023-2025', '30.2'),
  // Deliberately out of order: the newest value must win on period, not on
  // file position, because FAO republishes the whole back-series each release.
  row('Afghanistan', '210041', '2010-2012', '25.0'),
  row('Afghanistan', '21047', '2024', '75', 'X'),
  row('Germany', '210401', '2023-2025', '1.1', 'A'),
  // An indicator outside the selected set must be filtered out entirely.
  row('Germany', '21056', '2024', '2100'),
  // A non-numeric value is skipped rather than written as NaN.
  row('Germany', '210091', '2023-2025', ''),
].join('\n');

const nameToIso = buildNameToIso({ afghanistan: 'AF', germany: 'DE' }, {});

test('periodEndYear reads the final year of a FAO period label', () => {
  assert.equal(periodEndYear('2023-2025'), 2025);
  assert.equal(periodEndYear('2024'), 2024);
  assert.equal(periodEndYear(''), null);
  assert.equal(periodEndYear('not a year'), null);
});

test('only the selected indicators are parsed', () => {
  const rows = parseFaoFoodSecurityCsv(CSV);
  // 21056 (dietary energy requirement) is outside the set; the empty value is
  // dropped at parse time.
  assert.deepEqual(
    rows.map((parsed) => parsed.itemCode).sort(),
    ['210041', '210041', '210041', '210401', '21047'],
  );
});

test('the newest reference period wins regardless of row order', () => {
  const { perCountry, newestPeriodEndYear } = aggregateFaoFoodSecurity(
    parseFaoFoodSecurityCsv(CSV),
    nameToIso,
  );

  const undernourishment = perCountry['AF']?.undernourishmentPct;
  assert.equal(undernourishment?.value, 30.2);
  assert.equal(undernourishment?.period, '2023-2025');
  assert.equal(newestPeriodEndYear, 2025);
});

test('the published period label is preserved, never collapsed to a year', () => {
  const { perCountry } = aggregateFaoFoodSecurity(parseFaoFoodSecurityCsv(CSV), nameToIso);

  // A three-year average must not be presented as a 2025 reading.
  assert.equal(perCountry['AF']?.undernourishmentPct?.period, '2023-2025');
  // A genuine single-year series keeps its single year.
  assert.equal(perCountry['AF']?.basicDrinkingWaterPct?.period, '2024');
});

test('FAO estimate status is carried through, not discarded', () => {
  const { perCountry } = aggregateFaoFoodSecurity(parseFaoFoodSecurityCsv(CSV), nameToIso);

  assert.equal(perCountry['DE']?.severeFoodInsecurityPct?.status, 'official');
  assert.equal(perCountry['AF']?.undernourishmentPct?.status, 'estimated');
  // An international estimate is a model output and must stay labelled as one.
  assert.equal(perCountry['AF']?.basicDrinkingWaterPct?.status, 'international estimate');
});

test('unmapped areas are skipped rather than guessed at', () => {
  const withAggregate = [HEADER, row('Eastern Africa', '210041', '2023-2025', '28.0')].join('\n');
  const { perCountry } = aggregateFaoFoodSecurity(parseFaoFoodSecurityCsv(withAggregate), nameToIso);

  // FAO ships regional aggregates in the same file; they must not become a
  // country row.
  assert.deepEqual(perCountry, {});
});
