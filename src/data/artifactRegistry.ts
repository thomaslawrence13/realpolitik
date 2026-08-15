/**
 * Operational artifact register — the committed data files the app actually
 * reads at runtime, as opposed to the *descriptor* registry in
 * `sourceRegistry.ts`.
 *
 * The two answer different questions and must not be conflated:
 *
 *   - `SOURCE_REGISTRY` describes **who publishes a series** and how
 *     authoritative it is. It carries no notion of whether this repository has
 *     ever fetched that publisher.
 *   - This register describes **what has actually been retrieved and
 *     committed**: the file, when it was fetched, how old that makes it against
 *     its refresh budget, how much it covers, and the boundary of what the
 *     artifact does — and does not — evidence.
 *
 * Registry counts have historically been misread as an ingestion inventory
 * ("21 sources" reads as "21 feeds"). Keeping the artifact inventory separate,
 * and driving the runtime freshness gate, the CI freshness check and the
 * release view from this one module, means the artifact age a reader sees is
 * the same number the gate enforces.
 */

import unVotesArtifact from './datasets/un_ga_votes.json';
import ofacRegistryArtifact from './datasets/ofac_sanctions_registry.json';
import unscRegistryArtifact from './datasets/unsc_sanctions_registry.json';
import euRegistryArtifact from './datasets/eu_sanctions_registry.json';
import ucdpConflictArtifact from './datasets/ucdp_conflict.json';
import unhcrDisplacementArtifact from './datasets/unhcr_displacement.json';
import faoFoodSecurityMetaJson from './datasets/fao_food_security_meta.json';
import bisFinancialArtifact from './datasets/bis_financial.json';
import historicalSeriesMetaJson from './datasets/historical_series_meta.json';
import type { UnVotesArtifact } from '../lib/unVotes';
import type { OfacSummary } from '../lib/ofacSdn';
import type { UnscArtifact } from '../lib/unscSanctions';
import type { EuSanctionsArtifact } from '../lib/euSanctions';
import type { UcdpArtifact } from '../lib/ucdp';
import type { UnhcrArtifact } from '../lib/unhcrDisplacement';
import type { FaoFoodSecurityMeta } from '../lib/faoFoodSecurity';
import type { BisArtifact } from '../lib/bisFinancial';
import type { HistoricalSeriesMeta } from '../lib/historicalSeriesArtifact';

export type ArtifactId =
  | 'unga-votes'
  | 'ofac-sdn'
  | 'unsc-consolidated'
  | 'eu-financial-sanctions'
  | 'ucdp-organized-violence'
  | 'unhcr-displacement'
  | 'fao-food-security'
  | 'bis-financial'
  | 'world-bank-history';

/**
 * `fresh` — inside budget. `aging` — past the warning tip, still served.
 * `stale` — past budget: the overlay is withheld at runtime and CI fails.
 */
export type ArtifactStatus = 'fresh' | 'aging' | 'stale';

/** How the artifact reaches the browser. */
export type ArtifactRoute = 'build-artifact';

export interface ArtifactDescriptor {
  id: ArtifactId;
  title: string;
  publisher: string;
  /** Repository path of the committed artifact. */
  path: string;
  /**
   * Registry descriptor credited when this artifact reaches a model
   * observation, or `null` when the artifact is registry evidence only. UNGA
   * and OFAC deliberately have no descriptor: they populate reader-facing
   * registries, not indicator provenance, and minting descriptors for them
   * would inflate the source count without adding a wired feed.
   */
  sourceId: string | null;
  route: ArtifactRoute;
  /** What the artifact is evidence for. */
  role: string;
  /** What it is *not* evidence for — kept next to the number, not in a footnote. */
  boundary: string;
  /** Command an operator runs when the artifact ages out. */
  refreshCommand: string;
  /** Past this age the artifact is stale: withheld at runtime, fails CI. */
  budgetDays: number;
  /** Warning tip — surfaced well before the budget so refreshes are scheduled, not scrambled. */
  warnAfterDays: number;
}

