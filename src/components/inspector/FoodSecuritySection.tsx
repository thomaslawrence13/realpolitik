import { useEffect, useState } from 'react';
import { ARTIFACT_REGISTER } from '../../data/artifactRegistry';
import type { FoodSecurityView } from '../../data/foodSecurity';

interface FoodSecuritySectionProps {
  countryId: string;
}

const FAO_BOUNDARY = ARTIFACT_REGISTER['fao-food-security'].boundary;

/**
 * Observed food and water security from FAOSTAT.
 *
 * The values are code-split and fetched on demand: a reader who never opens a
 * country panel should not pay for ~115 KB of prevalence data. Only this
 * component imports the data module, and only dynamically.
 *
 * Every row shows the value with FAO's own reference period attached, because
 * most of these are three-year averages and a bare year would claim more
 * precision than the estimate carries. Non-official values are marked: an
 * imputed prevalence is model output, and a reader comparing two countries
 * deserves to know which of them was actually surveyed.
 */
export function FoodSecuritySection({ countryId }: FoodSecuritySectionProps) {
  const [view, setView] = useState<FoodSecurityView | null>(null);

  useEffect(() => {
    let active = true;
    setView(null);
    void import('../../data/foodSecurity')
      .then((module) => {
        if (active) setView(module.foodSecurityForCountry(countryId));
      })
      // A failed chunk load leaves the panel absent rather than showing an
      // error for evidence that is supplementary to the profile.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [countryId]);

  if (!view) return null;

  return (
    <div className="profile-section">
      <h3 className="profile-section-title">
        <span className="profile-section-icon" aria-hidden={true}>🌾</span>
        Food &amp; water security
      </h3>
      <div className="registry-card">
        <header>
          <strong>FAOSTAT indicators</strong>
          <em>{view.observations.length} series</em>
        </header>
        <ul className="registry-programs">
          {view.observations.map((observation) => (
            <li key={observation.key}>
              {observation.label}: {observation.value}
              {observation.unit === '%' ? '%' : ` ${observation.unit}`} · {observation.period}
              {observation.status && observation.status !== 'official' ? ` (${observation.status})` : ''}
            </li>
          ))}
        </ul>
        <p className="registry-note">
          Retrieved {view.retrievedAt}. Periods shown as published — a range is a multi-year average, not a
          single-year reading.
        </p>
        <p className="registry-caveat">{FAO_BOUNDARY}</p>
        <a href={view.sourceUrl} target="_blank" rel="noreferrer" className="inline-source-link">
          {view.sourceTitle}
        </a>
      </div>
    </div>
  );
}
