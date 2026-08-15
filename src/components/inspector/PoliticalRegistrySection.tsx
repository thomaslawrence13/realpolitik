import type { CountryAssessment } from '../../types';
import { ARTIFACT_REGISTER } from '../../data/artifactRegistry';

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

/**
 * Observed political registries: published UN General Assembly voting records
 * (official CSV, measured agreement with bloc anchors), the US Treasury OFAC
 * SDN list, and UCDP Country-Year organized-violence totals. All three are
 * computed from public datasets and carry honest retrieval lineages.
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
  const conflict = selected.profile.conflict;
  if (!unVotes && !sanctions && !conflict) return null;

  const voting = selected.profile.diplomatic;
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
      {sanctions && (
        <div className="registry-card">
          <header>
            <strong>Sanctions registry</strong>
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
    </div>
  );
}