/**
 * UN Security Council Consolidated List — the multilateral sanctions authority.
 *
 * The repository already carries OFAC SDN listings, but OFAC is a *United
 * States* legal instrument: a country appearing there is designated under US
 * law, which is a different claim from being under a UN sanctions regime
 * adopted by the Security Council. Presenting only OFAC invites the reader to
 * treat a US measure as a global one, so this module adds the UN list beside
 * it and keeps the two legal scopes labelled separately.
 *
 * Two boundaries are enforced by the shape of this data rather than by a
 * footnote:
 *
 *   1. Listings are aggregated by **sanctions regime**, and only regimes whose
 *      subject is a country are attributed to that country. A designation is
 *      evidence that the Council adopted measures concerning a situation — not
 *      a score, and not a statement about the population.
 *   2. Thematic regimes (Al-Qaida/ISIL) have no country subject and are
 *      reported as a global total only. Attributing them to countries by the
 *      nationality of designated individuals would manufacture a country
 *      ranking the Council never published.
 */

/** One listing on the Consolidated List. */
export interface UnscListing {
  dataId: string;
  /** `UN_LIST_TYPE` — the sanctions regime the listing belongs to. */
  regime: string;
  kind: 'individual' | 'entity';
  /** ISO date the Council added the listing, when published. */
  listedOn: string | null;
  /** Committee reference, e.g. `CDi.001`. Stable across list revisions. */
  referenceNumber: string;
}

/**
 * Regimes whose subject is a country, mapped to ISO alpha-2.
 *
 * `Taliban` is the 1988 Committee regime concerning Afghanistan, so it is
 * attributed there; `GB` is the Guinea-Bissau committee, not Great Britain —
 * an alias worth stating explicitly because the two-letter form reads wrong.
 * Regimes absent from this map are treated as thematic.
 */
export const UNSC_COUNTRY_REGIMES: Record<string, { iso: string; label: string }> = {
  CAR: { iso: 'CF', label: 'Central African Republic (2127)' },
  DPRK: { iso: 'KP', label: "Democratic People's Republic of Korea (1718)" },
  DRC: { iso: 'CD', label: 'Democratic Republic of the Congo (1533)' },
  GB: { iso: 'GW', label: 'Guinea-Bissau (2048)' },
  Haiti: { iso: 'HT', label: 'Haiti (2653)' },
  Iran: { iso: 'IR', label: 'Iran (2231)' },
  Iraq: { iso: 'IQ', label: 'Iraq (1518)' },
  Libya: { iso: 'LY', label: 'Libya (1970)' },
  Somalia: { iso: 'SO', label: 'Somalia (751)' },
  SouthSudan: { iso: 'SS', label: 'South Sudan (2206)' },
  Sudan: { iso: 'SD', label: 'Sudan (1591)' },
  Taliban: { iso: 'AF', label: 'Afghanistan / Taliban (1988)' },
  Yemen: { iso: 'YE', label: 'Yemen (2140)' },
};

/** Per-regime detail for one country. */
export interface UnscRegimeSummary {
  regime: string;
  label: string;
  listingCount: number;
  individualCount: number;
  entityCount: number;
  /** Most recent designation date in this regime, or null when unpublished. */
  newestListedOn: string | null;
}

export interface UnscCountrySummary {
  listingCount: number;
  individualCount: number;
  entityCount: number;
  regimes: UnscRegimeSummary[];
  newestListedOn: string | null;
}

export interface UnscArtifact {
  fetchedAt: string;
  /** `dateGenerated` stamped by the UN on the XML itself — the list's own vintage. */
  generatedAt: string | null;
  sourceTitle: string;
  sourceUrl: string;
  listingTotal: number;
  individualTotal: number;
  entityTotal: number;
  /** Regimes with a country subject that mapped to at least one listing. */
  countryRegimeCount: number;
  /** Regimes with no country subject, reported globally rather than attributed. */
  thematicRegimes: Array<{ regime: string; listingCount: number }>;
  perCountry: Record<string, UnscCountrySummary>;
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** Decode the five predefined XML entities plus numeric character references. */
export const decodeXmlText = (value: string): string =>
  value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return XML_ENTITIES[body] ?? match;
  });

/**
 * Read the first child element of `block` with the given tag.
 *
 * The tag boundary is matched explicitly (`<TAG>` and `</TAG>`, never `<TAG_`)
 * so that `FIRST_NAME` inside an `INDIVIDUAL` is not confused with a nested
 * `INDIVIDUAL_ALIAS` field, and so a schema change that introduces a new
 * `TAG_SOMETHING` element cannot silently start feeding this reader.
 */
