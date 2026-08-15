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

/**
 * OFAC renames programmes, and an unrecognised code is dropped rather than
 * flagged — so a country under heavy sanctions reads as having none. Syria's
 * listings moved to PAARSSR-EO13894 and went missing entirely under the bare
 * "SYRIA" prefix; these codes are pinned so the next rename fails a test
 * instead of quietly emptying a country.
 */
test('renamed country programmes still map to their country', () => {
  const renamed = [
    '10,"DAMASCUS TRADING",-0- ,"PAARSSR-EO13894",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ',
    '11,"BAGHDAD FUND",-0- ,"IRAQ2",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ',
    '12,"YANGON GROUP",-0- ,"BURMA-EO14014",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ',
    '13,"KINSHASA MINING",-0- ,"DRCONGO",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ',
    '14,"GUARD CORPS UNIT",-0- ,"IRGC",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ',
    '15,"MOSCOW BANK",-0- ,"CAATSA - RUSSIA",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ',
  ].join('\n');

  const perCountry = aggregateOfacByCountry(parseSdnCsv(renamed));
  assert.equal(perCountry.SY?.entryCount, 1);
  assert.equal(perCountry.IQ?.entryCount, 1);
  assert.equal(perCountry.MM?.entryCount, 1);
  assert.equal(perCountry.CD?.entryCount, 1);
  assert.equal(perCountry.IR?.entryCount, 1);
  assert.equal(perCountry.RU?.entryCount, 1);
});

test('thematic programmes are never attributed to a country', () => {
  // These designate conduct wherever it occurs. Mapping them would turn a US
  // counter-terrorism or narcotics listing into a claim about a country.
  const thematic = ['SDGT', 'SDNTK', 'NPWMD', 'GLOMAG', 'TCO', 'FTO', 'CYBER2', 'BALKANS']
    .map((program, index) => `${20 + index},"ENTITY ${index}",-0- ,"${program}",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- `)
    .join('\n');

  assert.deepEqual(aggregateOfacByCountry(parseSdnCsv(thematic)), {});
});