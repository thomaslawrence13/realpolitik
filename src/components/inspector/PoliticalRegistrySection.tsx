import type { CountryAssessment } from '../../types';
import { ARTIFACT_REGISTER } from '../../data/artifactRegistry';
import {
  ATTRIBUTION_BASIS_LABEL,
  summarizeSanctionsAuthorities,
} from '../../lib/sanctionsAuthorities';

interface PoliticalRegistrySectionProps {
  selected: CountryAssessment;
}

const formatNumber = (value: number): string => value.toLocaleString('en-US');

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Boundary copy comes from the artifact register so the caveat a reader sees
 * next to a number is the same one the register and the release view state.
 */
const UCDP_BOUNDARY = ARTIFACT_REGISTER['ucdp-organized-violence'].boundary;
const OFAC_BOUNDARY = ARTIFACT_REGISTER['ofac-sdn'].boundary;
const UNSC_BOUNDARY = ARTIFACT_REGISTER['unsc-consolidated'].boundary;
const EU_BOUNDARY = ARTIFACT_REGISTER['eu-financial-sanctions'].boundary;

/**
 * Observed political registries: published UN General Assembly voting records
 * (official CSV, measured agreement with bloc anchors), the UN Security
 * Council Consolidated List, the US Treasury OFAC SDN list, and UCDP
 * Country-Year organized-violence totals. All are computed from public
 * datasets and carry honest retrieval lineages.
 *
 * The two sanctions cards are deliberately not merged. UN measures and US
 * designations are separate legal instruments with different scopes, and a
 * combined count would read as a single global authority that neither list
 * carries — so the multilateral card is shown first and each names its own
 * jurisdiction.
 *
 * These artifacts are *evidence*, not the model indicators. Conflict pressure
 * and sanctions exposure remain curated estimates until a candidate-event
 * adapter and a legal-entity layer are wired, so each card states which number
 * the reader is looking at rather than letting an official logo imply a live
 * feed behind the tier.
 */
