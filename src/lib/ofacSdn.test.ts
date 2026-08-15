import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateOfacByCountry, parseSdnCsv } from './ofacSdn';

const CSV = [
  '1,"AEROCARIBBEAN AIRLINES",-0- ,"CUBA",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ',
  '2,"INTERTANKO BUNDLE",-0- ,"RUSSIA-EO14024",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"a.k.a. proxy"',
  '3,"KYIV BROKER",-0- ,"UKRAINE-EO13662] [RUSSIA-EO14024",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ',
  '4,"GLOBAL HOLDING",-0- ,"SDGT",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"no country program"',
].join('\n');

test('parseSdnCsv splits program codes and keeps remarks', () => {
  const rows = parseSdnCsv(CSV);
  assert.equal(rows.length, 4);
  const multi = rows[2]!;
  assert.deepEqual(multi.programs, ['UKRAINE-EO13662', 'RUSSIA-EO14024']);
  assert.equal(rows[1]!.remarks, 'a.k.a. proxy');
});

test('aggregateOfacByCountry attributes entries via program countries', () => {
  const perCountry = aggregateOfacByCountry(parseSdnCsv(CSV));
  const ru = perCountry.RU!;
  assert.equal(ru.entryCount, 2); // rows 2 and 3
  assert.deepEqual(ru.topPrograms[0], { program: 'RUSSIA-EO14024', count: 2 });
  const ua = perCountry.UA!;
  assert.equal(ua.entryCount, 1);
  // The "CUBA" row actually parses as program "CUBA" above.
  assert.ok(perCountry.CU);
  // Row 4 has no country-tagged program.
  assert.equal(perCountry.SD, undefined);
});