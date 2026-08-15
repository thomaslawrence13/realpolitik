import type { UnVotesAgreement, UnVotesArtifact } from './unVotes';

/**
 * Official UN Digital Library GA voting CSV.
 * Record: https://digitallibrary.un.org/record/4060887
 * File:    2026_02_06_ga_voting.csv (updated ~annually; covers recorded votes).
 * Rows carry ISO3 member codes (`ms_code`), so attribution is exact — no
 * seat-name matching needed. Historical predecessor codes (SUN, CSK, DDR,
 * YUG, SCG, YMD, EAT, EAZ, GER) map to their current successors but only
 * matter pre-1991 rows; our computed window starts 2016.
 */

/** ISO alpha-3 (UN ms_code) → ISO alpha-2. Covers all members + historical codes. */
export const ISO3_TO_ISO2: Record<string, string> = {
  AFG: 'AF', AGO: 'AO', ALB: 'AL', AND: 'AD', ARE: 'AE', ARG: 'AR', ARM: 'AM', AUS: 'AU',
  AUT: 'AT', AZE: 'AZ', BDI: 'BI', BEL: 'BE', BEN: 'BJ', BFA: 'BF', BGD: 'BD', BGR: 'BG',
  BHR: 'BH', BHS: 'BS', BIH: 'BA', BLR: 'BY', BLZ: 'BZ', BOL: 'BO', BRA: 'BR', BRB: 'BB',
  BRN: 'BN', BTN: 'BT', BWA: 'BW', CAF: 'CF', CAN: 'CA', CHE: 'CH', CHL: 'CL', CHN: 'CN',
  CIV: 'CI', CMR: 'CM', COD: 'CD', COG: 'CG', COL: 'CO', COM: 'KM', CPV: 'CV', CRI: 'CR',
  CSK: 'CZ', CUB: 'CU', CYP: 'CY', CZE: 'CZ', DDR: 'DE', DEU: 'DE', DJI: 'DJ', DMA: 'DM',
  DNK: 'DK', DOM: 'DO', DZA: 'DZ', EAT: 'TZ', EAZ: 'TZ', ECU: 'EC', EGY: 'EG', ERI: 'ER',
  ESP: 'ES', EST: 'EE', ETH: 'ET', FIN: 'FI', FJI: 'FJ', FRA: 'FR', FSM: 'FM', GAB: 'GA',
  GBR: 'GB', GEO: 'GE', GER: 'DE', GHA: 'GH', GIN: 'GN', GMB: 'GM', GNB: 'GW', GNQ: 'GQ',
  GRC: 'GR', GRD: 'GD', GTM: 'GT', GUY: 'GY', HND: 'HN', HRV: 'HR', HTI: 'HT', HUN: 'HU',
  IDN: 'ID', IND: 'IN', IRL: 'IE', IRN: 'IR', IRQ: 'IQ', ISL: 'IS', ISR: 'IL', ITA: 'IT',
  JAM: 'JM', JOR: 'JO', JPN: 'JP', KAZ: 'KZ', KEN: 'KE', KGZ: 'KG', KHM: 'KH', KIR: 'KI',
  KNA: 'KN', KOR: 'KR', KWT: 'KW', LAO: 'LA', LBN: 'LB', LBR: 'LR', LBY: 'LY', LCA: 'LC',
  LIE: 'LI', LKA: 'LK', LSO: 'LS', LTU: 'LT', LUX: 'LU', LVA: 'LV', MAR: 'MA', MCO: 'MC',
  MDA: 'MD', MDG: 'MG', MDV: 'MV', MEX: 'MX', MHL: 'MH', MKD: 'MK', MLI: 'ML', MLT: 'MT',
  MMR: 'MM', MNE: 'ME', MNG: 'MN', MOZ: 'MZ', MRT: 'MR', MUS: 'MU', MWI: 'MW', MYS: 'MY',
  NAM: 'NA', NER: 'NE', NGA: 'NG', NIC: 'NI', NLD: 'NL', NOR: 'NO', NPL: 'NP', NRU: 'NR',
  NZL: 'NZ', OMN: 'OM', PAK: 'PK', PAN: 'PA', PER: 'PE', PHL: 'PH', PLW: 'PW', PNG: 'PG',
  POL: 'PL', PRK: 'KP', PRT: 'PT', PRY: 'PY', QAT: 'QA', ROU: 'RO', RUS: 'RU', RWA: 'RW',
  SAU: 'SA', SCG: 'RS', SDN: 'SD', SEN: 'SN', SGP: 'SG', SLB: 'SB', SLE: 'SL', SLV: 'SV',
  SMR: 'SM', SOM: 'SO', SRB: 'RS', SSD: 'SS', STP: 'ST', SUN: 'RU', SUR: 'SR', SVK: 'SK',
  SVN: 'SI', SWE: 'SE', SWZ: 'SZ', SYC: 'SC', SYR: 'SY', TCD: 'TD', TGO: 'TG', THA: 'TH',
  TJK: 'TJ', TKM: 'TM', TLS: 'TL', TON: 'TO', TTO: 'TT', TUN: 'TN', TUR: 'TR', TUV: 'TV',
  TZA: 'TZ', UGA: 'UG', UKR: 'UA', URY: 'UY', USA: 'US', UZB: 'UZ', VCT: 'VC', VEN: 'VE',
  VNM: 'VN', VUT: 'VU', WSM: 'WS', YEM: 'YE', YMD: 'YE', YUG: 'RS', ZAF: 'ZA', ZMB: 'ZM',
  ZWE: 'ZW',
};