export interface ArtifactStatusRow extends ArtifactDescriptor {
  /** ISO timestamp recorded by the refresh script that wrote the artifact. */
  fetchedAt: string;
  /** Date portion of `fetchedAt`, for display. */
  retrievedOn: string;
  ageDays: number;
  status: ArtifactStatus;
  /** True while the artifact is inside budget (i.e. runtime still applies it). */
  withinBudget: boolean;
  /** Reader-facing coverage line: how much this artifact actually contains. */
  coverage: string;
  /** Publisher-side version or observation window, where the artifact carries one. */
  vintage: string | null;
  /** Number of country entries carried by the artifact (0 for non-country artifacts). */
  countryCount: number;
}

const DAY_MS = 86_400_000;

const unVotes = unVotesArtifact as UnVotesArtifact;
const ofacRegistry = ofacRegistryArtifact as OfacSummary;
const unscRegistry = unscRegistryArtifact as UnscArtifact;
const euRegistry = euRegistryArtifact as EuSanctionsArtifact;
const ucdpConflict = ucdpConflictArtifact as UcdpArtifact;
const unhcrDisplacement = unhcrDisplacementArtifact as UnhcrArtifact;
/**
 * Read through the sidecar, not the payload: the ~115 KB of per-country values
 * is code-split behind `data/foodSecurity.ts` and must not be pulled into the
 * eager bundle just to date the artifact. `validateDataset` checks the sidecar
 * against the full artifact.
 */
const faoFoodSecurity = faoFoodSecurityMetaJson as unknown as FaoFoodSecurityMeta;
const bisFinancial = bisFinancialArtifact as unknown as BisArtifact;
/**
 * The history payload itself is code-split and loads only when a reader opens
 * a chart, so the register reads its committed sidecar summary instead —
 * dating the artifact must not drag ~677 KB into the eager bundle.
 * `validateDataset` checks the sidecar against the full artifact.
 */
const historicalSeries = historicalSeriesMetaJson as unknown as HistoricalSeriesMeta;

/**
 * Typed payloads, re-exported so consumers read the artifacts through the
 * register that dates them rather than re-importing and re-casting the JSON.
 */
export const artifactPayloads = {
  'unga-votes': unVotes,
  'ofac-sdn': ofacRegistry,
  'unsc-consolidated': unscRegistry,
  'eu-financial-sanctions': euRegistry,
  'ucdp-organized-violence': ucdpConflict,
  'unhcr-displacement': unhcrDisplacement,
  'fao-food-security': faoFoodSecurity,
  'bis-financial': bisFinancial,
  'world-bank-history': historicalSeries,
} as const;

