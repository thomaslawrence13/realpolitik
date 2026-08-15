import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Alignment, CountryAssessment } from '../types';
import { getRiskTier } from '../assessment';
import { MetricCard, Segmented } from './ui';
import { useMapStore } from '../store/useMapStore';
import { formatTitle } from './inspectorUtils';
import {
  getDominantRelationshipDimension,
  relationshipTagBackgroundAlpha,
  relationshipTagBorderAlpha,
} from './inspector/shared';
import { EconomicStatsSection } from './inspector/EconomicStatsSection';
import { MilitaryStatsSection } from './inspector/MilitaryStatsSection';
import { HistoricalSeriesSection } from './inspector/HistoricalSeriesSection';
import { PoliticalRegistrySection } from './inspector/PoliticalRegistrySection';
import { RelationshipEvidenceSection } from './inspector/RelationshipEvidenceSection';
import { getCoverageMetrics } from '../lib/coverage';

export type InspectorTab = 'snapshot' | 'stats' | 'history';

type Props = {
  open: boolean;
  selected: CountryAssessment;
  allCountries: CountryAssessment[];
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onSelectRelated: (mapName: string) => void;
};

/** Map legacy tab ids from persistence / older sessions onto the current set. */
export const normalizeInspectorTab = (raw: string | undefined): InspectorTab => {
  if (raw === 'stats') return 'stats';
  if (raw === 'history') return 'history';
  // analysis / drivers / what-if tabs from older sessions → snapshot
  return 'snapshot';
};

