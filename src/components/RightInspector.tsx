import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Alignment, CountryAssessment } from '../types';
import { getRiskTier } from '../assessment';
import { Segmented } from './ui';
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
import { buildCountryBrief } from './inspector/insights';
import { StrategicStatsSection } from './inspector/StrategicStatsSection';
import { buildCountryBenchmarks } from './inspector/benchmarks';
import { PeerBenchmarkSection } from './inspector/PeerBenchmarkSection';
import { DataQualitySection } from './inspector/DataQualitySection';
import { chooseComparisonPeer } from './inspector/comparison';

const CountryComparisonSection = lazy(() => import('./inspector/CountryComparisonSection').then((module) => ({
  default: module.CountryComparisonSection,
})));

export type InspectorTab = 'snapshot' | 'stats' | 'history' | 'compare';

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
  if (raw === 'compare') return 'compare';
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
  const [comparisonSelection, setComparisonSelection] = useState<{ countryId: string; peerId: string } | null>(null);

  const activeTab = normalizeInspectorTab(tab);

  const topRelationships = useMemo(() => {
    return [...selected.profile.relationships]
      .map((relationship) => ({
        relationship,
        dominant: getDominantRelationshipDimension(relationship),
      }))
      .sort((a, b) => b.relationship.tension - a.relationship.tension)
      .slice(0, 4);
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
  const coverage = useMemo(() => getCoverageMetrics(selected.profile), [selected.profile]);
  const brief = useMemo(() => buildCountryBrief(selected), [selected]);
  const benchmarks = useMemo(() => buildCountryBenchmarks(selected, allCountries), [allCountries, selected]);
  const defaultComparisonPeer = useMemo(() => chooseComparisonPeer(selected, allCountries), [allCountries, selected]);
  const comparisonPeer = useMemo(() => {
    const requestedPeerId = comparisonSelection?.countryId === selected.profile.id
      ? comparisonSelection.peerId
      : defaultComparisonPeer?.profile.id;
    return allCountries.find((country) => country.profile.id === requestedPeerId) ?? defaultComparisonPeer;
  }, [allCountries, comparisonSelection, defaultComparisonPeer, selected.profile.id]);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bodyRef.current?.scrollTo({ top: 0, behavior: prefersReduced ? 'instant' : 'smooth' });
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
          <div className={`inspector-kpi risk-${getRiskTier(selected.risk)}`}>
            <span>Risk</span>
            <strong>{selected.risk}%</strong>
            <em title="Ranked from highest to lowest stress">risk rank #{benchmarks.riskRank}</em>
          </div>
          <div className="inspector-kpi">
            <span>Confidence</span>
            <strong>{selected.confidence}%</strong>
            <em>data quality</em>
          </div>
          <div className="inspector-kpi">
            <span>Fresh</span>
            <strong>{coverage.freshPct}%</strong>
            <em>{coverage.observedPct}% observed</em>
          </div>
          {econ ? (
            <div className="inspector-kpi inspector-kpi-observed">
              <span>Growth</span>
              <strong data-tone={econ.gdpGrowthPct >= 0 ? 'positive' : 'negative'}>
                {econ.gdpGrowthPct > 0 ? '+' : ''}{econ.gdpGrowthPct.toFixed(1)}%
              </strong>
              <em>annual GDP</em>
            </div>
          ) : (
            <div className="inspector-kpi">
              <span>Coverage</span>
              <strong>{coverage.valuePct}%</strong>
              <em>{coverage.fallbackPct}% fallback</em>
            </div>
          )}
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
            { value: 'compare', label: 'Compare' },
          ]}
        />
      </div>

      <div className="inspector-body inspector-body-dense" ref={bodyRef}>
        {bilateral && activeTab !== 'compare' && (
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
            <section className={`glance-card assessment-brief assessment-brief-${brief.tone}`}>
              <header>
                <h3>Current assessment</h3>
                <span className="assessment-status">{brief.tone} risk</span>
              </header>
              <strong className="assessment-headline">{brief.headline}</strong>
              <p className="assessment-summary">{brief.summary}</p>
              <div className="assessment-insight-grid" aria-label="Priority signals">
                {brief.insights.map((insight) => (
                  <article className="assessment-insight" data-tone={insight.tone} key={insight.label}>
                    <span>{insight.label}</span>
                    <strong>{insight.value}</strong>
                    <p>{insight.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <PeerBenchmarkSection summary={benchmarks} />

            <section className="glance-card assessment-drivers">
              <header>
                <div>
                  <h3>Assessment drivers</h3>
                  <p className="section-caption">Largest contributions to the current reading.</p>
                </div>
                <span>score / 100</span>
              </header>
              <ol className="assessment-driver-list">
                {selected.drivers.slice(0, 5).map((driver) => (
                  <li key={driver.label} data-direction={driver.direction}>
                    <div className="assessment-driver-copy">
                      <strong>{driver.label}</strong>
                      <span>{driver.value}</span>
                    </div>
                    <div className="assessment-driver-track" aria-hidden>
                      <i style={{ width: `${Math.max(3, Math.min(100, driver.value))}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="glance-card priority-relationships">
              <header>
                <div>
                  <h3>Priority relationships</h3>
                  <p className="section-caption">Highest bilateral tension first. Select a country to pivot.</p>
                </div>
                <span>{selected.profile.relationships.length} edges</span>
              </header>
              {topRelationships.length === 0 ? (
                <p className="glance-empty">No parameterized edges for this country.</p>
              ) : (
                <ul className="glance-rel-list glance-rel-list-impact">
                  {topRelationships.map(({ relationship, dominant }) => (
                    <li key={relationship.mapName}>
                      <button type="button" className="glance-rel-row" onClick={() => onSelectRelated(relationship.mapName)}>
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
                        <span className="glance-rel-country">
                          <strong>{relationship.displayName}</strong>
                          <span>Coop {relationship.cooperation} · Host {relationship.hostility} · Dep {relationship.dependency}</span>
                        </span>
                        <span className="relationship-pressure" title={`Bilateral tension ${relationship.tension}/100`}>
                          <i><b style={{ width: `${relationship.tension}%` }} /></i>
                          <em>{relationship.tension}</em>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <RelationshipEvidenceSection relationships={topRelationships.map(({ relationship }) => relationship)} />
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
            <StrategicStatsSection profile={selected.profile} />
            <DataQualitySection selected={selected} />
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
        {activeTab === 'compare' && comparisonPeer && (
          <Suspense fallback={<div className="profile-section" aria-live="polite"><p className="glance-empty">Loading comparison workspace…</p></div>}>
            <CountryComparisonSection
              selected={selected}
              peer={comparisonPeer}
              allCountries={allCountries}
              alignmentColor={alignmentColor}
              alignmentLabel={alignmentLabel}
              suggested={comparisonSelection?.countryId !== selected.profile.id || comparisonSelection.peerId !== comparisonPeer.profile.id}
              onPeerChange={(peerId) => setComparisonSelection({ countryId: selected.profile.id, peerId })}
              onInspectPeer={() => {
                onSelectRelated(comparisonPeer.profile.mapName);
                onTabChange('snapshot');
              }}
            />
          </Suspense>
        )}
      </div>
    </aside>
  );
});
