/**
 * Source registry — the single place that describes *who* produced a number,
 * *how authoritative* they are, and *how quickly* they publish.
 *
 * The pipeline already ranks observations per indicator (see
 * `pipeline/rules.ts`). That ranking answers "which source wins for trade
 * exposure?"; this registry answers the orthogonal question the UI needs:
 * "how much should a reader trust the number in front of them, and how old is
 * it?". Keeping the two separate means indicator-specific preferences stay
 * local to the rules file while provenance copy stays consistent everywhere.
 */

export type SourceAuthorityTier =
  /** The institution that compiles the statistic from member-state returns. */
  | 'primary-official'
  /** An official body republishing / harmonising other institutions' primaries. */
  | 'official-aggregator'
  /** Peer-reviewed academic or specialist research institutes. */
  | 'research-institute'
  /** In-repo expert curation. Traceable, but not an external observation. */
  | 'curated-estimate';

export type SourceCadence = 'continuous' | 'monthly' | 'quarterly' | 'biannual' | 'annual';

/** How this app actually obtains the series. */
export type SourceAccess =
  /** Fetched from the browser at runtime (CORS-enabled, no key). */
  | 'live-api'
  /** Fetched by `npm run ingest` and committed as a snapshot (no CORS / key needed). */
  | 'build-ingest'
  /** Hand-curated in `src/data/datasets`. */
  | 'curated';

export interface SourceDescriptor {
  id: string;
  title: string;
  publisher: string;
  url: string;
  authorityTier: SourceAuthorityTier;
  cadence: SourceCadence;
  /** Typical lag in months between the reference period and publication. */
  typicalLagMonths: number;
  access: SourceAccess;
  /** Short reader-facing note on what the source is good for and its limits. */
  note?: string;
}

/**
 * Lower rank = more authoritative. Used as a tie-breaker in reconciliation when
 * two observations are otherwise equally preferred, and to sort provenance lists.
 */
export const AUTHORITY_RANK: Record<SourceAuthorityTier, number> = {
  'primary-official': 0,
  'official-aggregator': 1,
  'research-institute': 2,
  'curated-estimate': 3,
};

export const AUTHORITY_LABEL: Record<SourceAuthorityTier, string> = {
  'primary-official': 'Official statistics',
  'official-aggregator': 'Official aggregator',
  'research-institute': 'Research institute',
  'curated-estimate': 'Curated estimate',
};

