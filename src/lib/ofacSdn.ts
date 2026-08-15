import { parseCsv } from './csv';

/** U.S. Treasury OFAC SDN list (legacy CSV, one row per listing entity). */
export interface OfacSdnRow {
  id: string;
  name: string;
  programs: string[];
  remarks: string;
}

/** Aggregated per-country count from the OFAC SDN list. */
export interface OfacCountrySummary {
  entryCount: number;
  programCount: number;
  topPrograms: Array<{ program: string; count: number }>;
}

export interface OfacSummary {
  fetchedAt: string;
  sourceTitle: string;
  sourceUrl: string;
  entryTotal: number;
  perCountry: Record<string, OfacCountrySummary>;
}

/**
 * Program-name prefixes that identify a sanctions program targeting one country.
 *
 * OFAC renames and retires programme codes as authorities change, and a code
 * this list does not recognise is silently dropped from country attribution —
 * so a stale entry here reads as "no US sanctions" rather than as a mapping
 * gap. Syria is the cautionary case: its listings moved to `PAARSSR-EO13894`
 * and the bare `SYRIA` prefix stopped matching anything at all, leaving one of
 * the most heavily sanctioned countries in the dataset showing nothing.
 *
 * Thematic programmes are deliberately absent. SDGT, SDNTK, NPWMD, GLOMAG,
 * TCO, FTO, CYBER2/4, ILLICIT-DRUGS and ELECTION designate conduct wherever it
 * occurs; attributing them to the designee's country would turn a US
 * counter-terrorism listing into a claim about that country. `BALKANS` is
 * excluded for the same reason in reverse — it names a region, not a state.
 */
const COUNTRY_PROGRAM_PREFIXES: Array<[string, string]> = [
  ['RUSSIA', 'RU'],
  // Russia-specific statutory programmes that do not start with "RUSSIA".
  ['CAATSA - RUSSIA', 'RU'],
  ['MAGNIT', 'RU'],
  ['UKRAINE', 'UA'],
  ['IRAN', 'IR'],
  // Iran's Revolutionary Guard and the Iran Freedom and Counter-Proliferation
  // Act are Iran programmes under names that do not begin with "IRAN".
  ['IRGC', 'IR'],
  ['IFCA', 'IR'],
  ['CUBA', 'CU'],
  ['SYRIA', 'SY'],
  ['PAARSSR', 'SY'],
  ['VENEZUELA', 'VE'],
  ['BELARUS', 'BY'],
  ['ZIMBABWE', 'ZW'],
  ['NICARAGUA', 'NI'],
  ['NORTH-KOREA', 'KP'],
  ['DPRK', 'KP'],
  ['SUDAN', 'SD'],
  ['LEB', 'LB'],
  ['YEMEN', 'YE'],
  ['MALI', 'ML'],
  ['LIBYA', 'LY'],
  ['SOMALIA', 'SO'],
  ['ETHIOPIA', 'ET'],
  ['BURUNDI', 'BI'],
  ['CAR', 'CF'],
  ['HAITI', 'HT'],
  ['IRAQ', 'IQ'],
  ['BURMA', 'MM'],
  ['DRCONGO', 'CD'],
];

const programIso = (program: string): string | undefined => {
  const clean = program.trim().toUpperCase();
  for (const [prefix, iso] of COUNTRY_PROGRAM_PREFIXES) {
    if (clean.startsWith(prefix)) return iso;
  }
  return undefined;
};

/**
 * Parse the legacy OFAC SDN CSV. Columns: 1 id, 2 name, 4 programs (may
 * contain multiple codes separated by `] [` or `;`) and 12 remarks.
 */
export const parseSdnCsv = (text: string): OfacSdnRow[] => {
  const rows = parseCsv(text);
  const out: OfacSdnRow[] = [];
  for (const row of rows) {
    if (row.length < 4) continue;
    const id = (row[0] ?? '').trim();
    const name = (row[1] ?? '').trim();
    if (!id && !name) continue;
    const programs = (row[3] ?? '')
      .trim()
      .replace(/\]\s*\[/g, ';')
      .split(/[;,]/)
      .map((program) => program.trim())
      .filter(Boolean);
    out.push({ id, name, programs, remarks: (row[11] ?? '').trim() });
  }
  return out;
};

/**
 * Aggregate parsed SDN rows into per-country summaries using the program
 * country mapping. Rows without a country-specific program are excluded from
 * the per-country bucket (the caller still counts them in entryTotal).
 */
export const aggregateOfacByCountry = (rows: OfacSdnRow[]): Record<string, OfacCountrySummary> => {
  const byIso = new Map<string, { entries: number; programs: Map<string, number> }>();
  for (const row of rows) {
    const countryIsos = new Set(row.programs.map(programIso).filter((iso) => iso !== undefined));
    if (countryIsos.size === 0) continue;
    for (const iso of countryIsos) {
      const entry = byIso.get(iso) ?? { entries: 0, programs: new Map() };
      entry.entries++;
      for (const program of row.programs) {
        entry.programs.set(program, (entry.programs.get(program) ?? 0) + 1);
      }
      byIso.set(iso, entry);
    }
  }

  const perCountry: Record<string, OfacCountrySummary> = {};
  for (const [iso, entry] of byIso) {
    const topPrograms = [...entry.programs.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([program, count]) => ({ program, count }));
    perCountry[iso] = {
      entryCount: entry.entries,
      programCount: entry.programs.size,
      topPrograms,
    };
  }
  return perCountry;
};