export const ARTIFACT_REGISTER: Record<ArtifactId, ArtifactDescriptor> = {
  'unga-votes': {
    id: 'unga-votes',
    title: 'UN General Assembly recorded votes',
    publisher: 'UN Dag Hammarskjöld Library',
    path: 'src/data/datasets/un_ga_votes.json',
    sourceId: null,
    route: 'build-artifact',
    role: 'Measured roll-call agreement with the two bloc anchors.',
    boundary: 'General Assembly only; anchors excluded. Agreement is not a foreign-policy score.',
    refreshCommand: 'npm run refresh:unvotes',
    budgetDays: 420,
    warnAfterDays: 300,
  },
  'ofac-sdn': {
    id: 'ofac-sdn',
    title: 'OFAC Specially Designated Nationals list',
    publisher: 'U.S. Department of the Treasury',
    path: 'src/data/datasets/ofac_sanctions_registry.json',
    sourceId: null,
    route: 'build-artifact',
    role: 'Country-level listing counts and top programmes from the published SDN list.',
    boundary:
      'US legal scope, aggregated to country. Not a global sanctions authority, not a country-risk score, ' +
      'and not a legal-entity register — the sanctionsExposure indicator remains curated.',
    refreshCommand: 'npm run refresh:ofac',
    budgetDays: 120,
    warnAfterDays: 60,
  },
  'unsc-consolidated': {
    id: 'unsc-consolidated',
    title: 'UN Security Council Consolidated List',
    publisher: 'United Nations Security Council',
    path: 'src/data/datasets/unsc_sanctions_registry.json',
    // Deliberately no descriptor, for the same reason as OFAC: this populates a
    // reader-facing registry, not indicator provenance. `sanctionsExposure`
    // stays curated, and minting a descriptor here would inflate the source
    // count with a feed the model does not consume.
    sourceId: null,
    route: 'build-artifact',
    role: 'Listings under each country-directed UN sanctions regime, from the published Consolidated List.',
    boundary:
      'Multilateral legal listings aggregated by regime — not a country-risk score, not a measure of a ' +
      'population, and not the full text of the measures. Thematic regimes (Al-Qaida/ISIL) have no country ' +
      'subject and are held out of country attribution. The sanctionsExposure indicator remains curated.',
    refreshCommand: 'npm run refresh:unsc',
    // The Council amends the list continuously and regenerates the XML daily,
    // so a listing set months old is genuinely out of date as legal evidence.
    budgetDays: 120,
    warnAfterDays: 60,
  },
  'eu-financial-sanctions': {
    id: 'eu-financial-sanctions',
    title: 'EU Consolidated Financial Sanctions List',
    publisher: 'European Commission / DG FISMA',
    path: 'src/data/datasets/eu_sanctions_registry.json',
    sourceId: null,
    route: 'build-artifact',
    role: 'Designated persons by citizenship and entities by registered address, with their programme mix.',
    boundary:
      'Attributed by the identity of the designated party, not by programme — EU programmes are named for ' +
      'the situation including its victim, so programme attribution would credit Ukraine with measures ' +
      'taken over Russian actions. The financial list is narrower than all EU restrictive measures, and ' +
      'this is not a country-risk score; sanctionsExposure remains curated.',
    refreshCommand: 'npm run refresh:eu-sanctions',
    // The Council amends the list as measures change and republishes the export
    // continuously, so stale legal evidence goes wrong quickly.
    budgetDays: 120,
    warnAfterDays: 60,
  },
  'ucdp-organized-violence': {
    id: 'ucdp-organized-violence',
    title: 'UCDP organized violence, country-year',
    publisher: 'Uppsala Conflict Data Program',
    path: 'src/data/datasets/ucdp_conflict.json',
    sourceId: 'ucdp',
    route: 'build-artifact',
    role: 'Finalized annual battle-death totals feeding conflict history.',
    boundary:
      'Finalized annual country-year release, not a near-real-time event feed. Current conflict pressure ' +
      'stays curated until a candidate-event adapter is wired.',
    refreshCommand: 'npm run refresh:ucdp',
    // UCDP publishes the OV-CY yearly around mid-year; ~14 months is the true
    // staleness point, with the warning tip a full quarter earlier.
    budgetDays: 440,
    warnAfterDays: 240,
  },
  'unhcr-displacement': {
    id: 'unhcr-displacement',
    title: 'UNHCR displacement populations',
    publisher: 'UNHCR',
    path: 'src/data/datasets/unhcr_displacement.json',
    sourceId: null,
    route: 'build-artifact',
    role: 'Refugees by origin and by country of asylum, internally displaced and stateless populations.',
    boundary:
      'UNHCR mandate only — Palestine refugees under UNRWA are excluded, and IDP counts exist only where ' +
      'UNHCR monitors. A country absent from this artifact is unreported, not displacement-free. Origin and ' +
      'asylum figures are separate facts and are never summed.',
    refreshCommand: 'npm run refresh:displacement',
    // UNHCR publishes a completed year mid-way through the following one, so a
    // year-plus budget matches the real release cadence rather than inviting a
    // refresh that cannot return anything newer.
    budgetDays: 400,
    warnAfterDays: 270,
  },
  'fao-food-security': {
    id: 'fao-food-security',
    title: 'FAOSTAT food security indicators',
    publisher: 'Food and Agriculture Organization',
    path: 'src/data/datasets/fao_food_security.json',
    sourceId: null,
    route: 'build-artifact',
    role: 'Undernourishment, food insecurity, dietary energy adequacy, drinking water and sanitation.',
    boundary:
      'Most prevalences are published as three-year averages, and the period label travels with each ' +
      'value rather than being collapsed to a single year. Values carry FAO’s official / estimated / ' +
      'imputed status; an imputed prevalence is a model output, not a measurement. This is observed ' +
      'evidence beside the curated food and water profile, not a replacement for it.',
    refreshCommand: 'npm run refresh:fao',
    // FAO releases the suite annually, usually in July alongside SOFI.
    budgetDays: 400,
    warnAfterDays: 270,
  },
  'bis-financial': {
    id: 'bis-financial',
    title: 'BIS financial vulnerability indicators',
    publisher: 'Bank for International Settlements',
    path: 'src/data/datasets/bis_financial.json',
    sourceId: null,
    route: 'build-artifact',
    role: 'Credit-to-GDP gap and ratio, debt service ratios and central bank policy rates.',
    boundary:
      'BIS reports these for around 45 mostly advanced and large emerging economies — a country absent ' +
      'here is unreported, not financially sound. The credit-to-GDP gap is a deviation from an HP-filter ' +
      'trend that is re-estimated each release, so historical values revise; it is the Basel III buffer ' +
      'guide, not a crisis forecast.',
    refreshCommand: 'npm run refresh:bis',
    // BIS publishes credit statistics quarterly, roughly a quarter in arrears.
    budgetDays: 180,
    warnAfterDays: 100,
  },
  'world-bank-history': {
    id: 'world-bank-history',
    title: 'World Bank indicator history',
    publisher: 'World Bank',
    path: 'src/data/datasets/historical_indicator_series.json',
    sourceId: 'world-bank-wdi',
    route: 'build-artifact',
    role: 'Committed multi-year WDI series behind the historical charts.',
    boundary: 'Build output rebuilt by the scheduled refresh; the live WDI path is fetched separately.',
    refreshCommand: 'npm run history:build',
    budgetDays: 120,
    warnAfterDays: 45,
  },
};

