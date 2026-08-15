import { parseCsv } from './csv';

/** Map vote text from the UNGA-DM extract to numeric codes. */
export const unVotesVoteCode = (raw: string): number | undefined => {
  const v = raw.trim().toLowerCase();
  if (v === 'in favor' || v === 'in favour' || v === 'yes') return 1;
  if (v === 'abstention' || v === 'abstain' || v === 'abstained') return 2;
  if (v === 'against' || v === 'no') return 3;
  return undefined;
};

/** A single roll-call row from the UNGA-DM extract. */
export interface UnVoteRow {
  rcid: string;
  session: number;
  date: string;
  /** UNGA-DM seat/label as recorded. */
  memberName: string;
  /** Optional ISO alpha-2 when the seat maps to a tracked country. */
  iso: string | undefined;
  vote: number;
}

/** Agreement of one country with the bloc anchors over the observed window. */
export interface UnVotesAgreement {
  /** % of shared roll-calls on which the country voted identically to the US. */
  blocA: number;
  /** % of shared roll-calls on which the country voted identically to Russia. */
  blocB: number;
  /** Number of roll-calls where both the anchor and the country cast a vote. */
  rollCalls: number;
}

export interface UnVotesArtifact {
  fetchedAt: string;
  sourceTitle: string;
  sourceUrl: string;
  anchors: { blocA: string; blocB: string };
  sessions: string[];
  perCountry: Record<string, UnVotesAgreement>;
}

export const DEFAULT_BLOC_A_MEMBER = 'United States of America';
export const DEFAULT_BLOC_B_MEMBER = 'Russian Federation';

/** Seat names in the UNGA-DM extract that differ from our country slugs. */
export const SEAT_ALIASES: Record<string, readonly string[]> = {
  russia: ['Russian Federation'],
  'united-states': ['United States of America'],
  'south-korea': ['Republic of Korea'],
  'north-korea': ["Democratic People's Republic of Korea"],
  czechia: ['Czechia', 'Czech Republic'],
  'cote-divoire': ["Côte d'Ivoire"],
  'dem-rep-congo': ['Democratic Republic of the Congo', 'Congo (Democratic Republic of the)'],
  uae: ['United Arab Emirates'],
  vietnam: ['Viet Nam'],
  laos: ["Lao People's Democratic Republic"],
  tanzania: ['United Republic of Tanzania'],
  syria: ['Syrian Arab Republic'],
};

/** Minimal structural typing so callers can pass a plain Map or our resolver. */
export type SeatToIso = { get(seat: string): string | undefined };

const slugVariant = (slug: string) => slug.replace(/-/g, ' ');

/**
 * Build a name → ISO resolver from a country slug map and per-slug aliases.
 * Resolution order: exact slug / "slug with spaces" / alias (case
 * insensitive), then longest-prefix match so parenthetical official names
 * such as "Bolivia (Plurinational State of)" still resolve.
 */
export const buildNameToIso = (
  countryIso2: Record<string, string>,
  aliases: Record<string, readonly string[]>,
): SeatToIso => {
  const exact = new Map<string, string>();
  const prefixes: Array<[prefix: string, iso: string]> = [];

  for (const [slug, iso] of Object.entries(countryIso2)) {
    exact.set(slug.toLowerCase(), iso);
    const plain = slugVariant(slug);
    exact.set(plain, iso);
    for (const alias of aliases[slug] ?? []) exact.set(alias.toLowerCase(), iso);
    prefixes.push([`${plain} `, iso]);
  }

  return {
    get(seat) {
      const lowered = seat.toLowerCase().replace(/\s+/g, ' ').trim();
      const hit = exact.get(lowered);
      if (hit) return hit;
      for (const [prefix, iso] of prefixes) {
        if (lowered.startsWith(prefix)) return iso;
      }
      return undefined;
    },
  };
};

/** UNGA-DM seat names to our country slugs; see buildSeatToIso. */
export const buildSeatToIso = (countryIso2: Record<string, string>): SeatToIso =>
  buildNameToIso(countryIso2, SEAT_ALIASES);

const findColumn = (header: string[], name: string): number => {
  const index = header.findIndex((cell) => cell.trim().toLowerCase() === name.toLowerCase());
  if (index < 0) throw new Error(`UNGA-DM extract missing expected column "${name}"`);
  return index;
};

