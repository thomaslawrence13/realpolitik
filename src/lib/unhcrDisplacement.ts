/**
 * UNHCR Refugee Data Finder — the displacement layer.
 *
 * Displacement is one of the few strategic pressures the dataset had no
 * observed evidence for at all: conflict had UCDP, sanctions had OFAC and the
 * UN list, but the people moving because of either were invisible. This module
 * reads the UNHCR public API and keeps two facts that are constantly conflated
 * strictly apart:
 *
 *   - **Origin** — people displaced *from* a country. A pressure the country
 *     is producing.
 *   - **Asylum** — people hosted *in* a country. A load the country is
 *     carrying, and often a sign of a neighbour's crisis rather than its own.
 *
 * A single "displacement" number that merges the two would rank Germany
 * alongside Syria, so the artifact never computes one.
 *
 * Two further boundaries are structural. UNHCR's mandate does not cover
 * Palestine refugees under UNRWA, and IDP figures are reported only where a
 * monitoring operation exists — so a zero in this data means "not reported by
 * UNHCR", never "nobody is displaced". Countries absent from a response are
 * omitted rather than written as zero.
 */

/** One API row, already reduced to the population types this app uses. */
export interface UnhcrPopulationRow {
  iso3: string;
  refugees: number;
  asylumSeekers: number;
  idps: number;
  stateless: number;
  /** "Others of concern" — a residual UNHCR category, kept out of headline counts. */
  othersOfConcern: number;
}

/**
 * UNHCR returns counts as numbers *or* as strings (`"0"`, `"-"`). A `"-"` means
 * the cell was not reported, which is not a zero — but for a summed total both
 * collapse to "adds nothing", so the coercion is safe here and the distinction
 * is preserved by omitting unreported countries entirely.
 */
export const toCount = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.replace(/,/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

interface RawUnhcrItem {
  [key: string]: unknown;
}

/**
 * Reduce an API page to rows keyed by the requested dimension.
 *
 * `dimension` is `coo` (country of origin) or `coa` (country of asylum); the
 * API echoes the other side as `"-"`, so reading the wrong key silently yields
 * an empty artifact — hence the explicit parameter rather than a guess.
 */
export const parseUnhcrItems = (
  items: RawUnhcrItem[],
  dimension: 'coo' | 'coa',
): UnhcrPopulationRow[] => {
  const key = `${dimension}_iso`;
  const rows: UnhcrPopulationRow[] = [];
  for (const item of items) {
    const iso3 = item[key];
    if (typeof iso3 !== 'string' || !/^[A-Z]{3}$/.test(iso3)) continue;
    rows.push({
      iso3,
      refugees: toCount(item.refugees),
      asylumSeekers: toCount(item.asylum_seekers),
      idps: toCount(item.idps),
      stateless: toCount(item.stateless),
      othersOfConcern: toCount(item.ooc),
    });
  }
  return rows;
};

export interface UnhcrCountrySummary {
  /** Refugees who originate from this country (displacement produced). */
  refugeesFromCountry: number;
  asylumSeekersFromCountry: number;
  /** Refugees this country hosts (displacement absorbed). */
  refugeesHosted: number;
  asylumSeekersHosted: number;
  /** Internally displaced people inside this country, where UNHCR monitors them. */
  idps: number;
  /** Stateless people reported in this country. */
  stateless: number;
}

export interface UnhcrArtifact {
  fetchedAt: string;
  /** Reference year of the figures — always a completed year, never a nowcast. */
  referenceYear: number;
  sourceTitle: string;
  sourceUrl: string;
  /** Countries present on the origin side of the response. */
  originCountryCount: number;
  /** Countries present on the asylum side of the response. */
  asylumCountryCount: number;
  perCountry: Record<string, UnhcrCountrySummary>;
}

const emptySummary = (): UnhcrCountrySummary => ({
  refugeesFromCountry: 0,
  asylumSeekersFromCountry: 0,
  refugeesHosted: 0,
  asylumSeekersHosted: 0,
  idps: 0,
  stateless: 0,
});

/**
 * Merge the origin and asylum responses into per-ISO2 summaries.
 *
 * Only countries the app tracks are kept, and only rows carrying a non-zero
 * figure produce an entry: an all-zero row is UNHCR reporting nothing for that
 * country, and writing it into the artifact would turn "unreported" into a
 * measured zero on screen.
 */
export const aggregateUnhcrDisplacement = (
  origin: UnhcrPopulationRow[],
  asylum: UnhcrPopulationRow[],
  iso3ToIso2: Record<string, string>,
  trackedIso2: ReadonlySet<string>,
): Record<string, UnhcrCountrySummary> => {
  const byIso = new Map<string, UnhcrCountrySummary>();

  const bucket = (iso3: string): UnhcrCountrySummary | undefined => {
    const iso2 = iso3ToIso2[iso3];
    if (!iso2 || !trackedIso2.has(iso2)) return undefined;
    const existing = byIso.get(iso2) ?? emptySummary();
    byIso.set(iso2, existing);
    return existing;
  };

  for (const row of origin) {
    const summary = bucket(row.iso3);
    if (!summary) continue;
    summary.refugeesFromCountry += row.refugees;
    summary.asylumSeekersFromCountry += row.asylumSeekers;
    // IDPs and stateless populations are internal to the country of origin, so
    // they are read from this side only — taking them from both would double.
    summary.idps += row.idps;
    summary.stateless += row.stateless;
  }

  for (const row of asylum) {
    const summary = bucket(row.iso3);
    if (!summary) continue;
    summary.refugeesHosted += row.refugees;
    summary.asylumSeekersHosted += row.asylumSeekers;
  }

  const perCountry: Record<string, UnhcrCountrySummary> = {};
  for (const [iso2, summary] of byIso) {
    const total =
      summary.refugeesFromCountry +
      summary.asylumSeekersFromCountry +
      summary.refugeesHosted +
      summary.asylumSeekersHosted +
      summary.idps +
      summary.stateless;
    if (total > 0) perCountry[iso2] = summary;
  }
  return perCountry;
};

/** Displaced people per 1,000 residents — the only fair cross-country comparison. */
export const displacementPer1000 = (count: number, population: number): number | null => {
  if (!Number.isFinite(population) || population <= 0) return null;
  return Math.round((count / population) * 1000 * 10) / 10;
};