export function PoliticalRegistrySection({ selected }: PoliticalRegistrySectionProps) {
  const unVotes = selected.profile.diplomatic?.unVotesSource;
  const sanctions = selected.profile.sanctions;
  const unscSanctions = selected.profile.unscSanctions;
  const euSanctions = selected.profile.euSanctions;
  const conflict = selected.profile.conflict;
  if (!unVotes && !sanctions && !unscSanctions && !euSanctions && !conflict) return null;

  const voting = selected.profile.diplomatic;
  const authorities = summarizeSanctionsAuthorities({
    unsc: unscSanctions,
    ofac: sanctions,
    eu: euSanctions,
  });
  return (
    <div className="profile-section">
      <h3 className="profile-section-title">
        <span className="profile-section-icon" aria-hidden={true}>🪪</span>
        Political registries
      </h3>
      {conflict && (
        <div className="registry-card">
          <header>
            <strong>Conflict (UCDP)</strong>
            <em>
              {conflict.deathsLastYear > 0
                ? `${formatNumber(conflict.deathsLastYear)} deaths in ${conflict.lastYear}`
                : 'no organized-violence deaths recorded'}
            </em>
          </header>
          <p className="registry-note">
            {conflict.active
              ? `Violence continues: ${
                  [conflict.stateBased && 'state-based', conflict.nonState && 'non-state', conflict.oneSided && 'one-sided']
                    .filter(Boolean)
                    .join(', ')
                } within borders${conflict.deathsPriorYear > 0 ? ` — ${formatNumber(conflict.deathsPriorYear)} deaths the year prior` : ''}.`
              : 'No active organized violence in the observed window.'}
            {' '}
            {conflict.totalDeathsInWindow > 0
              ? `Total ${formatNumber(conflict.totalDeathsInWindow)} deaths since 2016.`
              : ''}
          </p>
          <p className="registry-note">
            UCDP Country-Year Dataset (v{conflict.version}, deaths best estimate), retrieved {conflict.retrievedAt}.
          </p>
          <p className="registry-caveat">
            <span className="registry-curated-chip">Curated</span>
            Current conflict pressure reads {capitalize(selected.profile.indicators.conflictPressure)} — an
            in-repo estimate, not this artifact. {UCDP_BOUNDARY}
          </p>
          <a href={conflict.sourceUrl} target="_blank" rel="noreferrer" className="inline-source-link">
            {conflict.sourceTitle}
          </a>
        </div>
      )}
      {unVotes && voting && (
        <div className="registry-card">
          <header>
            <strong>UN GA voting record</strong>
            <em title="Percentage of shared roll-calls voted identically to the anchor">
              {voting.unVotingAlignmentBlocA}% with US · {voting.unVotingAlignmentBlocB}% with Russia
            </em>
          </header>
          <p className="registry-note">
            Computed from {unVotes.rollCalls.toLocaleString()} published roll-call votes (
            {unVotes.sessions[0]}–{unVotes.sessions[unVotes.sessions.length - 1]}), retrieved{' '}
            {unVotes.retrievedAt}.
          </p>
          <a href={unVotes.sourceUrl} target="_blank" rel="noreferrer" className="inline-source-link">
            {unVotes.sourceTitle}
          </a>
        </div>
      )}
      {authorities && (
        <div className="registry-card">
          <header>
            <strong>Sanctions authorities</strong>
            <em title="Distinct authorities with designations connected to this country">
              {authorities.authorityCount} of 3
            </em>
          </header>
          <ul className="registry-programs">
            {authorities.entries.map((entry) => (
              <li key={entry.authority}>
                {entry.label} · {formatNumber(entry.listingCount)} —{' '}
                {ATTRIBUTION_BASIS_LABEL[entry.basis]}
              </li>
            ))}
          </ul>
          <p className="registry-caveat">
            Counts are not comparable across authorities and are never summed: each list attributes
            designations on a different basis, and EU designations that implement a UN listing appear on
            both. This shows which authorities have acted, not a level of sanctions risk.
          </p>
        </div>
      )}
      {unscSanctions && (
        <div className="registry-card">
          <header>
            <strong>UN Security Council sanctions</strong>
            <em title="Listings under UN regimes concerning this country">
              {formatNumber(unscSanctions.listingCount)} listings
            </em>
          </header>
          <ul className="registry-programs">
            {unscSanctions.regimes.map((regime) => (
              <li key={regime.regime}>
                {regime.label} · {formatNumber(regime.listingCount)}
              </li>
            ))}
          </ul>
          <p className="registry-note">
            {formatNumber(unscSanctions.individualCount)} individuals and{' '}
            {formatNumber(unscSanctions.entityCount)} entities
            {unscSanctions.newestListedOn ? `, most recently designated ${unscSanctions.newestListedOn}` : ''}.
          </p>
          <p className="registry-note">
            Consolidated List
            {unscSanctions.listGeneratedOn ? ` generated ${unscSanctions.listGeneratedOn}` : ''}, retrieved{' '}
            {unscSanctions.retrievedAt}.
          </p>
          <p className="registry-caveat">
            <span className="registry-curated-chip">Curated</span>
            Sanctions exposure reads {capitalize(selected.profile.indicators.sanctionsExposure)} — an in-repo
            estimate, not a count of these listings. {UNSC_BOUNDARY}
          </p>
          <a href={unscSanctions.sourceUrl} target="_blank" rel="noreferrer" className="inline-source-link">
            {unscSanctions.sourceTitle}
          </a>
        </div>
      )}
      {sanctions && (
        <div className="registry-card">
          <header>
            <strong>US sanctions (OFAC SDN)</strong>
            <em>{formatNumber(sanctions.entryCount)} listings</em>
          </header>
          <ul className="registry-programs">
            {sanctions.topPrograms.slice(0, 6).map((program) => (
              <li key={program}>{program}</li>
            ))}
          </ul>
          <p className="registry-note">
            US OFAC Specially Designated Nationals list, retrieved {sanctions.retrievedAt}.
          </p>
          <p className="registry-caveat">
            <span className="registry-curated-chip">Curated</span>
            Sanctions exposure reads {capitalize(selected.profile.indicators.sanctionsExposure)} — an in-repo
            estimate, not a count of these listings. {OFAC_BOUNDARY}
          </p>
          <a href={sanctions.sourceUrl} target="_blank" rel="noreferrer" className="inline-source-link">
            {sanctions.sourceTitle}
          </a>
        </div>
      )}
      {euSanctions && (
        <div className="registry-card">
          <header>
            <strong>EU sanctions</strong>
            <em title="Designated persons holding this citizenship and entities registered here">
              {formatNumber(euSanctions.listingCount)} designations
            </em>
          </header>
          <ul className="registry-programs">
            {euSanctions.programmes.map((programme) => (
              <li key={programme.programme}>
                {programme.label} · {formatNumber(programme.listingCount)}
              </li>
            ))}
          </ul>
          <p className="registry-note">
            {formatNumber(euSanctions.personCount)} persons by citizenship and{' '}
            {formatNumber(euSanctions.enterpriseCount)} entities by registered address
            {euSanctions.newestDesignation ? `, most recently designated ${euSanctions.newestDesignation}` : ''}.
          </p>
          <p className="registry-note">
            Consolidated list
            {euSanctions.listGeneratedOn ? ` generated ${euSanctions.listGeneratedOn}` : ''}, retrieved{' '}
            {euSanctions.retrievedAt}.
          </p>
          <p className="registry-caveat">
            <span className="registry-curated-chip">Curated</span>
            Sanctions exposure reads {capitalize(selected.profile.indicators.sanctionsExposure)} — an in-repo
            estimate, not a count of these designations. {EU_BOUNDARY}
          </p>
          <a href={euSanctions.sourceUrl} target="_blank" rel="noreferrer" className="inline-source-link">
            {euSanctions.sourceTitle}
          </a>
        </div>
      )}
    </div>
  );
}