/** Map official ms_vote text to numeric codes. */
export const unVotesOfficialVoteCode = (raw: string): number | undefined => {
  const value = raw.trim().toUpperCase();
  if (value === 'Y') return 1;   // in favour
  if (value === 'N') return 3;   // against
  if (value === 'A') return 2;   // abstention
  return undefined;              // non-voting / absent
};

export interface UnVotesOfficialRow {
  /** Resolution id; groups one roll call. */
  resolutionId: string;
  session: number;
  date: string;
  iso2: string | undefined;
  vote: number;
}

const NEEDED_FIELDS = 8; // undl_id, ms_code, ms_name, ms_vote, date, session, resolution, draft

/**
 * Tolerant line scanner over the official CSV text. Only the leading 8
 * fields are extracted (quote-aware) because later free-text titles may
 * contain unescaped quotes; a line that fails the scan is skipped (one lost
 * member vote per malformed line, never a parse explosion).
 */
export const parseUnVotesOfficialCsv = (text: string): UnVotesOfficialRow[] => {
  const rows: UnVotesOfficialRow[] = [];
  const lines = text.split('\n');
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!;
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; continue; }
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current);
        current = '';
        if (fields.length === NEEDED_FIELDS) break;
      } else {
        current += ch;
      }
    }
    if (inQuotes || fields.length < NEEDED_FIELDS) continue;

    const draft = fields[7]!.trim();
    if (draft.length === 0) continue; // only draft resolutions with recorded votes
    const vote = unVotesOfficialVoteCode(fields[3]!);
    if (vote === undefined) continue;
    const date = fields[4]!.trim();
    const year = Number.parseInt(date.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;

    rows.push({
      resolutionId: fields[0]!.trim(),
      session: year,
      date,
      iso2: ISO3_TO_ISO2[fields[1]!.trim()] ?? undefined,
      vote,
    });
  }
  return rows;
};

/**
 * Agreement of each ISO2 country with the bloc anchors (USA / RUS) over the
 * observed years: only resolutions where the anchor cast a vote count, and a
 * country shares the roll call when it votes identically. Emits the same
 * artifact shape as the UNGA-DM pipeline so the registry overlay is unchanged.
 */
export const computeUnVotesAgreementOfficial = (
  rows: UnVotesOfficialRow[],
  options?: {
    sinceYear?: number;
    minRollCalls?: number;
    blocAIso?: string;
    blocBIso?: string;
  },
): { sessions: string[]; perCountry: Record<string, UnVotesAgreement> } => {
  const sinceYear = options?.sinceYear ?? 0;
  const minRollCalls = options?.minRollCalls ?? 12;
  const blocAIso = options?.blocAIso ?? 'US';
  const blocBIso = options?.blocBIso ?? 'RU';

  const anchorVotes = new Map<string, { vA: number | undefined; vB: number | undefined }>();
  const casts = new Map<string, Array<{ iso2: string; vote: number }>>();
  const sessions = new Set<string>();

  for (const row of rows) {
    if (row.session < sinceYear) continue;
    if (!row.iso2) continue;
    sessions.add(String(row.session));
    const entry = anchorVotes.get(row.resolutionId) ?? { vA: undefined, vB: undefined };
    if (row.iso2 === blocAIso) entry.vA = row.vote;
    if (row.iso2 === blocBIso) entry.vB = row.vote;
    anchorVotes.set(row.resolutionId, entry);
    const list = casts.get(row.resolutionId) ?? [];
    list.push({ iso2: row.iso2, vote: row.vote });
    casts.set(row.resolutionId, list);
  }

  const agreed = new Map<string, { a: number; aRoll: number; b: number; bRoll: number }>();
  for (const [rcid, anchor] of anchorVotes) {
    for (const member of casts.get(rcid) ?? []) {
      if (member.iso2 === blocAIso || member.iso2 === blocBIso) continue;
      const entry = agreed.get(member.iso2) ?? { a: 0, aRoll: 0, b: 0, bRoll: 0 };
      if (anchor.vA !== undefined) { entry.aRoll++; if (member.vote === anchor.vA) entry.a++; }
      if (anchor.vB !== undefined) { entry.bRoll++; if (member.vote === anchor.vB) entry.b++; }
      agreed.set(member.iso2, entry);
    }
  }

  const perCountry: Record<string, UnVotesAgreement> = {};
  for (const [iso, entry] of agreed) {
    if (entry.aRoll + entry.bRoll < minRollCalls) continue;
    perCountry[iso] = {
      blocA: Math.round((entry.a / entry.aRoll) * 100),
      blocB: Math.round((entry.b / entry.bRoll) * 100),
      rollCalls: entry.aRoll + entry.bRoll,
    };
  }

  return {
    sessions: [...sessions].sort((left, right) => Number(left) - Number(right)),
    perCountry,
  };
};

export const buildOfficialArtifact = (
  computed: { sessions: string[]; perCountry: Record<string, UnVotesAgreement> },
  fetchedAt: string,
): UnVotesArtifact => ({
  fetchedAt,
  sourceTitle: 'United Nations Digital Library: General Assembly voting data (official CSV)',
  sourceUrl: 'https://digitallibrary.un.org/record/4060887',
  anchors: { blocA: 'United States of America', blocB: 'Russian Federation' },
  sessions: computed.sessions,
  perCountry: computed.perCountry,
});