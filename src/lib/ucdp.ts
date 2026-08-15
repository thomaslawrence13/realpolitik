import { buildNameToIso } from './unVotes';
import type { SeatToIso } from './unVotes';
import { parseCsv } from './csv';

/**
 * UCDP Country-Year Dataset on Organized Violence (v26.1 provides matrices of
 * state-based, non-state and one-sided violence within country borders,
 * 1989–2025). Rows are country-year totals aggregated from the UCDP GED —
 * the cross-validated global standard rather than an early-warning signal.
 */

/** UCDP country names that differ from our slugs (or from official seat forms). */
export const UCDP_NAME_ALIASES: Record<string, readonly string[]> = {
  'bosnia-and-herzegovina': ['Bosnia-Herzegovina'],
  'cote-divoire': ['Ivory Coast'],
  czechia: ['Czech Republic', 'Czechia'],
  'dem-rep-congo': ['DR Congo (Zaire)'],
  uae: ['United Arab Emirates'],
  vietnam: ['Vietnam (North Vietnam)', 'Vietnam (South Vietnam)'],
};

export interface UcdpRow {
  country: string;
  gwCode: number;
  year: number;
  sbExist: boolean;
  nsExist: boolean;
  osExist: boolean;
  totalDeaths: number;
}

export const parseUcdpOvCsv = (text: string): UcdpRow[] => {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!;
  const index = new Map(header.map((name, i) => [name.trim(), i]));
  const iCountry = index.get('country');
  const iYear = index.get('year');
  const iSb = index.get('sb_exist');
  const iNs = index.get('ns_total_deaths_best');
  const iOs = index.get('os_total_deaths_best');
  if (iCountry === undefined || iYear === undefined || iSb === undefined || iNs === undefined || iOs === undefined) {
    throw new Error('UCDP OV-CY extract missing expected columns');
  }
  const iTotal = index.get('cumulative_total_deaths_in_orgvio_best');
  const out: UcdpRow[] = [];
  for (const raw of rows.slice(1)) {
    const year = Number.parseInt(raw[iYear]!, 10);
    if (!Number.isFinite(year)) continue;
    const totalRaw = iTotal !== undefined ? raw[iTotal] : '0';
    out.push({
      country: raw[iCountry]!,
      gwCode: Number.parseInt(raw[1]!, 10) || 0,
      year,
      sbExist: raw[iSb]! === '1',
      nsExist: Number.parseInt(raw[iNs]!, 10) > 0,
      osExist: Number.parseInt(raw[iOs]!, 10) > 0,
      totalDeaths: Number.parseInt(totalRaw, 10) || 0,
    });
  }
  return out;
};

export interface UcdpCountrySummary {
  active: boolean;
  lastYear: number;
  lastYearStateBased: boolean;
  lastYearNonState: boolean;
  lastYearOneSided: boolean;
  deathsLastYear: number;
  deathsPriorYear: number;
  totalDeathsInWindow: number;
  stateBased: boolean;
  nonState: boolean;
  oneSided: boolean;
}

export interface UcdpArtifact {
  fetchedAt: string;
  sourceTitle: string;
  sourceUrl: string;
  version: string;
  window: { fromYear: number; throughYear: number };
  perCountry: Record<string, UcdpCountrySummary>;
}

/**
 * Aggregate country-year rows into per-ISO summaries for an observed window
 * (2016+ by default). Only rows mapped via the name resolver are kept; the
 * attributable < → iso failures are simply absent (tomography honest).
 */
export const aggregateUcdpConflict = (
  rows: UcdpRow[],
  nameToIso: SeatToIso,
  options: { fromYear?: number } = {},
): { years: number[]; perCountry: Record<string, UcdpCountrySummary> } => {
  const fromYear = options.fromYear ?? 2016;
  const byIso = new Map<string, { year: number; deaths: number; sb: boolean; ns: boolean; os: boolean }[]>();
  for (const row of rows) {
    if (row.year < fromYear) continue;
    const iso = nameToIso.get(row.country);
    if (!iso) continue;
    const list = byIso.get(iso) ?? [];
    list.push({ year: row.year, deaths: row.totalDeaths, sb: row.sbExist, ns: row.nsExist, os: row.osExist });
    byIso.set(iso, list);
  }
  const years = new Set<number>();
  const perCountry: Record<string, UcdpCountrySummary> = {};
  for (const [iso, list] of byIso) {
    list.sort((a, b) => a.year - b.year);
    for (const entry of list) years.add(entry.year);
    const last = list[list.length - 1]!;
    const prior = list[list.length - 2];
    perCountry[iso] = {
      active: last.deaths > 0 || last.sb || last.ns || last.os,
      lastYear: last.year,
      lastYearStateBased: last.sb,
      lastYearNonState: last.ns,
      lastYearOneSided: last.os,
      deathsLastYear: last.deaths,
      deathsPriorYear: prior?.year === last.year - 1 ? prior.deaths : 0,
      totalDeathsInWindow: list.reduce((sum, entry) => sum + entry.deaths, 0),
      stateBased: list.some((entry) => entry.sb),
      nonState: list.some((entry) => entry.ns),
      oneSided: list.some((entry) => entry.os),
    };
  }
  return { years: [...years].sort((a, b) => a - b), perCountry };
};