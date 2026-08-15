/**
 * Cross-list sanctions view — which authorities have designated actors
 * connected to a country, and on what legal basis.
 *
 * Three sanctions artifacts now sit in the dataset (UN Security Council, US
 * OFAC, EU) and a reader faced with three separate cards has to work out for
 * themselves whether "121 UN listings" and "2,707 US listings" measure the same
 * thing. They do not. Each list attributes designations differently:
 *
 *   - **UN** by *regime* — the situation the Council adopted measures over.
 *   - **US** by *programme* — the OFAC programme naming the target.
 *   - **EU** by *identity* — the citizenship or registered address of the
 *     designated party.
 *
 * So this module deliberately does **not** produce a combined listing count.
 * Summing across lists would double-count the 87 EU designations that
 * implement UN listings, and would add numbers whose denominators differ. What
 * it produces instead is the fact that survives the differences: *how many
 * distinct authorities* have designated actors connected to this country, each
 * with its own count and its own stated basis.
 *
 * That is a legal-evidence view, not a risk score. A country listed by three
 * authorities is not "three times sanctioned", and nothing here feeds the
 * curated `sanctionsExposure` indicator.
 */

export type SanctionsAuthorityId = 'un-security-council' | 'us-ofac' | 'eu';

/** How a given authority's listings were attributed to this country. */
export type SanctionsAttributionBasis = 'regime' | 'programme' | 'identity';

export const ATTRIBUTION_BASIS_LABEL: Record<SanctionsAttributionBasis, string> = {
  regime: 'listings under sanctions regimes concerning this country',
  programme: 'listings under programmes naming this country',
  identity: 'designated persons holding this citizenship and entities registered here',
};

export interface SanctionsAuthorityEntry {
  authority: SanctionsAuthorityId;
  /** Short label for the authority, e.g. "UN Security Council". */
  label: string;
  /** Jurisdictional reach of the measures. */
  scope: string;
  listingCount: number;
  basis: SanctionsAttributionBasis;
  /** Most recent designation date this authority recorded, when published. */
  newestDesignation: string | null;
}

export interface SanctionsAuthoritySummary {
  entries: SanctionsAuthorityEntry[];
  /** How many distinct authorities list actors connected to this country. */
  authorityCount: number;
  /** True when a multilateral (UN) authority is among them. */
  hasMultilateral: boolean;
}

/** Minimal shapes read from the three artifacts — kept structural for testability. */
interface UnscCountryLike {
  listingCount: number;
  newestListedOn: string | null;
}
interface OfacCountryLike {
  entryCount: number;
}
interface EuCountryLike {
  listingCount: number;
  newestDesignation: string | null;
}

export interface SanctionsAuthorityInput {
  unsc?: UnscCountryLike;
  ofac?: OfacCountryLike;
  eu?: EuCountryLike;
}

const AUTHORITY_META: Record<
  SanctionsAuthorityId,
  { label: string; scope: string; basis: SanctionsAttributionBasis }
> = {
  'un-security-council': {
    label: 'UN Security Council',
    scope: 'Multilateral — binding on all UN member states',
    basis: 'regime',
  },
  'us-ofac': {
    label: 'US Treasury (OFAC)',
    scope: 'United States legal scope',
    basis: 'programme',
  },
  eu: {
    label: 'European Union',
    scope: 'EU legal scope — financial measures only',
    basis: 'identity',
  },
};

/**
 * Build the authority view for one country.
 *
 * Authorities are ordered by breadth of legal reach — multilateral first, then
 * the two unilateral regimes — rather than by listing count. Sorting by count
 * would rank a large US programme above a binding UN regime, which inverts the
 * legal weight the ordering is meant to convey.
 */
export const summarizeSanctionsAuthorities = (
  input: SanctionsAuthorityInput,
): SanctionsAuthoritySummary | null => {
  const entries: SanctionsAuthorityEntry[] = [];

  const push = (
    authority: SanctionsAuthorityId,
    listingCount: number,
    newestDesignation: string | null,
  ) => {
    if (listingCount <= 0) return;
    const meta = AUTHORITY_META[authority];
    entries.push({
      authority,
      label: meta.label,
      scope: meta.scope,
      basis: meta.basis,
      listingCount,
      newestDesignation,
    });
  };

  push('un-security-council', input.unsc?.listingCount ?? 0, input.unsc?.newestListedOn ?? null);
  push('us-ofac', input.ofac?.entryCount ?? 0, null);
  push('eu', input.eu?.listingCount ?? 0, input.eu?.newestDesignation ?? null);

  if (entries.length === 0) return null;

  return {
    entries,
    authorityCount: entries.length,
    hasMultilateral: entries.some((entry) => entry.authority === 'un-security-council'),
  };
};
