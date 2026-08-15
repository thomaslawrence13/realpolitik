import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSeatToIso, computeUnVotesAgreement, parseUnVotesCsv, unVotesVoteCode } from './unVotes';
import { countryIso2 } from './worldBankFetch';

const CSV = [
  'decision_id,member_state,original_vote,session_id,decision_topic,decision_mode,current_seat_name,meeting_date',
  'A/RES/79/1-FP,United States of America,in favor,RS-079,draft resolution,recorded vote,United States of America,2025-01-10',
  'A/RES/79/1-FP,Venezuela,abstention,RS-079,draft resolution,recorded vote,Venezuela (Bolivarian Republic of),2025-01-10',
  'A/RES/79/1-FP,Russian Federation,against,RS-079,draft resolution,recorded vote,Russian Federation,2025-01-10',
  'A/RES/79/1-FP,Germany,in favor,RS-079,draft resolution,recorded vote,Germany,2025-01-10',
  'A/RES/79/1-FP,China,against,RS-079,draft resolution,recorded vote,China,2025-01-10',
  'A/RES/79/2-FP,United States of America,against,RS-079,draft resolution,recorded vote,United States of America,2025-02-02',
  'A/RES/79/2-FP,Russian Federation,against,RS-079,draft resolution,recorded vote,Russian Federation,2025-02-02',
  'A/RES/79/2-FP,Germany,abstention,RS-079,draft resolution,recorded vote,Germany,2025-02-02',
  'A/RES/79/2-FP,France,in favor,RS-079,draft resolution,recorded vote,France,2025-02-02',
  'A/RES/79/2-FP,Venezuela,against,RS-079,draft resolution,recorded vote,Venezuela (Bolivarian Republic of),2025-02-02',
].join('\n');

const memberToIso = new Map([
  ['United States of America', 'US'],
  ['Russia', 'RU'],
  ['Germany', 'DE'],
  ['China', 'CN'],
  ['France', 'FR'],
  ['Venezuela (Bolivarian Republic of)', 'VE'],
]);

test('unVotesVoteCode maps vote text', () => {
  assert.equal(unVotesVoteCode('in favor'), 1);
  assert.equal(unVotesVoteCode('abstention'), 2);
  assert.equal(unVotesVoteCode('against'), 3);
  assert.equal(unVotesVoteCode('not available'), undefined);
});

test('parseUnVotesCsv keeps only recorded votes on draft resolutions', () => {
  const rows = parseUnVotesCsv(CSV, memberToIso);
  assert.equal(rows.length, 10);
  assert.equal(rows[3]!.iso, 'DE');
  assert.equal(rows[3]!.session, 2025);
});

test('computeUnVotesAgreement measures agreement with both anchors', () => {
  const { sessions, perCountry } = computeUnVotesAgreement(parseUnVotesCsv(CSV, memberToIso), {
    sinceYear: 2025,
    minRollCalls: 1,
  });
  assert.deepEqual(sessions, ['2025']);
  assert.ok(perCountry.US === undefined); // anchors excluded
  const de = perCountry.DE!;
  // r1: DE in favor vs US in favor (agree) — r2: abstain vs against (no).
  assert.equal(de.blocA, 50);
  // Russia voted against on both; DE never voted no => 0%.
  assert.equal(de.blocB, 0);
  assert.equal(de.rollCalls, 4);
  const ve = perCountry.VE!;
  assert.equal(ve.blocA, 50); // abstain vs yes, against vs against
  assert.equal(ve.blocB, 50); // abstain vs no, against vs no
});

test('computeUnVotesAgreement respects the year floor', () => {
  const { sessions } = computeUnVotesAgreement(parseUnVotesCsv(CSV, memberToIso), {
    sinceYear: 2026,
  });
  assert.deepEqual(sessions, []);
});

test('buildSeatToIso resolves slugs, spouses-forms and UNGA aliases', () => {
  const resolve = buildSeatToIso(countryIso2);
  assert.equal(resolve.get('United States of America'), 'US');
  assert.equal(resolve.get('united-states'), 'US'); // slug
  assert.equal(resolve.get('Russian Federation'), 'RU');
  assert.equal(resolve.get('Bolivia (Plurinational State of)'), 'BO'); // parenthetical prefix
  assert.equal(resolve.get('Venezuela (Bolivarian Republic of)'), 'VE');
  assert.equal(resolve.get('Germany'), 'DE');
  assert.equal(resolve.get('France'), 'FR');
  assert.equal(resolve.get('Atlantis'), undefined);
});

test('buildSeatToIso resolves the previously-missed official names', () => {
  const resolve = buildSeatToIso(countryIso2);
  assert.equal(resolve.get("Lao People's Democratic Republic"), 'LA');
  assert.equal(resolve.get('United Republic of Tanzania'), 'TZ');
  assert.equal(resolve.get('Syrian Arab Republic'), 'SY');
  assert.equal(resolve.get('Viet Nam'), 'VN');
  assert.equal(resolve.get('United Arab Emirates'), 'AE');
  assert.equal(resolve.get('Democratic Republic of the Congo'), 'CD');
  assert.equal(resolve.get('Congo (Democratic Republic of the)'), 'CD'); // parenthetical form must not fall to a shorter prefix
  assert.equal(resolve.get("Côte d'Ivoire"), 'CI');
});