export const ARTIFACT_IDS = Object.keys(ARTIFACT_REGISTER) as ArtifactId[];

const artifactFacts: Record<
  ArtifactId,
  { fetchedAt: string; coverage: string; vintage: string | null; countryCount: number }
> = {
  'unga-votes': {
    fetchedAt: unVotes.fetchedAt,
    coverage: `${Object.keys(unVotes.perCountry).length} countries · ${unVotes.sessions.length} sessions`,
    vintage:
      unVotes.sessions.length > 0
        ? `${unVotes.sessions[0]}–${unVotes.sessions[unVotes.sessions.length - 1]}`
        : null,
    countryCount: Object.keys(unVotes.perCountry).length,
  },
  'ofac-sdn': {
    fetchedAt: ofacRegistry.fetchedAt,
    coverage: `${ofacRegistry.entryTotal.toLocaleString('en-US')} listings · ${
      Object.keys(ofacRegistry.perCountry).length
    } mapped countries`,
    vintage: null,
    countryCount: Object.keys(ofacRegistry.perCountry).length,
  },
  'unsc-consolidated': {
    fetchedAt: unscRegistry.fetchedAt,
    coverage: `${unscRegistry.listingTotal.toLocaleString('en-US')} listings · ${
      unscRegistry.countryRegimeCount
    } country regimes · ${Object.keys(unscRegistry.perCountry).length} mapped countries`,
    // The UN's own generation stamp, not our retrieval time: it is the vintage
    // of the law, and it can be older than the download.
    vintage: unscRegistry.generatedAt ? `list generated ${unscRegistry.generatedAt.slice(0, 10)}` : null,
    countryCount: Object.keys(unscRegistry.perCountry).length,
  },
  'eu-financial-sanctions': {
    fetchedAt: euRegistry.fetchedAt,
    coverage: `${euRegistry.listingTotal.toLocaleString('en-US')} designations · ${
      Object.keys(euRegistry.perCountry).length
    } attributed countries · ${euRegistry.unattributedTotal.toLocaleString('en-US')} unattributed`,
    vintage: euRegistry.generatedAt ? `list generated ${euRegistry.generatedAt.slice(0, 10)}` : null,
    countryCount: Object.keys(euRegistry.perCountry).length,
  },
  'ucdp-organized-violence': {
    fetchedAt: ucdpConflict.fetchedAt,
    coverage: `${Object.keys(ucdpConflict.perCountry).length} countries · ${
      ucdpConflict.window.fromYear
    }–${ucdpConflict.window.throughYear}`,
    vintage: `v${ucdpConflict.version}`,
    countryCount: Object.keys(ucdpConflict.perCountry).length,
  },
  'unhcr-displacement': {
    fetchedAt: unhcrDisplacement.fetchedAt,
    coverage: `${Object.keys(unhcrDisplacement.perCountry).length} tracked countries · ${
      unhcrDisplacement.originCountryCount
    } origin / ${unhcrDisplacement.asylumCountryCount} asylum reporters`,
    vintage: `reference year ${unhcrDisplacement.referenceYear}`,
    countryCount: Object.keys(unhcrDisplacement.perCountry).length,
  },
  'fao-food-security': {
    fetchedAt: faoFoodSecurity.fetchedAt,
    coverage: `${faoFoodSecurity.indicators.length} indicators · ${faoFoodSecurity.countryCount} countries`,
    vintage: `newest period ends ${faoFoodSecurity.newestPeriodEndYear}`,
    countryCount: faoFoodSecurity.countryCount,
  },
  'bis-financial': {
    fetchedAt: bisFinancial.fetchedAt,
    coverage: `${bisFinancial.series.length} series · ${bisFinancial.countryCount} reporting countries`,
    vintage: null,
    countryCount: bisFinancial.countryCount,
  },
  'world-bank-history': {
    fetchedAt: historicalSeries.fetchedAt,
    coverage: `${historicalSeries.indicatorCodes.length} indicator series · ${
      historicalSeries.countryCount
    } countries · ${historicalSeries.observationCount.toLocaleString('en-US')} observations`,
    vintage: `schema ${historicalSeries.schema}`,
    countryCount: historicalSeries.countryCount,
  },
};

