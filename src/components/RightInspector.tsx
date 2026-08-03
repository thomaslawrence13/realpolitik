import { memo, useEffect, useMemo, useRef } from 'react';
import type { Alignment, ScenarioInputs, SimulatedCountry, SimulationWeightSet } from '../types';
import { getRiskTier } from '../simulation';
import { MetricCard, Tabs } from './ui';
import { useMapStore } from '../store/useMapStore';
import { formatPercent, formatTitle } from './inspectorUtils';
import { SparklineSeries } from './inspector/shared';
import { OverviewPanel } from './inspector/OverviewPanel';
import { StatsPanel } from './inspector/StatsPanel';
import { RelationshipsPanel } from './inspector/RelationshipsPanel';
import { AnalysisPanel } from './inspector/AnalysisPanel';

export type InspectorTab = 'stats' | 'overview' | 'relationships' | 'analysis';

export type { SparklineSeries };

type Props = {
  open: boolean;
  selected: SimulatedCountry;
  baselineSelected: SimulatedCountry;
  riskDelta: number;
  confidenceDelta: number;
  scenarioName: string;
  scenarioInputs: ScenarioInputs;
  activeWeightSet: SimulationWeightSet;
  activeEventNames: string[];
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onSelectRelated: (mapName: string) => void;
  comparisonSelected: SimulatedCountry | null;
  comparisonScenarioName: string | null;
  onClearComparison: () => void;
  sparkline: SparklineSeries | null;
  allCountries: SimulatedCountry[];
};

export const RightInspector = memo(function RightInspector({
  open,
  selected,
  baselineSelected,
  riskDelta,
  confidenceDelta,
  scenarioName,
  scenarioInputs,
  activeWeightSet,
  activeEventNames,
  alignmentColor,
  alignmentLabel,
  tab,
  onTabChange,
  onSelectRelated,
  comparisonSelected,
  comparisonScenarioName,
  onClearComparison,
  sparkline,
  allCountries,
}: Props) {
  const hoveredCountry = useMapStore((state) => state.hoveredCountry);
  const alignmentChanged = selected.alignment !== baselineSelected.alignment;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const hoveredPeer = useMemo(
    () => (hoveredCountry ? allCountries.find((country) => country.profile.mapName === hoveredCountry) ?? null : null),
    [allCountries, hoveredCountry],
  );
  const bilateralRelationship = useMemo(() => {
    if (!hoveredPeer || hoveredPeer.profile.mapName === selected.profile.mapName) return null;
    const direct = selected.profile.relationships.find((rel) => rel.mapName === hoveredPeer.profile.mapName);
    const reverse = hoveredPeer.profile.relationships.find((rel) => rel.mapName === selected.profile.mapName);
    const hostility = direct?.hostility ?? reverse?.hostility ?? null;
    const dependency = direct?.dependency ?? reverse?.dependency ?? null;
    const alignmentFriction = selected.alignment === hoveredPeer.alignment
      ? 10
      : selected.alignment === 'nonAligned' || hoveredPeer.alignment === 'nonAligned'
        ? 45
        : 75;
    return {
      displayName: hoveredPeer.profile.displayName,
      hostility,
      dependency,
      alignmentFriction,
    };
  }, [hoveredPeer, selected.alignment, selected.profile.mapName, selected.profile.relationships]);

  // Scroll the panel body back to the top whenever the selected country changes.
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bodyRef.current?.scrollTo({ top: 0, behavior: prefersReduced ? 'instant' : 'smooth' });
  }, [selected.profile.id]);

  return (
    <aside className="inspector" aria-label="Country inspector" aria-hidden={!open} {...(!open && { inert: true })}>
      <header className="inspector-header">
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
      </header>

      <Tabs<InspectorTab>
        value={tab}
        onChange={onTabChange}
        size="sm"
        options={[
          { value: 'stats', label: 'Stats' },
          { value: 'overview', label: 'Overview' },
          { value: 'relationships', label: 'Relationships', count: selected.profile.relationships.length },
          { value: 'analysis', label: 'Analysis' },
        ]}
      />

      <div className="inspector-body" ref={bodyRef}>
        {bilateralRelationship && (
          <section className="overview-panel-card">
            <header>
              <h3>Bilateral Comparison</h3>
              <span>{selected.profile.displayName} ↔ {bilateralRelationship.displayName}</span>
            </header>
            <div className="overview-grid">
              <MetricCard label="Dependency" value={bilateralRelationship.dependency == null ? 'N/A' : formatPercent(bilateralRelationship.dependency)} />
              <MetricCard label="Hostility" value={bilateralRelationship.hostility == null ? 'N/A' : formatPercent(bilateralRelationship.hostility)} />
              <MetricCard
                label="Alignment Friction"
                value={formatPercent(bilateralRelationship.alignmentFriction)}
                tone={getRiskTier(bilateralRelationship.alignmentFriction)}
              />
            </div>
          </section>
        )}
        {tab === 'stats' && (
          <StatsPanel
            selected={selected}
            comparisonSelected={comparisonSelected}
            comparisonScenarioName={comparisonScenarioName}
            allCountries={allCountries}
          />
        )}

        {tab === 'overview' && (
          <OverviewPanel
            selected={selected}
            baselineSelected={baselineSelected}
            riskDelta={riskDelta}
            confidenceDelta={confidenceDelta}
            alignmentChanged={alignmentChanged}
            alignmentColor={alignmentColor}
            alignmentLabel={alignmentLabel}
            comparisonSelected={comparisonSelected}
            comparisonScenarioName={comparisonScenarioName}
            onClearComparison={onClearComparison}
            sparkline={sparkline}
          />
        )}

        {tab === 'relationships' && (
          <RelationshipsPanel selected={selected} onSelectRelated={onSelectRelated} />
        )}

        {tab === 'analysis' && (
          <AnalysisPanel
            selected={selected}
            scenarioName={scenarioName}
            scenarioInputs={scenarioInputs}
            activeWeightSet={activeWeightSet}
            activeEventNames={activeEventNames}
            comparisonSelected={comparisonSelected}
            comparisonScenarioName={comparisonScenarioName}
          />
        )}
      </div>
    </aside>
  );
});