export const RightInspector = memo(function RightInspector({
  open,
  selected,
  allCountries,
  alignmentColor,
  alignmentLabel,
  tab,
  onTabChange,
  onSelectRelated,
}: Props) {
  const hoveredCountry = useMapStore((state) => state.hoveredCountry);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [showDrivers, setShowDrivers] = useState(false);

  const activeTab = normalizeInspectorTab(tab);

  const topRelationships = useMemo(() => {
    return [...selected.profile.relationships]
      .map((relationship) => ({
        relationship,
        dominant: getDominantRelationshipDimension(relationship),
      }))
      .sort((a, b) => b.relationship.tension - a.relationship.tension)
      .slice(0, 6);
  }, [selected.profile.relationships]);

  const hoveredPeer = useMemo(
    () =>
      hoveredCountry
        ? allCountries.find((country) => country.profile.mapName === hoveredCountry) ?? null
        : null,
    [allCountries, hoveredCountry],
  );

  const bilateral = useMemo(() => {
    if (!hoveredPeer || hoveredPeer.profile.mapName === selected.profile.mapName) return null;
    const direct = selected.profile.relationships.find(
      (rel) => rel.mapName === hoveredPeer.profile.mapName,
    );
    const reverse = hoveredPeer.profile.relationships.find(
      (rel) => rel.mapName === selected.profile.mapName,
    );
    return {
      displayName: hoveredPeer.profile.displayName,
      mapName: hoveredPeer.profile.mapName,
      hostility: direct?.hostility ?? reverse?.hostility ?? null,
      dependency: direct?.dependency ?? reverse?.dependency ?? null,
      cooperation: direct?.cooperation ?? reverse?.cooperation ?? null,
      peerRisk: hoveredPeer.risk,
      peerAlignment: hoveredPeer.alignment,
    };
  }, [hoveredPeer, selected.profile.mapName, selected.profile.relationships]);

  const econ = selected.profile.economicStats;
  const mil = selected.profile.militaryStats;

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bodyRef.current?.scrollTo({ top: 0, behavior: prefersReduced ? 'instant' : 'smooth' });
    setShowDrivers(false);
  }, [selected.profile.id]);

  return (
    <aside
      className="inspector inspector-dense"
      aria-label="Country inspector"
      aria-hidden={!open}
      {...(!open && { inert: true })}
    >
      <header className="inspector-header inspector-header-dense">
        <div className="inspector-title">
          <h2>
            {selected.profile.displayName}
            <span
              className="alignment-pill alignment-pill-inline"
              style={{
                color: alignmentColor[selected.alignment],
                borderColor: `${alignmentColor[selected.alignment]}55`,
                background: `${alignmentColor[selected.alignment]}14`,
              }}
            >
              <i style={{ background: alignmentColor[selected.alignment] }} aria-hidden />
              {alignmentLabel[selected.alignment]}
            </span>
          </h2>
          <p>
            <span>{formatTitle(selected.profile.region)}</span>
            <span className="inspector-sep">·</span>
            <span>{selected.profile.allianceNetwork}</span>
            <span className="inspector-sep">·</span>
            <span>{formatTitle(selected.profile.regimeType)}</span>
          </p>
        </div>

        {/* Always-visible KPI strip — observed stats first, data confidence second */}
        <div className="inspector-kpi-strip" aria-label="At a glance">
          {econ && (
            <div className="inspector-kpi inspector-kpi-observed">
              <span>GDP/cap</span>
              <strong>
                {econ.gdpPerCapitaUsd >= 1000
                  ? `$${(econ.gdpPerCapitaUsd / 1000).toFixed(1)}k`
                  : `$${Math.round(econ.gdpPerCapitaUsd)}`}
              </strong>
              <em>
                growth {econ.gdpGrowthPct >= 0 ? '+' : ''}
                {econ.gdpGrowthPct.toFixed(1)}%
              </em>
            </div>
          )}
          {mil && (
            <div className="inspector-kpi inspector-kpi-observed">
              <span>Defence</span>
              <strong>{mil.militaryExpGdpPct}%</strong>
              <em>of GDP · ${mil.militaryExpBillionUsd.toLocaleString()}B</em>
            </div>
          )}
          <div className={`inspector-kpi risk-${getRiskTier(selected.risk)}`}>
            <span>Risk</span>
            <strong>{selected.risk}%</strong>
            <em title="Observed stress index from indicators, relationships, and vulnerabilities">
              observed stress
            </em>
          </div>
          <div className="inspector-kpi">
            <span>Confidence</span>
            <strong>{selected.confidence}%</strong>
            <em title="Information-quality score: coverage, completeness, recency, evidence">data quality</em>
          </div>
          <div className="inspector-kpi">
            <span>Fresh coverage</span>
            <strong>{getCoverageMetrics(selected.profile).freshPct}%</strong>
            <em title="Selected indicators within freshness SLA">
              {getCoverageMetrics(selected.profile).observedPct}% observed · {getCoverageMetrics(selected.profile).fallbackPct}% fallback
            </em>
          </div>
        </div>
        <p className="inspector-asof" title="Observed series may lag the calendar year">
          Data as of <strong>{selected.profile.lastUpdated}</strong>
          {econ ? ' · econ/mil snapshots' : ''}
          {' · '}
          assessment from observed data
        </p>
      </header>

      <div className="inspector-mode-row">
        <Segmented<InspectorTab>
          value={activeTab}
          onChange={onTabChange}
          options={[
            { value: 'snapshot', label: 'Snapshot' },
            { value: 'stats', label: 'Full stats' },
            { value: 'history', label: 'History' },
          ]}
        />
      </div>

      <div className="inspector-body inspector-body-dense" ref={bodyRef}>
        {bilateral && (
          <section className="glance-card glance-bilateral">
            <header>
              <h3>
                Hover peer · {bilateral.displayName}
              </h3>
              <button
                type="button"
                className="linkish"
                onClick={() => onSelectRelated(bilateral.mapName)}
              >
                Select
              </button>
            </header>
            <div className="glance-metric-row">
              <span>
                Coop <strong>{bilateral.cooperation ?? '—'}</strong>
              </span>
              <span>
                Host <strong>{bilateral.hostility ?? '—'}</strong>
              </span>
              <span>
                Dep <strong>{bilateral.dependency ?? '—'}</strong>
              </span>
              <span>
                Risk <strong className={`risk-${getRiskTier(bilateral.peerRisk)}`}>{bilateral.peerRisk}%</strong>
              </span>
            </div>
          </section>
        )}

        {activeTab === 'snapshot' && (
          <div className="panel-stack panel-stack-dense">
            {(econ || mil) && (
              <section className="glance-card glance-stats-grid">
                {econ && (
                  <div className="glance-stat-block">
                    <h3>Economy</h3>
                    <dl>
                      <div>
                        <dt>GDP</dt>
                        <dd>${econ.gdpBillionUsd.toLocaleString()}B</dd>
                      </div>
                      <div>
                        <dt>Growth</dt>
                        <dd>
                          {econ.gdpGrowthPct >= 0 ? '+' : ''}
                          {econ.gdpGrowthPct.toFixed(1)}%
                        </dd>
                      </div>
                      <div>
                        <dt>Inflation</dt>
                        <dd>{econ.inflationPct.toFixed(1)}%</dd>
                      </div>
                      <div>
                        <dt>Trade/GDP</dt>
                        <dd>{econ.tradeGdpPct.toFixed(0)}%</dd>
                      </div>
                    </dl>
                  </div>
                )}
                {mil && (
                  <div className="glance-stat-block">
                    <h3>Military</h3>
                    <dl>
                      <div>
                        <dt>Spend</dt>
                        <dd>${mil.militaryExpBillionUsd.toLocaleString()}B</dd>
                      </div>
                      <div>
                        <dt>% GDP</dt>
                        <dd>{mil.militaryExpGdpPct}%</dd>
                      </div>
                      <div>
                        <dt>Active</dt>
                        <dd>
                          {mil.activePersonnelThousands > 0
                            ? `${mil.activePersonnelThousands.toLocaleString()}k`
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Nuclear</dt>
                        <dd>{mil.nuclearArmed ? 'Yes' : 'No'}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </section>
            )}

            <section className="glance-card">
              <header>
                <h3>Top relationships</h3>
                <span>{selected.profile.relationships.length} edges</span>
              </header>
              {topRelationships.length === 0 ? (
                <p className="glance-empty">No parameterized edges for this country.</p>
              ) : (
                <ul className="glance-rel-list">
                  {topRelationships.map(({ relationship, dominant }) => (
                      <li key={relationship.mapName}>
                        <button
                          type="button"
                          className="glance-rel-row"
                          onClick={() => onSelectRelated(relationship.mapName)}
                        >
                          <span
                            className="glance-rel-tag"
                            style={{
                              color: dominant.color,
                              borderColor: `${dominant.color}${relationshipTagBorderAlpha}`,
                              background: `${dominant.color}${relationshipTagBackgroundAlpha}`,
                            }}
                          >
                            {dominant.shortLabel}
                          </span>
                          <strong>{relationship.displayName}</strong>
                          <span className="glance-rel-metrics">
                            <em title="Tension">{relationship.tension}</em>
                            <em title="Hostility">{relationship.hostility}</em>
                            <em title="Cooperation">{relationship.cooperation}</em>
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <RelationshipEvidenceSection relationships={topRelationships.map(({ relationship }) => relationship)} />

            <button
              type="button"
              className="disclosure-toggle"
              onClick={() => setShowDrivers((v) => !v)}
              aria-expanded={showDrivers}
            >
              {showDrivers ? 'Hide' : 'Show'} indicator drivers
            </button>
            {showDrivers && (
              <div className="metric-grid metric-grid-dense">
                <MetricCard
                  label="Trade exposure"
                  value={formatTitle(selected.profile.indicators.tradeExposure)}
                  tone="low"
                />
                <MetricCard
                  label="Military treaty"
                  value={formatTitle(selected.profile.indicators.militaryTreatyLevel)}
                  tone="low"
                />
                <MetricCard
                  label="Conflict pressure"
                  value={formatTitle(selected.profile.indicators.conflictPressure)}
                  tone={selected.profile.indicators.conflictPressure === 'high' ? 'high' : 'low'}
                />
                <MetricCard
                  label="Sanctions"
                  value={formatTitle(selected.profile.indicators.sanctionsExposure)}
                  tone={selected.profile.indicators.sanctionsExposure === 'high' ? 'high' : 'low'}
                />
                <MetricCard
                  label="Regime stability"
                  value={formatTitle(selected.profile.indicators.regimeStability)}
                  tone="low"
                />
                <MetricCard
                  label="Cohesion"
                  value={`${selected.profile.indicators.cohesion}`}
                  tone="low"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="panel-stack panel-stack-dense">
            {econ && (
              <EconomicStatsSection
                econ={econ}
                sources={selected.profile.sources ?? []}
                selected={selected}
              />
            )}
            {mil && (
              <MilitaryStatsSection
                mil={mil}
                sources={selected.profile.sources ?? []}
                selected={selected}
              />
            )}
            <PoliticalRegistrySection selected={selected} />
            {!econ && !mil && (
              <p className="glance-empty">No detailed economic or military snapshot for this profile.</p>
            )}
          </div>
        )}
      {activeTab === 'history' && (
          <div className="panel-stack panel-stack-dense">
            <HistoricalSeriesSection countryId={selected.profile.id} />
          </div>
        )}
      </div>
    </aside>
  );
});