/**
 * Parse the UNGA-DM "all recorded votes" CSV extract. Columns include:
 * decision_id, member_state, current_seat_name, original_vote, session_id,
 * meeting_record_id, meeting_date. Only final "recorded vote" decisions on
 * drafted resolutions are kept (`decision_topic === 'draft resolution',
 * decision_mode === 'recorded vote'`).
 */
export const parseUnVotesCsv = (text: string, memberToIso?: SeatToIso | Map<string, string>): UnVoteRow[] => {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!;
  const iDecision = findColumn(header, 'decision_id');
  const iMember = findColumn(header, 'member_state');
  const iVoteText = findColumn(header, 'original_vote');
  const iDate = findColumn(header, 'meeting_date');
  const iTopic = findColumn(header, 'decision_topic');
  const iMode = findColumn(header, 'decision_mode');
  const iName = findColumn(header, 'current_seat_name');

  const out: UnVoteRow[] = [];
  for (const row of rows.slice(1)) {
    const topic = (row[iTopic] ?? '').trim().toLowerCase();
    const mode = (row[iMode] ?? '').trim().toLowerCase();
    if (topic !== 'draft resolution') continue;
    if (mode !== 'recorded vote') continue;
    const vote = unVotesVoteCode(row[iVoteText] ?? '');
    if (vote === undefined) continue;

    const date = (row[iDate] ?? '').trim();
    const year = Number.parseInt(date.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;

    const name = (row[iName] ?? row[iMember] ?? '').trim();
    const iso = memberToIso?.get(name);
    out.push({
      rcid: (row[iDecision] ?? '').trim(),
      session: year,
      date,
      memberName: name,
      iso,
      vote,
    });
  }
  return out;
};

const castVote = (vote: number): boolean => vote === 1 || vote === 2 || vote === 3;

/**
 * Compute per-member agreement with the bloc anchors over the observed years.
 * Only roll-calls where the anchor cast a vote count; agreement = identical vote.
 */
export const computeUnVotesAgreement = (
  rows: UnVoteRow[],
  options?: {
    sinceYear?: number;
    minRollCalls?: number;
    blocAMember?: string;
    blocBMember?: string;
  },
): { sessions: string[]; perCountry: Record<string, UnVotesAgreement> } => {
  const sinceYear = options?.sinceYear ?? 0;
  const minRollCalls = options?.minRollCalls ?? 12;
  const blocAMember = options?.blocAMember ?? DEFAULT_BLOC_A_MEMBER;
  const blocBMember = options?.blocBMember ?? DEFAULT_BLOC_B_MEMBER;

  const byRcid = new Map<string, UnVoteRow[]>();
  const sessions = new Set<string>();
  for (const row of rows) {
    if (row.session < sinceYear) continue;
    sessions.add(String(row.session));
    const existing = byRcid.get(row.rcid) ?? [];
    existing.push(row);
    byRcid.set(row.rcid, existing);
  }

  const agreedByIso = new Map<string, { a: number; aRoll: number; b: number; bRoll: number }>();
  for (const [rcid, members] of byRcid) {
    if (!rcid) continue;
    const anchorA = members.find((row) => row.memberName === blocAMember && castVote(row.vote));
    const anchorB = members.find((row) => row.memberName === blocBMember && castVote(row.vote));
    for (const member of members) {
      if (!member.iso) continue;
      if (member.memberName === blocAMember || member.memberName === blocBMember) continue;
      if (!castVote(member.vote)) continue;
      const entry = agreedByIso.get(member.iso) ?? { a: 0, aRoll: 0, b: 0, bRoll: 0 };
      if (anchorA) {
        entry.aRoll++;
        if (member.vote === anchorA.vote) entry.a++;
      }
      if (anchorB) {
        entry.bRoll++;
        if (member.vote === anchorB.vote) entry.b++;
      }
      agreedByIso.set(member.iso, entry);
    }
  }

  const perCountry: Record<string, UnVotesAgreement> = {};
  for (const [iso, entry] of agreedByIso) {
    if (entry.aRoll + entry.bRoll < minRollCalls) continue;
    perCountry[iso] = {
      blocA: Math.round((entry.a / entry.aRoll) * 100),
      blocB: Math.round((entry.b / entry.bRoll) * 100),
      rollCalls: entry.aRoll + entry.bRoll,
    };
  }

  return {
    sessions: [...sessions].sort((a, b) => Number(a) - Number(b)),
    perCountry,
  };
};