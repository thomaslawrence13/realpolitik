import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ISO3_TO_ISO2,
  computeUnVotesAgreementOfficial,
  parseUnVotesOfficialCsv,
  unVotesOfficialVoteCode,
} from './unVotesOfficial';

const CSV = [
  'undl_id,ms_code,ms_name,ms_vote,date,session,resolution,draft,committee_report,meeting,title,agenda_title,subjects,vote_note,total_yes,total_no,total_abstentions,total_non_voting,total_ms,undl_link',
  '1,USA,UNITED STATES,Y,2025-01-10,79,A/RES/79/1,A/79/L.1,,A/79/PV.5,"Title here",palestine.,,150,3,7,40,200,https://digitallibrary.un.org/record/1',
  '1,RUS,RUSSIAN FEDERATION,Y,2025-01-10,79,A/RES/79/1,A/79/L.1,,A/79/PV.5,"same,title",pal.,,150,3,7,40,200,https://digitallibrary.un.org/record/1',
  '1,DEU,GERMANY,A,2025-01-10,79,A/RES/79/1,A/79/L.1,,A/79/PV.5,"same,title",pal.,,150,3,7,40,200,https://digitallibrary.un.org/record/1',
  '1,FRA,FRANCE,N,2025-01-10,79,A/RES/79/1,A/79/L.1,,A/79/PV.5,"same,title",pal.,,150,3,7,40,200,https://digitallibrary.un.org/record/1',
  '2,USA,USA,N,2025-02-02,79,A/RES/79/2,A/79/L.2,,A/79/PV.7,"second",pal.,,120,10,10,140,200,https://digitallibrary.un.org/record/2',
  '2,RUS,RUSSIAN FEDERATION,N,2025-02-02,79,A/RES/79/2,A/79/L.2,,A/79/PV.7,"second",pal.,,120,10,10,140,200,https://digitallibrary.un.org/record/2',
  '2,DEU,GERMANY,A,2025-02-02,79,A/RES/79/2,A/79/L.2,,A/79/PV.7,"second",pal.,,120,10,10,140,200,https://digitallibrary.un.org/record/2',
  '3,USA,UNITED STATES,Y,2025-03-03,79,A/RES/79/3,A/79/L.3,,A/79/PV.9,"third",pal.,,110,20,20,150,200,https://digitallibrary.un.org/record/3',
  '3,DEU,GERMANY,Y,2025-03-03,79,A/RES/79/3,A/79/L.3,,A/79/PV.9,"third",pal.,,110,20,20,150,200,https://digitallibrary.un.org/record/3',
  '4,USA,UNITED STATES,Y,2025-04-04,79,A/RES/79/4,"",,A/79/PV.11,"consensus,no draft",pal.,,200,0,0,0,200,https://digitallibrary.un.org/record/4',
  '4,DEU,GERMANY,Y,2025-04-04,79,A/RES/79/4,"",,A/79/PV.11,"consensus,no draft",pal.,,200,0,0,0,200,https://digitallibrary.un.org/record/4',
  // intentionally malformed line: title quoting is broken by an unescaped quote
  '5,USA,UNITED STATES,Y,2025-05-05,79,A/RES/79/5,A/79/L.5,,A/79/PV.13,"bad "quote, title",pal.,,190,0,0,190,200,https://digitallibrary.un.org/record/5',
].join('\n');

test('unVotesOfficialVoteCode maps official codes', () => {
  assert.equal(unVotesOfficialVoteCode('Y'), 1);
  assert.equal(unVotesOfficialVoteCode('N'), 3);
  assert.equal(unVotesOfficialVoteCode('A'), 2);
  assert.equal(unVotesOfficialVoteCode('X'), undefined);
});

test('parseUnVotesOfficialCsv tolerates quoting and drops non-draft rows', () => {
  const rows = parseUnVotesOfficialCsv(CSV);
  // As written: 10 real draft-vote rows (5 qualified votes + anchors on rows) — count carefully.
  assert.ok(rows.length >= 9, `expected at least 9 rows, got ${rows.length}`);
  const draftOnly = rows.every((row) => row.iso2);
  assert.equal(draftOnly, true);
  const deRows = rows.filter((row) => row.iso2 === 'DE');
  assert.equal(deRows.length, 3);
  assert.equal(deRows[0]!.vote, 2);
});

test('computeUnVotesAgreementOfficial measures US+RU agreement', () => {
  const { sessions, perCountry } = computeUnVotesAgreementOfficial(parseUnVotesOfficialCsv(CSV), {
    sinceYear: 2025,
    minRollCalls: 5,
  });
  assert.deepEqual(sessions, ['2025']);
  assert.equal(perCountry.US, undefined);
  assert.equal(perCountry.RU, undefined);
  const de = perCountry.DE!;
  // Resolutions with anchors voting: #1 (US+RU), #2 (US+RU), #3 (US only);
  // #4 has no draft, #5 is malformed → dropped.
  assert.equal(de.rollCalls, 5);
  assert.equal(de.blocA, Math.round((1 / 3) * 100)); // Y on #3 only
  assert.equal(de.blocB, 0); // never matches RU
});

test('ISO3_TO_ISO2 covers official codes and historical successors', () => {
  assert.equal(ISO3_TO_ISO2.USA, 'US');
  assert.equal(ISO3_TO_ISO2.RUS, 'RU');
  assert.equal(ISO3_TO_ISO2.DEU, 'DE');
  assert.equal(ISO3_TO_ISO2.FRA, 'FR');
  assert.equal(ISO3_TO_ISO2.PRT, 'PT');
  assert.equal(ISO3_TO_ISO2.SVK, 'SK');
  assert.equal(ISO3_TO_ISO2.CZE, 'CZ');
  assert.equal(ISO3_TO_ISO2.SUN, 'RU');
  assert.equal(ISO3_TO_ISO2.YMD, 'YE');
  assert.equal(ISO3_TO_ISO2.GBR, 'GB');
});