export const readXmlField = (block: string, tag: string): string | null => {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block);
  if (!match) return null;
  const value = decodeXmlText(match[1]!).trim();
  return value.length > 0 ? value : null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const readListings = (xml: string, tag: 'INDIVIDUAL' | 'ENTITY'): UnscListing[] => {
  const kind = tag === 'INDIVIDUAL' ? 'individual' : 'entity';
  const blocks = xml.match(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g')) ?? [];
  const listings: UnscListing[] = [];
  for (const block of blocks) {
    const regime = readXmlField(block, 'UN_LIST_TYPE');
    // A listing with no regime cannot be attributed to a situation, so it is
    // counted in the global total by the caller but never mapped to a country.
    const dataId = readXmlField(block, 'DATAID');
    if (!dataId) continue;
    const listedOn = readXmlField(block, 'LISTED_ON');
    listings.push({
      dataId,
      regime: regime ?? '',
      kind,
      listedOn: listedOn && ISO_DATE.test(listedOn) ? listedOn : null,
      referenceNumber: readXmlField(block, 'REFERENCE_NUMBER') ?? '',
    });
  }
  return listings;
};

export interface ParsedUnscList {
  generatedAt: string | null;
  listings: UnscListing[];
}

/** Parse the published `consolidated.xml` into flat listings. */
export const parseUnscConsolidatedXml = (xml: string): ParsedUnscList => {
  const generated = /dateGenerated="([^"]+)"/.exec(xml);
  return {
    generatedAt: generated ? generated[1]! : null,
    listings: [...readListings(xml, 'INDIVIDUAL'), ...readListings(xml, 'ENTITY')],
  };
};

const newer = (left: string | null, right: string | null): string | null => {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
};

export interface AggregatedUnsc {
  perCountry: Record<string, UnscCountrySummary>;
  thematicRegimes: Array<{ regime: string; listingCount: number }>;
  countryRegimeCount: number;
}

/**
 * Group listings by the country each regime concerns.
 *
 * Regimes without a country subject are returned separately rather than
 * dropped: a reader who sees 1,011 listings globally and 428 attributed to
 * countries should be able to see where the difference went.
 */
export const aggregateUnscByCountry = (listings: UnscListing[]): AggregatedUnsc => {
  const byIso = new Map<string, Map<string, UnscRegimeSummary>>();
  const thematic = new Map<string, number>();

  for (const listing of listings) {
    const target = UNSC_COUNTRY_REGIMES[listing.regime];
    if (!target) {
      if (listing.regime) thematic.set(listing.regime, (thematic.get(listing.regime) ?? 0) + 1);
      continue;
    }
    const regimes = byIso.get(target.iso) ?? new Map<string, UnscRegimeSummary>();
    const summary = regimes.get(listing.regime) ?? {
      regime: listing.regime,
      label: target.label,
      listingCount: 0,
      individualCount: 0,
      entityCount: 0,
      newestListedOn: null,
    };
    summary.listingCount++;
    if (listing.kind === 'individual') summary.individualCount++;
    else summary.entityCount++;
    summary.newestListedOn = newer(summary.newestListedOn, listing.listedOn);
    regimes.set(listing.regime, summary);
    byIso.set(target.iso, regimes);
  }

  const perCountry: Record<string, UnscCountrySummary> = {};
  for (const [iso, regimes] of byIso) {
    const rows = [...regimes.values()].sort((left, right) => right.listingCount - left.listingCount);
    perCountry[iso] = {
      listingCount: rows.reduce((sum, row) => sum + row.listingCount, 0),
      individualCount: rows.reduce((sum, row) => sum + row.individualCount, 0),
      entityCount: rows.reduce((sum, row) => sum + row.entityCount, 0),
      regimes: rows,
      newestListedOn: rows.reduce<string | null>((latest, row) => newer(latest, row.newestListedOn), null),
    };
  }

  return {
    perCountry,
    thematicRegimes: [...thematic.entries()]
      .map(([regime, listingCount]) => ({ regime, listingCount }))
      .sort((left, right) => right.listingCount - left.listingCount),
    countryRegimeCount: new Set(
      listings.filter((listing) => UNSC_COUNTRY_REGIMES[listing.regime]).map((listing) => listing.regime),
    ).size,
  };
};
