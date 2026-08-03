import type { EconomicStats, MilitaryStats, ScenarioInputs, SimulatedCountry, SimulationWeightSet } from '../../types';
import { formatSignedValue, formatTitle } from '../inspectorUtils';

export function AnalysisPanel({
  selected,
  scenarioName,
  scenarioInputs,
  activeWeightSet,
  activeEventNames,
  comparisonSelected,
  comparisonScenarioName,
}: {
  selected: SimulatedCountry;
  scenarioName: string;
  scenarioInputs: ScenarioInputs;
  activeWeightSet: SimulationWeightSet;
  activeEventNames: string[];
  comparisonSelected: SimulatedCountry | null;
  comparisonScenarioName: string | null;
}) {
  return (
    <div className="panel-stack">
      <div className="callout callout-warning analysis-model-notice">
        <strong>Model-derived outputs</strong>
        <p>Values below are computed by the analysis model from indicator inputs — not direct observations from authoritative sources. See the Statistics tab for raw sourced data.</p>
      </div>

      <div className="section">
        <h3 className="section-title">Computed risk drivers</h3>
        <ul className="kv-list">
          {selected.drivers.map((driver) => {
            const compDriver = comparisonSelected?.drivers.find(d => d.label === driver.label);
            return (
              <li key={driver.label}>
                <span>{driver.label}</span>
                <strong>
                  {driver.value}
                  {compDriver && compDriver.value !== driver.value && (
                    <em style={{ marginLeft: 6, fontWeight: 'normal', color: 'var(--text-muted)' }}>
                      (was {compDriver.value})
                    </em>
                  )}
                </strong>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="section">
        <h3 className="section-title">Country indicators (model inputs)</h3>
        <ul className="kv-list">
          <li>
            <span>Region</span>
            <strong>{formatTitle(selected.profile.region)}</strong>
          </li>
          <li>
            <span>Subregion</span>
            <strong>{formatTitle(selected.profile.subregion)}</strong>
          </li>
          <li>
            <span>Regime type</span>
            <strong>{formatTitle(selected.profile.regimeType)}</strong>
          </li>
          <li>
            <span>Trade exposure</span>
            <strong>{formatTitle(selected.profile.indicators.tradeExposure)}</strong>
          </li>
          <li>
            <span>Treaties</span>
            <strong>{formatTitle(selected.profile.indicators.militaryTreatyLevel)}</strong>
          </li>
          <li>
            <span>Border disputes</span>
            <strong>{formatTitle(selected.profile.indicators.borderDisputes)}</strong>
          </li>
          <li>
            <span>Trade dependence</span>
            <strong>{formatTitle(selected.profile.indicators.tradeDependence)}</strong>
          </li>
          <li>
            <span>Regime stability</span>
            <strong>{formatTitle(selected.profile.indicators.regimeStability)}</strong>
          </li>
          <li>
            <span>Cohesion</span>
            <strong>{selected.profile.indicators.cohesion}</strong>
          </li>
        </ul>
      </div>

      {(selected.profile.economicStats || selected.profile.militaryStats) && (
        <EconomicMilitarySection
          economic={selected.profile.economicStats}
          military={selected.profile.militaryStats}
        />
      )}

      <div className="section">
        <h3 className="section-title">Active analysis parameters</h3>
        <ul className="kv-list">
          <li>
            <span>Label</span>
            <strong>{scenarioName}</strong>
          </li>
          <li>
            <span>Weight set</span>
            <strong>{activeWeightSet.label}</strong>
          </li>
          <li>
            <span>Sanctions</span>
            <strong className={scenarioInputs.sanctionShock !== 0 ? 'value-active' : ''}>{scenarioInputs.sanctionShock}</strong>
          </li>
          <li>
            <span>Treaty change</span>
            <strong className={scenarioInputs.treatyShift !== 0 ? 'value-active' : ''}>{formatSignedValue(scenarioInputs.treatyShift)}</strong>
          </li>
          <li>
            <span>Election volatility</span>
            <strong className={scenarioInputs.electionVolatility !== 0 ? 'value-active' : ''}>{scenarioInputs.electionVolatility}</strong>
          </li>
          <li>
            <span>Invasion pressure</span>
            <strong className={scenarioInputs.invasionPressure !== 0 ? 'value-active' : ''}>{scenarioInputs.invasionPressure}</strong>
          </li>
          <li>
            <span>Coup risk</span>
            <strong className={scenarioInputs.coupRisk !== 0 ? 'value-active' : ''}>{scenarioInputs.coupRisk}</strong>
          </li>
        </ul>
      </div>

      {activeEventNames.length > 0 && (
        <div className="section">
          <h3 className="section-title">Events affecting this country</h3>
          <ul className="kv-list">
            {activeEventNames.map((eventName) => (
              <li key={eventName}>
                <span>{eventName}</span>
                <strong>Active</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EconomicMilitarySection({
  economic,
  military,
}: {
  economic?: EconomicStats;
  military?: MilitaryStats;
}) {
  return (
    <>
      {economic && (
        <div className="section">
          <h3 className="section-title">Economic statistics</h3>
          <ul className="kv-list">
            <li>
              <span>GDP</span>
              <strong>${economic.gdpBillionUsd.toLocaleString()}B</strong>
            </li>
            <li>
              <span>GDP per capita</span>
              <strong>${economic.gdpPerCapitaUsd.toLocaleString()}</strong>
            </li>
            <li>
              <span>GDP growth</span>
              <strong className={economic.gdpGrowthPct >= 0 ? '' : 'value-active'}>
                {economic.gdpGrowthPct > 0 ? '+' : ''}{economic.gdpGrowthPct}%
              </strong>
            </li>
            <li>
              <span>Inflation</span>
              <strong className={economic.inflationPct > 10 ? 'value-active' : ''}>
                {economic.inflationPct}%
              </strong>
            </li>
            <li>
              <span>Trade / GDP</span>
              <strong>{economic.tradeGdpPct}%</strong>
            </li>
          </ul>
        </div>
      )}

      {military && (
        <div className="section">
          <h3 className="section-title">Military statistics</h3>
          <ul className="kv-list">
            <li>
              <span>Defence spending</span>
              <strong>${military.militaryExpBillionUsd.toLocaleString()}B</strong>
            </li>
            <li>
              <span>Defence / GDP</span>
              <strong>{military.militaryExpGdpPct}%</strong>
            </li>
            <li>
              <span>Active personnel</span>
              <strong>
                {military.activePersonnelThousands > 0
                  ? `${military.activePersonnelThousands.toLocaleString()}k`
                  : '—'}
              </strong>
            </li>
            <li>
              <span>Nuclear armed</span>
              <strong className={military.nuclearArmed ? 'value-active' : ''}>
                {military.nuclearArmed ? 'Yes' : 'No'}
              </strong>
            </li>
          </ul>
        </div>
      )}
    </>
  );
}
