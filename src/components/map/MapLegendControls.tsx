import { memo } from 'react';
import type { Alignment, MapFillMode, OverlayMode } from '../../types';
import {
  overlayLabel,
  overlayColor,
} from './relationshipArcs';
import {
  RISK_LOW,
  RISK_MED,
  RISK_HIGH,
  NEUTRAL,
  GDP_POOR,
  GDP_MID,
  GDP_RICH,
  GROWTH_NEG,
  GROWTH_ZERO,
  GROWTH_POS,
  INFL_LOW,
  INFL_MED,
  INFL_HIGH,
  TRADE_LOW,
  TRADE_HIGH,
  NUCLEAR_YES,
  NUCLEAR_NO,
  MIL_LOW,
  MIL_HIGH,
  regimeTypeColor,
  CONFLICT_LOW,
  CONFLICT_MED,
  CONFLICT_HIGH,
  POP_LOW,
  POP_MID,
  POP_HIGH,
  AGE_YOUNG,
  AGE_MID,
  AGE_OLD,
  ENERGY_EXPORTER,
  ENERGY_BALANCED,
  ENERGY_IMPORTER,
  DEMO_LOW,
  DEMO_HIGH,
  CYBER_LOW,
  CYBER_HIGH,
  INTERNET_UNFREE,
  INTERNET_MID,
  INTERNET_FREE,
  FOOD_EXPORTER,
  FOOD_BALANCED,
  FOOD_IMPORTER,
  WATER_LOW,
  WATER_MID,
  WATER_HIGH,
  DEBT_LOW,
  DEBT_MID,
  DEBT_HIGH,
  sovereignRatingColor,
  MINERAL_LOW,
  MINERAL_HIGH,
  SOFT_LOW,
  SOFT_HIGH,
  PACT_LOW,
  PACT_HIGH,
} from './countryColors';

type MapLegendControlsProps = {
  fillMode: MapFillMode;
  overlayMode: OverlayMode;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
};

