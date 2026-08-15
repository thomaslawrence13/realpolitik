/**
 * EU Consolidated Financial Sanctions List — the third sanctions authority.
 *
 * With the UN list (multilateral) and OFAC (United States) already wired, the
 * EU list completes the set of authorities whose measures a reader is likely to
 * have heard about. All three stay separate: they are distinct legal
 * instruments, and a merged count would imply a single global authority.
 *
 * **Attribution differs from the other two lists, deliberately.** UN regimes
 * and OFAC programmes are named for the situation whose actors are designated,
 * so attributing by programme works there. EU programme codes are named for the
 * situation *including its victim* — the `UKR` programme covers measures
 * against actions undermining Ukraine's territorial integrity, and nearly 3,000
 * of its designations are Russian. Attributing by programme would print
 * "Ukraine: 2,960 EU sanctions listings" on Ukraine's card, which is the
 * opposite of the truth.
 *
 * So the EU list is attributed by *identity*: the citizenship of a designated
 * person and the registered address of a designated entity. That is a factual,
 * non-interpretive claim — "the EU has designated N persons holding this
 * citizenship and N entities registered here" — and the programme mix is
 * carried alongside so the legal basis stays visible. The UI states this basis
 * rather than letting three differently-derived numbers look comparable.
 */

import { decodeXmlText, readXmlField } from './unscSanctions';

/** EU programme codes, expanded to the measure they belong to. */
export const EU_PROGRAMME_LABELS: Record<string, string> = {
  UKR: "Ukraine's territorial integrity",
  RUS: 'Russia — destabilising actions',
  RUSDA: 'Russia — hybrid/destabilising activities',
  BLR: 'Belarus',
  IRN: 'Iran',
  SYR: 'Syria',
  PRK: "Korea, Dem. People's Rep.",
  AFG: 'Afghanistan',
  MMR: 'Myanmar/Burma',
  COD: 'Congo, Dem. Rep.',
  IRQ: 'Iraq',
  VEN: 'Venezuela',
  LBY: 'Libya',
  SOM: 'Somalia',
  NIC: 'Nicaragua',
  CAF: 'Central African Republic',
  MDA: 'Moldova',
  TUN: 'Tunisia — misappropriation of state funds',
  SDNZ: 'Sudan',
  ZWE: 'Zimbabwe',
  TAQA: 'Al-Qaida and ISIL/Da’esh',
  TERR: 'Terrorism',
  HR: 'Global human rights',
  CHEM: 'Chemical weapons',
  CYB: 'Cyber-attacks',
  EUAQ: 'EU autonomous Al-Qaida measures',
};

export interface EuListing {
  /** EU-stable record id, usable across list revisions. */
  logicalId: string;
  /** Official EU reference number, e.g. `EU.27.28`. */
  euReference: string;
  subjectType: 'person' | 'enterprise';
  /** Programme codes on the regulations behind this designation. */
  programmes: string[];
  /** ISO2 codes from citizenship (persons) or registered address (entities). */
  countries: string[];
  designationDate: string | null;
  /**
   * UN Consolidated List id where the EU implements a UN designation — the
   * cross-list linkage that lets one designation be recognised on two lists
   * rather than counted as two unrelated facts.
   */
  unitedNationId: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Read an attribute off the opening tag of a block. */
const readAttribute = (block: string, attribute: string): string | null => {
  const match = new RegExp(`${attribute}="([^"]*)"`).exec(block);
  if (!match) return null;
  const value = decodeXmlText(match[1]!).trim();
  return value.length > 0 ? value : null;
};

/**
 * `00` is the list's placeholder for an unknown country. It must not become a
 * bucket: a designation with unknown citizenship is unattributed, not a
 * designation belonging to a country called "00".
 */
const UNKNOWN_COUNTRY = '00';

const collectCountries = (block: string): string[] => {
  const codes = new Set<string>();
  // Persons carry <citizenship countryIso2Code>; entities carry <address
  // countryIso2Code>. Reading both keeps enterprises — a quarter of the list —
  // from silently dropping out of attribution.
  for (const match of block.matchAll(/<(?:citizenship|address)\b[^>]*countryIso2Code="([^"]*)"/g)) {
    const code = match[1]!.trim().toUpperCase();
    if (code.length === 2 && code !== UNKNOWN_COUNTRY && /^[A-Z]{2}$/.test(code)) codes.add(code);
  }
  return [...codes];
};