/** Whole days between `fetchedAt` and `now`; never negative, NaN-safe. */
export const artifactAgeDays = (fetchedAt: string, now: number = Date.now()): number => {
  const diff = now - Date.parse(fetchedAt);
  return Number.isFinite(diff) ? Math.max(0, Math.floor(diff / DAY_MS)) : Number.NaN;
};

export const artifactStatusFor = (
  descriptor: ArtifactDescriptor,
  ageDays: number,
): ArtifactStatus => {
  // An unparseable stamp is treated as stale: an artifact we cannot date is one
  // we cannot vouch for.
  if (!Number.isFinite(ageDays)) return 'stale';
  if (ageDays > descriptor.budgetDays) return 'stale';
  if (ageDays > descriptor.warnAfterDays) return 'aging';
  return 'fresh';
};

/** Status row for one artifact. `now` is injectable so tests are not clock-bound. */
export const describeArtifact = (id: ArtifactId, now: number = Date.now()): ArtifactStatusRow => {
  const descriptor = ARTIFACT_REGISTER[id];
  const facts = artifactFacts[id];
  const ageDays = artifactAgeDays(facts.fetchedAt, now);
  const status = artifactStatusFor(descriptor, ageDays);
  return {
    ...descriptor,
    fetchedAt: facts.fetchedAt,
    retrievedOn: facts.fetchedAt.slice(0, 10),
    ageDays,
    status,
    withinBudget: status !== 'stale',
    coverage: facts.coverage,
    vintage: facts.vintage,
    countryCount: facts.countryCount,
  };
};

/** All artifacts, most urgent first (stale → aging → fresh, then oldest first). */
export const describeArtifacts = (now: number = Date.now()): ArtifactStatusRow[] => {
  const urgency: Record<ArtifactStatus, number> = { stale: 0, aging: 1, fresh: 2 };
  return ARTIFACT_IDS.map((id) => describeArtifact(id, now)).sort((left, right) => {
    const urgencyDelta = urgency[left.status] - urgency[right.status];
    if (urgencyDelta !== 0) return urgencyDelta;
    const ageDelta = (right.ageDays || 0) - (left.ageDays || 0);
    if (ageDelta !== 0) return ageDelta;
    return left.title.localeCompare(right.title);
  });
};

export interface ArtifactRegisterTelemetry {
  assessedAt: string;
  artifacts: ArtifactStatusRow[];
  freshCount: number;
  agingCount: number;
  staleCount: number;
  /** True when every artifact is inside its refresh budget. */
  allWithinBudget: boolean;
}

export const buildArtifactRegisterTelemetry = (
  now: number = Date.now(),
): ArtifactRegisterTelemetry => {
  const artifacts = describeArtifacts(now);
  const countBy = (status: ArtifactStatus) =>
    artifacts.filter((artifact) => artifact.status === status).length;
  return {
    assessedAt: new Date(now).toISOString(),
    artifacts,
    freshCount: countBy('fresh'),
    agingCount: countBy('aging'),
    staleCount: countBy('stale'),
    allWithinBudget: artifacts.every((artifact) => artifact.withinBudget),
  };
};

export const ARTIFACT_STATUS_LABEL: Record<ArtifactStatus, string> = {
  fresh: 'Fresh',
  aging: 'Ageing',
  stale: 'Stale',
};
