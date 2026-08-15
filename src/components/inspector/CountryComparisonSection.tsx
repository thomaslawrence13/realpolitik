import { useMemo } from 'react';
import type { Alignment, CountryAssessment, CountryRelationship, Tier } from '../../types';
import { formatTitle } from '../inspectorUtils';
import { buildComparisonMetrics } from './comparison';

type Props = {
  selected: CountryAssessment;
  peer: CountryAssessment;
  allCountries: CountryAssessment[];
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
  onPeerChange: (countryId: string) => void;
  onInspectPeer: () => void;
  suggested: boolean;
};

const tierScore: Record<Tier, number> = { low: 25, medium: 58, high: 92 };

const findBilateral = (selected: CountryAssessment, peer: CountryAssessment): CountryRelationship | null =>
  selected.profile.relationships.find((relationship) => relationship.mapName === peer.profile.mapName)
  ?? peer.profile.relationships.find((relationship) => relationship.mapName === selected.profile.mapName)
  ?? null;

const groupedCountries = (countries: CountryAssessment[], selectedId: string) => {
  const groups = new Map<string, CountryAssessment[]>();
  countries
    .filter((country) => country.profile.id !== selectedId)
    .sort((left, right) => left.profile.displayName.localeCompare(right.profile.displayName))
    .forEach((country) => {
      const group = groups.get(country.profile.region) ?? [];
      group.push(country);
      groups.set(country.profile.region, group);
    });
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
};

export function CountryComparisonSection({
  selected,
  peer,
  allCountries,
  alignmentColor,
  alignmentLabel,
  onPeerChange,
  onInspectPeer,
  suggested,
}: Props) {
  const metrics = buildComparisonMetrics(selected, peer);
  const bilateral = findBilateral(selected, peer);
  const countryGroups = useMemo(
    () => groupedCountries(allCountries, selected.profile.id),
    [allCountries, selected.profile.id],
  );
  const nuclearStatus = (country: CountryAssessment) => country.profile.militaryStats
    ? country.profile.militaryStats.nuclearArmed ? 'Yes' : 'No'
    : 'Unknown';
  const posture = [
    { label: 'Alignment', selected: alignmentLabel[selected.alignment], peer: alignmentLabel[peer.alignment] },
    { label: 'Regime', selected: formatTitle(selected.profile.regimeType), peer: formatTitle(peer.profile.regimeType) },
    { label: 'Alliance network', selected: selected.profile.allianceNetwork, peer: peer.profile.allianceNetwork },
    { label: 'Conflict pressure', selected: formatTitle(selected.profile.indicators.conflictPressure), peer: formatTitle(peer.profile.indicators.conflictPressure) },
    { label: 'Sanctions exposure', selected: formatTitle(selected.profile.indicators.sanctionsExposure), peer: formatTitle(peer.profile.indicators.sanctionsExposure) },
    { label: 'Nuclear armed', selected: nuclearStatus(selected), peer: nuclearStatus(peer) },
  ];

  return (
    <div className="panel-stack panel-stack-dense comparison-view">
      <section className="glance-card comparison-picker-card">
        <label htmlFor="comparison-country">Compare {selected.profile.displayName} with</label>
        <div className="comparison-picker-row">
          <select id="comparison-country" value={peer.profile.id} onChange={(event) => onPeerChange(event.target.value)}>
            {countryGroups.map(([region, countries]) => (
              <optgroup label={region} key={region}>
                {countries.map((country) => <option value={country.profile.id} key={country.profile.id}>{country.profile.displayName}</option>)}
              </optgroup>
            ))}
          </select>
          <button type="button" className="comparison-inspect-button" onClick={onInspectPeer}>Inspect peer</button>
        </div>
        <p>{suggested ? 'Suggested structural peer · ' : ''}{formatTitle(peer.profile.region)} · {peer.profile.allianceNetwork} · {formatTitle(peer.profile.regimeType)}</p>
      </section>

      <section className="glance-card comparison-metrics-card">
        <header>
          <div><h3>Side-by-side indicators</h3><p className="section-caption">Difference is shown from {selected.profile.displayName}'s perspective.</p></div>
          <span>{metrics.length} comparable</span>
        </header>
        <div className="comparison-table" role="table" aria-label={`Comparison of ${selected.profile.displayName} and ${peer.profile.displayName}`}>
          <div className="comparison-table-head" role="row">
            <span role="columnheader">Indicator</span>
            <strong role="columnheader">{selected.profile.displayName}</strong>
            <strong role="columnheader">{peer.profile.displayName}</strong>
            <em role="columnheader">Difference</em>
          </div>
          {metrics.map((metric) => (
            <div className="comparison-table-row" data-tone={metric.tone} role="row" key={metric.id}>
              <span role="cell">{metric.label}</span>
              <strong role="cell">{metric.selectedLabel}</strong>
              <strong role="cell">{metric.peerLabel}</strong>
              <em role="cell">{metric.deltaLabel}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="glance-card comparison-posture-card">
        <header><h3>Strategic posture</h3><span>current classifications</span></header>
        <div className="comparison-posture-grid">
          {posture.map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{row.selected}</strong>
              <strong>{row.peer}</strong>
            </div>
          ))}
        </div>
        <div className="comparison-alignment-key" aria-label="Alignment colors">
          <span><i style={{ background: alignmentColor[selected.alignment] }} />{selected.profile.displayName}</span>
          <span><i style={{ background: alignmentColor[peer.alignment] }} />{peer.profile.displayName}</span>
        </div>
      </section>

      <section className="glance-card comparison-bilateral-card">
        <header>
          <div><h3>Bilateral relationship</h3><p className="section-caption">Recorded dimensions for this pair.</p></div>
          {bilateral && <span>updated {bilateral.lastUpdated}</span>}
        </header>
        {bilateral ? (
          <>
            <div className="comparison-dimension-list">
              {([
                ['Cooperation', bilateral.cooperation, '#38bdf8'],
                ['Hostility', bilateral.hostility, '#fb7185'],
                ['Dependency', bilateral.dependency, '#f59e0b'],
                ['Deterrence', bilateral.deterrence, '#a78bfa'],
              ] as const).map(([label, value, color]) => (
                <div key={label}>
                  <span>{label}</span><i aria-hidden><b style={{ width: `${value}%`, background: color }} /></i><strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="comparison-relationship-note">{bilateral.notes}</p>
          </>
        ) : (
          <p className="glance-empty">No parameterized bilateral edge is available for this pair.</p>
        )}
      </section>

      <section className="comparison-pressure-pair" aria-label="Structural pressure comparison">
        {[
          { country: selected, label: selected.profile.displayName },
          { country: peer, label: peer.profile.displayName },
        ].map(({ country, label }) => (
          <div className="glance-card" key={country.profile.id}>
            <strong>{label}</strong>
            <span>Conflict <i><b style={{ width: `${tierScore[country.profile.indicators.conflictPressure]}%` }} /></i></span>
            <span>Sanctions <i><b style={{ width: `${tierScore[country.profile.indicators.sanctionsExposure]}%` }} /></i></span>
            <span>Cohesion <i><b style={{ width: `${country.profile.indicators.cohesion}%` }} /></i></span>
          </div>
        ))}
      </section>
    </div>
  );
}