export interface ParsedEuList {
  generatedAt: string | null;
  listings: EuListing[];
}

export const parseEuSanctionsXml = (xml: string): ParsedEuList => {
  const generated = /generationDate="([^"]+)"/.exec(xml);
  const blocks = xml.match(/<sanctionEntity\b[\s\S]*?<\/sanctionEntity>/g) ?? [];
  const listings: EuListing[] = [];

  for (const block of blocks) {
    const logicalId = readAttribute(block, 'logicalId');
    if (!logicalId) continue;
    const subjectMatch = /<subjectType\b[^>]*code="([^"]*)"/.exec(block);
    const subject = subjectMatch?.[1] === 'enterprise' ? 'enterprise' : 'person';
    const designationDate = readAttribute(block, 'designationDate');
    const programmes = [
      ...new Set([...block.matchAll(/programme="([^"]*)"/g)].map((match) => match[1]!.trim()).filter(Boolean)),
    ];

    listings.push({
      logicalId,
      euReference: readAttribute(block, 'euReferenceNumber') ?? '',
      subjectType: subject,
      programmes,
      countries: collectCountries(block),
      designationDate: designationDate && ISO_DATE.test(designationDate) ? designationDate : null,
      unitedNationId: readAttribute(block, 'unitedNationId'),
    });
  }

  return { generatedAt: generated ? generated[1]! : null, listings };
};

export interface EuProgrammeSummary {
  programme: string;
  label: string;
  listingCount: number;
}

export interface EuCountrySummary {
  listingCount: number;
  personCount: number;
  enterpriseCount: number;
  programmes: EuProgrammeSummary[];
  newestDesignation: string | null;
}

export interface EuSanctionsArtifact {
  fetchedAt: string;
  /** The EU's own export stamp — the vintage of the list, not of our download. */
  generatedAt: string | null;
  sourceTitle: string;
  sourceUrl: string;
  listingTotal: number;
  personTotal: number;
  enterpriseTotal: number;
  /** Designations carrying no citizenship or registered address. */
  unattributedTotal: number;
  /** Designations the EU records as implementing a UN Security Council listing. */
  unLinkedTotal: number;
  perCountry: Record<string, EuCountrySummary>;
}

const programmeLabel = (code: string): string => EU_PROGRAMME_LABELS[code] ?? code;

export interface AggregatedEu {
  perCountry: Record<string, EuCountrySummary>;
  unattributedTotal: number;
}

/**
 * Group designations by the country of the designated party.
 *
 * A designation touching several countries counts once for each — a person
 * holding two citizenships is designated in both — but never more than once per
 * country, so multiple addresses in one state cannot inflate its total.
 */
export const aggregateEuByCountry = (listings: EuListing[]): AggregatedEu => {
  const byIso = new Map<
    string,
    { listings: number; persons: number; enterprises: number; programmes: Map<string, number>; newest: string | null }
  >();
  let unattributed = 0;

  for (const listing of listings) {
    if (listing.countries.length === 0) {
      unattributed++;
      continue;
    }
    for (const iso of listing.countries) {
      const entry = byIso.get(iso) ?? {
        listings: 0,
        persons: 0,
        enterprises: 0,
        programmes: new Map<string, number>(),
        newest: null,
      };
      entry.listings++;
      if (listing.subjectType === 'person') entry.persons++;
      else entry.enterprises++;
      for (const programme of listing.programmes) {
        entry.programmes.set(programme, (entry.programmes.get(programme) ?? 0) + 1);
      }
      if (listing.designationDate && (!entry.newest || listing.designationDate > entry.newest)) {
        entry.newest = listing.designationDate;
      }
      byIso.set(iso, entry);
    }
  }

  const perCountry: Record<string, EuCountrySummary> = {};
  for (const [iso, entry] of byIso) {
    perCountry[iso] = {
      listingCount: entry.listings,
      personCount: entry.persons,
      enterpriseCount: entry.enterprises,
      programmes: [...entry.programmes.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([programme, listingCount]) => ({
          programme,
          label: programmeLabel(programme),
          listingCount,
        })),
      newestDesignation: entry.newest,
    };
  }

  return { perCountry, unattributedTotal: unattributed };
};

export { readXmlField };
