import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateUcdpConflict, parseUcdpOvCsv, UCDP_NAME_ALIASES } from './ucdp';
import { buildNameToIso } from './unVotes';
import { countryIso2 } from './worldBankFetch';

const HEADER =
  'country,country_id,year,region,govt_name,sb_exist,sb_dyad_count,sb_dyad_ids,sb_dyad_names,sb_deaths_parties,sb_deaths_civilians,sb_deaths_unknown,sb_total_deaths_best,sb_total_deaths_high,sb_total_deaths_low,sb_intrastate_exist,sb_intrastate_dyad_count,sb_intrastate_dyad_ids,sb_intrastate_dyad_names,sb_intrastate_govt_inv_incomp,sb_intrastate_deaths_parties,sb_intrastate_deaths_civilians,sb_intrastate_deaths_unknown,sb_intrastate_deaths_best,sb_intrastate_deaths_high,sb_intrastate_deaths_low,sb_interstate_exist,sb_interstate_dyad_count,sb_interstate_dyad_ids,sb_interstate_dyad_names,sb_interstate_govt_inv_incomp,sb_interstate_deaths_parties,sb_interstate_deaths_civilians,sb_interstate_deaths_unknown,sb_interstate_deaths_best,sb_interstate_deaths_high,sb_interstate_deaths_low,ns_exist,ns_dyad_count,ns_dyad_ids,ns_dyad_names,ns_deaths_parties,ns_deaths_civilians,ns_deaths_unknown,ns_total_deaths_best,ns_total_deaths_high,ns_total_deaths_low,os_exist,os_dyad_count,os_dyad_ids,os_dyad_names,os_govt_inv,os_govt_killings_best,os_govt_killings_high,os_govt_killings_low,os_any_govt_inv,os_any_govt_killings_best,os_any_govt_killings_high,os_any_govt_killings_low,os_nsgroup_inv,os_nsgroup_killings_best,os_nsgroup_killings_high,os_nsgroup_killings_low,os_killings_unknown,os_total_deaths_best,os_total_deaths_high,os_total_deaths_low,cumulative_total_deaths_parties_in_orgvio,cumulative_total_deaths_civilians_in_orgvio,cumulative_total_deaths_unknown_in_orgvio,cumulative_total_deaths_in_orgvio_best,cumulative_total_deaths_in_orgvio_high,cumulative_total_deaths_in_orgvio_low,Version';

const headerCols = HEADER.split(',');

const row = (
  country: string,
  year: number,
  overrides: Record<string, string> = {},
): string => {
  const fields: Record<string, string> = {
    country, country_id: '700', year: String(year), region: 'Asia', govt_name: 'Government',
    sb_exist: '0', ns_total_deaths_best: '0', os_total_deaths_best: '0',
    cumulative_total_deaths_in_orgvio_best: '0',
  };
  for (const [key, value] of Object.entries(overrides)) fields[key] = value;
  return headerCols.map((name) => fields[name] ?? '').join(',');
};

test('parseUcdpOvCsv reads country-year totals and existence flags', () => {
  const csv = [
    HEADER,
    row('Afghanistan', 2022, { sb_exist: '1', ns_total_deaths_best: '120', os_total_deaths_best: '8', cumulative_total_deaths_in_orgvio_best: '940' }),
    row('Germany', 2022),
    row('Ivory Coast', 2015, { cumulative_total_deaths_in_orgvio_best: '60' }),
  ].join('\n');
  const rows = parseUcdpOvCsv(csv);
  assert.equal(rows.length, 3);
  const afg = rows[0]!;
  assert.equal(afg.year, 2022);
  assert.equal(afg.sbExist, true);
  assert.equal(afg.nsExist, true);
  assert.equal(afg.osExist, true);
  assert.equal(afg.totalDeaths, 940);
  assert.equal(rows[1]!.sbExist, false);
});

test('aggregateUcdpConflict resolves names via aliases and summarizes the window', () => {
  const csv = [
    HEADER,
    row('Afghanistan', 2021, { sb_exist: '1', cumulative_total_deaths_in_orgvio_best: '1000' }),
    row('Afghanistan', 2022, { sb_exist: '1', cumulative_total_deaths_in_orgvio_best: '800' }),
    row('Ivory Coast', 2022, { cumulative_total_deaths_in_orgvio_best: '40' }),
    row('DR Congo (Zaire)', 2022, { cumulative_total_deaths_in_orgvio_best: '200' }),
    row('United Arab Emirates', 2022),
    row('Czech Republic', 2022),
  ].join('\n');
  const resolver = buildNameToIso(countryIso2, UCDP_NAME_ALIASES);
  const { years, perCountry } = aggregateUcdpConflict(parseUcdpOvCsv(csv), resolver, { fromYear: 2021 });
  assert.deepEqual(years, [2021, 2022]);
  const afg = perCountry.AF!;
  assert.equal(afg.active, true);
  assert.equal(afg.lastYear, 2022);
  assert.equal(afg.deathsLastYear, 800);
  assert.equal(afg.deathsPriorYear, 1000);
  assert.equal(afg.totalDeathsInWindow, 1800);
  assert.equal(afg.stateBased, true);
  assert.equal(perCountry.CI!.deathsLastYear, 40);
  assert.equal(perCountry.CD!.totalDeathsInWindow, 200);
  assert.equal(perCountry.AE!.active, false); // zero deaths → inactive
  assert.equal(perCountry.CZ!.active, false);
});

test('UCDP resolver covers the full tracked-country set', () => {
  const resolver = buildNameToIso(countryIso2, UCDP_NAME_ALIASES);
  // Names actually used by the v26.1 file for tracked countries.
  const nameHits = ['United States of America', 'Russia (Soviet Union)', 'South Korea', 'North Korea',
    'Bosnia-Herzegovina', 'DR Congo (Zaire)', 'Ivory Coast',
    'Vietnam (North Vietnam)', 'Yemen (North Yemen)', 'United Arab Emirates', 'Czech Republic'];
  for (const name of nameHits) {
    assert.ok(resolver.get(name), `expected "${name}" to resolve`);
  }
});