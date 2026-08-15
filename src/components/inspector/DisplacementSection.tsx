import type { CountryAssessment } from '../../types';
import { ARTIFACT_REGISTER } from '../../data/artifactRegistry';
import { displacementPer1000 } from '../../lib/unhcrDisplacement';

interface DisplacementSectionProps {
  selected: CountryAssessment;
}

const formatNumber = (value: number): string => value.toLocaleString('en-US');

const UNHCR_BOUNDARY = ARTIFACT_REGISTER['unhcr-displacement'].boundary;

/**
 * Observed displacement from UNHCR, split along the axis that decides what the
 * number means: people displaced *from* this country versus people it hosts.
 *
 * Absolute counts favour large states, so each figure is paired with a rate per
 * 1,000 residents where the profile carries a population. The rate is derived
 * here rather than stored, and labelled as such — UNHCR publishes the counts,
 * not the ratio, and the denominator is our own population statistic.
 */
export function DisplacementSection({ selected }: DisplacementSectionProps) {
  const displacement = selected.profile.displacement;
  if (!displacement) return null;

  const population = selected.profile.demographics?.populationMillions;
  const perThousand = (count: number): string => {
    if (!population || count === 0) return '';
    const rate = displacementPer1000(count, population * 1_000_000);
    return rate === null || rate < 0.1 ? '' : ` · ${rate.toLocaleString('en-US')} per 1,000 residents`;
  };

  const displacedFrom = displacement.refugeesFromCountry + displacement.asylumSeekersFromCountry;
  const hosted = displacement.refugeesHosted + displacement.asylumSeekersHosted;

  return (
    <div className="profile-section">
      <h3 className="profile-section-title">
        <span className="profile-section-icon" aria-hidden={true}>🧭</span>
        Displacement
      </h3>
      <div className="registry-card">
        <header>
          <strong>UNHCR populations</strong>
          <em>{displacement.referenceYear}</em>
        </header>
        <ul className="registry-programs">
          {displacedFrom > 0 && (
            <li>
              Displaced from this country: {formatNumber(displacedFrom)}
              {perThousand(displacedFrom)}
            </li>
          )}
          {hosted > 0 && (
            <li>
              Hosted in this country: {formatNumber(hosted)}
              {perThousand(hosted)}
            </li>
          )}
          {displacement.idps > 0 && (
            <li>
              Internally displaced: {formatNumber(displacement.idps)}
              {perThousand(displacement.idps)}
            </li>
          )}
          {displacement.stateless > 0 && <li>Stateless: {formatNumber(displacement.stateless)}</li>}
        </ul>
        <p className="registry-note">
          Refugees and asylum seekers reported for {displacement.referenceYear}, retrieved{' '}
          {displacement.retrievedAt}. Rates per 1,000 are derived from the profile population, not published
          by UNHCR.
        </p>
        <p className="registry-caveat">{UNHCR_BOUNDARY}</p>
        <a href={displacement.sourceUrl} target="_blank" rel="noreferrer" className="inline-source-link">
          {displacement.sourceTitle}
        </a>
      </div>
    </div>
  );
}