export const MapLegendControls = memo(function MapLegendControls({
  fillMode,
  overlayMode,
  alignmentColor,
  alignmentLabel,
}: MapLegendControlsProps) {
  return (
    <div className="map-legend">
        {/* Fill mode legend */}
        {fillMode === 'alignment' &&
          (Object.keys(alignmentLabel) as Alignment[]).map((key) => (
            <span key={key} className="legend-chip">
              <i style={{ background: alignmentColor[key] }} aria-hidden />
              {alignmentLabel[key]}
            </span>
          ))}
        {/* Overlay mode legend - only shown when overlay is active */}
        {overlayMode !== 'none' && (
          <>
            <span className="legend-chip" style={{ borderLeft: `3px solid ${overlayColor[overlayMode]}` }}>
              {overlayLabel[overlayMode]} arcs
            </span>
            <span className="legend-note">Showing top 6 relationships for selected country</span>
          </>
        )}
        {fillMode === 'risk' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${RISK_LOW}, ${RISK_MED}, ${RISK_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>Low</span><span>Medium</span><span>High</span>
            </span>
          </span>
        )}
        {fillMode === 'confidence' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: 'linear-gradient(to right, #1e3a8a, #67e8f9)' }} />
            <span className="legend-gradient-labels">
              <span>Low</span><span>High</span>
            </span>
          </span>
        )}
        {fillMode === 'gdpPerCapita' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${GDP_POOR}, ${GDP_MID}, ${GDP_RICH})` }} />
            <span className="legend-gradient-labels">
              <span>&lt; $1 K</span><span>~$10 K</span><span>&gt; $100 K</span>
            </span>
          </span>
        )}
        {fillMode === 'gdpGrowth' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${GROWTH_NEG}, ${GROWTH_ZERO}, ${GROWTH_POS})` }} />
            <span className="legend-gradient-labels">
              <span>−8%</span><span>0%</span><span>+8%</span>
            </span>
          </span>
        )}
        {fillMode === 'inflation' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${INFL_LOW}, ${INFL_MED}, ${INFL_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>Low</span><span>~5%</span><span>20%+</span>
            </span>
          </span>
        )}
        {fillMode === 'tradeOpenness' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${TRADE_LOW}, ${TRADE_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>Closed</span><span>Open (150%+ GDP)</span>
            </span>
          </span>
        )}
        {fillMode === 'nuclearArmed' && (
          <>
            <span className="legend-chip">
              <i style={{ background: NUCLEAR_YES }} aria-hidden />
              Nuclear armed
            </span>
            <span className="legend-chip">
              <i style={{ background: NUCLEAR_NO }} aria-hidden />
              Non-nuclear
            </span>
          </>
        )}
        {fillMode === 'militaryBurden' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${MIL_LOW}, ${MIL_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>&lt; 1%</span><span>5%+ GDP</span>
            </span>
          </span>
        )}
        {fillMode === 'regime' && (
          <>
            <span className="legend-chip">
              <i style={{ background: regimeTypeColor.democracy }} aria-hidden />
              Democracy
            </span>
            <span className="legend-chip">
              <i style={{ background: regimeTypeColor.hybrid }} aria-hidden />
              Hybrid
            </span>
            <span className="legend-chip">
              <i style={{ background: regimeTypeColor.authoritarian }} aria-hidden />
              Authoritarian
            </span>
          </>
        )}
        {fillMode === 'conflictPressure' && (
          <>
            <span className="legend-chip">
              <i style={{ background: CONFLICT_LOW }} aria-hidden />
              Low
            </span>
            <span className="legend-chip">
              <i style={{ background: CONFLICT_MED }} aria-hidden />
              Medium
            </span>
            <span className="legend-chip">
              <i style={{ background: CONFLICT_HIGH }} aria-hidden />
              High
            </span>
          </>
        )}
        {fillMode === 'population' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${POP_LOW}, ${POP_MID}, ${POP_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>&lt; 1M</span><span>~50M</span><span>1B+</span>
            </span>
          </span>
        )}
        {fillMode === 'medianAge' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${AGE_YOUNG}, ${AGE_MID}, ${AGE_OLD})` }} />
            <span className="legend-gradient-labels">
              <span>22y</span><span>35y</span><span>48y+</span>
            </span>
          </span>
        )}
        {fillMode === 'energyExports' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${ENERGY_EXPORTER}, ${ENERGY_BALANCED}, ${ENERGY_IMPORTER})` }} />
            <span className="legend-gradient-labels">
              <span>Net exporter</span><span>Balanced</span><span>Heavy importer</span>
            </span>
          </span>
        )}
        {fillMode === 'demographicPressure' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${DEMO_LOW}, ${DEMO_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>Stable</span><span>High pressure</span>
            </span>
          </span>
        )}
        {fillMode === 'cyberCapability' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${CYBER_LOW}, ${CYBER_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>Low</span><span>High</span>
            </span>
          </span>
        )}
        {fillMode === 'internetFreedom' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${INTERNET_UNFREE}, ${INTERNET_MID}, ${INTERNET_FREE})` }} />
            <span className="legend-gradient-labels">
              <span>Restricted</span><span>Mixed</span><span>Open</span>
            </span>
          </span>
        )}
        {fillMode === 'foodImportDependence' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${FOOD_EXPORTER}, ${FOOD_BALANCED}, ${FOOD_IMPORTER})` }} />
            <span className="legend-gradient-labels">
              <span>Exporter</span><span>Balanced</span><span>Importer</span>
            </span>
          </span>
        )}
        {fillMode === 'waterStress' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${WATER_LOW}, ${WATER_MID}, ${WATER_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>1</span><span>3</span><span>5</span>
            </span>
          </span>
        )}
        {fillMode === 'debtVulnerability' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${DEBT_LOW}, ${DEBT_MID}, ${DEBT_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>Resilient</span><span>Stretched</span><span>Fragile</span>
            </span>
          </span>
        )}
        {fillMode === 'sovereignRating' && (
          <>
            <span className="legend-chip">
              <i style={{ background: sovereignRatingColor.investment }} aria-hidden />
              Investment
            </span>
            <span className="legend-chip">
              <i style={{ background: sovereignRatingColor.speculative }} aria-hidden />
              Speculative
            </span>
            <span className="legend-chip">
              <i style={{ background: sovereignRatingColor.distressed }} aria-hidden />
              Distressed
            </span>
          </>
        )}
        {fillMode === 'unVotingBlocA' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${NEUTRAL}, ${alignmentColor.blocA})` }} />
            <span className="legend-gradient-labels">
              <span>Low alignment</span><span>Bloc A aligned</span>
            </span>
          </span>
        )}
        {fillMode === 'unVotingBlocB' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${NEUTRAL}, ${alignmentColor.blocB})` }} />
            <span className="legend-gradient-labels">
              <span>Low alignment</span><span>Bloc B aligned</span>
            </span>
          </span>
        )}
        {fillMode === 'criticalMineralIntensity' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${MINERAL_LOW}, ${MINERAL_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>Low</span><span>High</span>
            </span>
          </span>
        )}
        {fillMode === 'softPower' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${SOFT_LOW}, ${SOFT_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>Low</span><span>High</span>
            </span>
          </span>
        )}
        {fillMode === 'defensePactDensity' && (
          <span className="legend-gradient-bar">
            <span className="legend-gradient-swatch" style={{ background: `linear-gradient(to right, ${PACT_LOW}, ${PACT_HIGH})` }} />
            <span className="legend-gradient-labels">
              <span>None</span><span>5+</span>
            </span>
          </span>
        )}
    </div>
  );
});