export const SOURCE_REGISTRY: Record<string, SourceDescriptor> = {
  'imf-weo': {
    id: 'imf-weo',
    title: 'World Economic Outlook',
    publisher: 'International Monetary Fund',
    url: 'https://www.imf.org/en/Publications/WEO',
    authorityTier: 'primary-official',
    cadence: 'biannual',
    typicalLagMonths: 0,
    access: 'build-ingest',
    note:
      'Published every April and October. Carries current-year estimates and forward projections, ' +
      'so it is materially fresher than annual outturn series — at the cost of the newest years ' +
      'being IMF staff estimates rather than reported outturns.',
  },
  'world-bank-wdi': {
    id: 'world-bank-wdi',
    title: 'World Development Indicators',
    publisher: 'World Bank',
    url: 'https://databank.worldbank.org/source/world-development-indicators',
    authorityTier: 'official-aggregator',
    cadence: 'quarterly',
    typicalLagMonths: 12,
    access: 'live-api',
    note:
      'Harmonised compilation of national-accounts and agency returns. Reported outturns rather ' +
      'than estimates, but typically lags the reference year by 1–2 years.',
  },
  'world-bank-wgi': {
    id: 'world-bank-wgi',
    title: 'Worldwide Governance Indicators',
    publisher: 'World Bank',
    url: 'https://www.worldbank.org/en/publication/worldwide-governance-indicators',
    authorityTier: 'official-aggregator',
    cadence: 'annual',
    typicalLagMonths: 15,
    access: 'live-api',
    note: 'Composite governance percentile estimates aggregated from ~30 underlying data providers.',
  },
  'un-desa-population': {
    id: 'un-desa-population',
    title: 'World Population Prospects',
    publisher: 'UN DESA Population Division',
    url: 'https://population.un.org/wpp/',
    authorityTier: 'primary-official',
    cadence: 'biannual',
    typicalLagMonths: 6,
    access: 'curated',
  },
  'sipri-milex': {
    id: 'sipri-milex',
    title: 'Military Expenditure Database',
    publisher: 'SIPRI',
    url: 'https://www.sipri.org/databases/milex',
    authorityTier: 'research-institute',
    cadence: 'annual',
    typicalLagMonths: 4,
    access: 'curated',
    note: 'The reference series for defence spending; published each April for the prior year.',
  },
  'iiss-military-balance': {
    id: 'iiss-military-balance',
    title: 'The Military Balance',
    publisher: 'IISS',
    url: 'https://www.iiss.org/publications/the-military-balance',
    authorityTier: 'research-institute',
    cadence: 'annual',
    typicalLagMonths: 2,
    access: 'curated',
  },
  ucdp: {
    id: 'ucdp',
    title: 'UCDP Georeferenced Event Dataset',
    publisher: 'Uppsala Conflict Data Program',
    url: 'https://ucdp.uu.se/downloads/',
    authorityTier: 'research-institute',
    cadence: 'annual',
    typicalLagMonths: 6,
    access: 'curated',
    note: 'The academic standard for battle-related deaths. The live API now requires an access token.',
  },
  acled: {
    id: 'acled',
    title: 'Armed Conflict Location & Event Data',
    publisher: 'ACLED',
    url: 'https://acleddata.com/',
    authorityTier: 'research-institute',
    cadence: 'continuous',
    typicalLagMonths: 0,
    access: 'curated',
    note: 'Weekly-updated event coding. Requires a registered API key, so values here are curated.',
  },
  'icg-crisiswatch': {
    id: 'icg-crisiswatch',
    title: 'CrisisWatch',
    publisher: 'International Crisis Group',
    url: 'https://www.crisisgroup.org/crisiswatch',
    authorityTier: 'research-institute',
    cadence: 'monthly',
    typicalLagMonths: 0,
    access: 'curated',
  },
  vdem: {
    id: 'vdem',
    title: 'Varieties of Democracy',
    publisher: 'V-Dem Institute',
    url: 'https://www.v-dem.net/data/the-v-dem-dataset/',
    authorityTier: 'research-institute',
    cadence: 'annual',
    typicalLagMonths: 3,
    access: 'curated',
  },
  'freedom-house': {
    id: 'freedom-house',
    title: 'Freedom in the World',
    publisher: 'Freedom House',
    url: 'https://freedomhouse.org/report/freedom-world',
    authorityTier: 'research-institute',
    cadence: 'annual',
    typicalLagMonths: 2,
    access: 'curated',
  },
  'transparency-intl': {
    id: 'transparency-intl',
    title: 'Corruption Perceptions Index',
    publisher: 'Transparency International',
    url: 'https://www.transparency.org/en/cpi',
    authorityTier: 'research-institute',
    cadence: 'annual',
    typicalLagMonths: 2,
    access: 'curated',
  },
  'un-comtrade': {
    id: 'un-comtrade',
    title: 'UN Comtrade Database',
    publisher: 'United Nations Statistics Division',
    url: 'https://comtradeplus.un.org/',
    authorityTier: 'primary-official',
    cadence: 'monthly',
    typicalLagMonths: 6,
    access: 'curated',
    note: 'Authoritative bilateral trade flows. Bulk access requires a subscription key.',
  },
  'imf-direction-of-trade': {
    id: 'imf-direction-of-trade',
    title: 'Direction of Trade Statistics',
    publisher: 'International Monetary Fund',
    url: 'https://data.imf.org/',
    authorityTier: 'primary-official',
    cadence: 'monthly',
    typicalLagMonths: 3,
    access: 'curated',
  },
  'wto-profile': {
    id: 'wto-profile',
    title: 'Trade Profiles',
    publisher: 'World Trade Organization',
    url: 'https://www.wto.org/english/res_e/statis_e/daily_update_e/trade_profiles_e.htm',
    authorityTier: 'official-aggregator',
    cadence: 'annual',
    typicalLagMonths: 9,
    access: 'curated',
  },
  'csis-sanctions': {
    id: 'csis-sanctions',
    title: 'Global Sanctions Database',
    publisher: 'CSIS',
    url: 'https://www.csis.org/programs/economics-program/sanctions',
    authorityTier: 'research-institute',
    cadence: 'quarterly',
    typicalLagMonths: 3,
    access: 'curated',
  },
  'iea-weo': {
    id: 'iea-weo',
    title: 'World Energy Outlook',
    publisher: 'International Energy Agency',
    url: 'https://www.iea.org/reports/world-energy-outlook-2024',
    authorityTier: 'primary-official',
    cadence: 'annual',
    typicalLagMonths: 2,
    access: 'curated',
  },
  'us-eia': {
    id: 'us-eia',
    title: 'International Energy Statistics',
    publisher: 'U.S. Energy Information Administration',
    url: 'https://www.eia.gov/international/data/world',
    authorityTier: 'primary-official',
    cadence: 'monthly',
    typicalLagMonths: 3,
    access: 'curated',
  },
  'usgs-minerals': {
    id: 'usgs-minerals',
    title: 'Mineral Commodity Summaries',
    publisher: 'U.S. Geological Survey',
    url: 'https://www.usgs.gov/centers/national-minerals-information-center',
    authorityTier: 'primary-official',
    cadence: 'annual',
    typicalLagMonths: 1,
    access: 'curated',
  },
  'world-factbook': {
    id: 'world-factbook',
    title: 'The World Factbook',
    publisher: 'U.S. Central Intelligence Agency',
    url: 'https://www.cia.gov/the-world-factbook/',
    authorityTier: 'official-aggregator',
    cadence: 'continuous',
    typicalLagMonths: 12,
    access: 'curated',
  },
  'brand-finance-soft-power': {
    id: 'brand-finance-soft-power',
    title: 'Global Soft Power Index',
    publisher: 'Brand Finance',
    url: 'https://brandfinance.com/insights/global-soft-power-index',
    authorityTier: 'research-institute',
    cadence: 'annual',
    typicalLagMonths: 2,
    access: 'curated',
  },
};

const UNKNOWN_SOURCE: Omit<SourceDescriptor, 'id'> = {
  title: 'Unregistered source',
  publisher: 'Unknown',
  url: '',
  authorityTier: 'curated-estimate',
  cadence: 'annual',
  typicalLagMonths: 12,
  access: 'curated',
};

export const describeSource = (sourceId: string): SourceDescriptor =>
  SOURCE_REGISTRY[sourceId] ?? { id: sourceId, ...UNKNOWN_SOURCE };

export const sourceAuthorityRank = (sourceId: string): number =>
  AUTHORITY_RANK[describeSource(sourceId).authorityTier];

/** Reader-facing one-liner: "IMF · World Economic Outlook · Official statistics". */
export const formatSourceCredit = (sourceId: string): string => {
  const source = describeSource(sourceId);
  return `${source.publisher} · ${source.title}`;
};
