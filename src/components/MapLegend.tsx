import { memo } from 'react';
import { IconButton, SvgIcon } from './ui';
import type { MapFillMode } from '../types';

type Props = {
  open: boolean;
  onToggle: () => void;
  fillMode: MapFillMode;
};

export const MapLegend = memo(function MapLegend({ open, onToggle, fillMode }: Props) {
  if (!open) {
    return (
      <IconButton label="Show map legend" onClick={onToggle}>
        <SvgIcon.Info />
      </IconButton>
    );
  }

  const renderAlignmentLegend = () => (
    <div className="legend-section">
      <h4 className="legend-title">Alignment</h4>
      <div className="legend-item">
        <span className="legend-color" style={{ background: '#5ea3ff' }} />
        <span className="legend-label">Bloc A (US-aligned)</span>
      </div>
      <div className="legend-item">
        <span className="legend-color" style={{ background: '#ff6b6b' }} />
        <span className="legend-label">Bloc B (China/Russia-aligned)</span>
      </div>
      <div className="legend-item">
        <span className="legend-color" style={{ background: '#ffd166' }} />
        <span className="legend-label">Non-aligned</span>
      </div>
      <div className="legend-item">
        <span className="legend-color" style={{ background: '#c77dff' }} />
        <span className="legend-label">Contested/Unstable</span>
      </div>
    </div>
  );

  const renderRiskLegend = () => (
    <div className="legend-section">
      <h4 className="legend-title">Risk Level</h4>
      <div className="legend-item">
        <span className="legend-color" style={{ background: 'var(--risk-high)' }} />
        <span className="legend-label">High (≥67)</span>
      </div>
      <div className="legend-item">
        <span className="legend-color" style={{ background: 'var(--risk-medium)' }} />
        <span className="legend-label">Medium (34-66)</span>
      </div>
      <div className="legend-item">
        <span className="legend-color" style={{ background: 'var(--risk-low)' }} />
        <span className="legend-label">Low (&lt;34)</span>
      </div>
    </div>
  );

  const renderConfidenceLegend = () => (
    <div className="legend-section">
      <h4 className="legend-title">Confidence</h4>
      <div className="legend-item">
        <span className="legend-color" style={{ background: 'var(--confidence-high)' }} />
        <span className="legend-label">High confidence</span>
      </div>
      <div className="legend-item">
        <span className="legend-color" style={{ background: 'var(--confidence-medium)' }} />
        <span className="legend-label">Medium confidence</span>
      </div>
      <div className="legend-item">
        <span className="legend-color" style={{ background: 'var(--confidence-low)' }} />
        <span className="legend-label">Low confidence</span>
      </div>
    </div>
  );

  const renderShiftLegend = () => (
    <div className="legend-section">
      <h4 className="legend-title">Alignment Shift</h4>
      <div className="legend-item">
        <span className="legend-color" style={{ background: 'var(--shift-positive)' }} />
        <span className="legend-label">Shift toward Bloc A</span>
      </div>
      <div className="legend-item">
        <span className="legend-color" style={{ background: 'var(--shift-neutral)' }} />
        <span className="legend-label">No significant shift</span>
      </div>
      <div className="legend-item">
        <span className="legend-color" style={{ background: 'var(--shift-negative)' }} />
        <span className="legend-label">Shift toward Bloc B</span>
      </div>
    </div>
  );

  const renderMetricLegends = () => {
    const metricLegends: Record<string, { title: string; color: string; label: string }[]> = {
      gdpPerCapita: [
        { title: 'GDP per Capita', color: '#2ecc71', label: 'Higher' },
        { title: 'GDP per Capita', color: '#e74c3c', label: 'Lower' },
      ],
      gdpGrowth: [
        { title: 'GDP Growth', color: '#2ecc71', label: 'Faster growth' },
        { title: 'GDP Growth', color: '#e74c3c', label: 'Slower growth' },
      ],
      inflation: [
        { title: 'Inflation', color: '#e74c3c', label: 'Higher inflation' },
        { title: 'Inflation', color: '#2ecc71', label: 'Lower inflation' },
      ],
      tradeOpenness: [
        { title: 'Trade Openness', color: '#3498db', label: 'More open' },
        { title: 'Trade Openness', color: '#95a5a6', label: 'Less open' },
      ],
      nuclearArmed: [
        { title: 'Nuclear Status', color: '#f39c12', label: 'Nuclear-armed' },
        { title: 'Nuclear Status', color: '#95a5a6', label: 'Non-nuclear' },
      ],
      militaryBurden: [
        { title: 'Military Burden', color: '#e74c3c', label: 'Higher % GDP' },
        { title: 'Military Burden', color: '#3498db', label: 'Lower % GDP' },
      ],
      regime: [
        { title: 'Regime Type', color: '#3498db', label: 'Democracy' },
        { title: 'Regime Type', color: '#f39c12', label: 'Hybrid' },
        { title: 'Regime Type', color: '#e74c3c', label: 'Authoritarian' },
      ],
      population: [
        { title: 'Population', color: '#9b59b6', label: 'Larger' },
        { title: 'Population', color: '#3498db', label: 'Smaller' },
      ],
      medianAge: [
        { title: 'Median Age', color: '#e67e22', label: 'Older' },
        { title: 'Median Age', color: '#2ecc71', label: 'Younger' },
      ],
    };

    const currentMetric = metricLegends[fillMode];
    if (!currentMetric) return null;

    return (
      <div className="legend-section">
        <h4 className="legend-title">{currentMetric[0].title}</h4>
        {currentMetric.map((item) => (
          <div key={item.label} className="legend-item">
            <span className="legend-color" style={{ background: item.color }} />
            <span className="legend-label">{item.label}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="map-legend">
      <div className="map-legend-header">
        <h3 className="map-legend-title">Map Legend</h3>
        <IconButton label="Close legend" onClick={onToggle}>
          <SvgIcon.X />
        </IconButton>
      </div>
      
      <div className="map-legend-content">
        {fillMode === 'alignment' && renderAlignmentLegend()}
        {fillMode === 'risk' && renderRiskLegend()}
        {fillMode === 'confidence' && renderConfidenceLegend()}
        {fillMode === 'shift' && renderShiftLegend()}
        {(fillMode === 'gdpPerCapita' || fillMode === 'gdpGrowth' || fillMode === 'inflation' || 
          fillMode === 'tradeOpenness' || fillMode === 'nuclearArmed' || fillMode === 'militaryBurden' ||
          fillMode === 'regime' || fillMode === 'population' || fillMode === 'medianAge') && 
          renderMetricLegends()}
        
        <div className="legend-section">
          <h4 className="legend-title">Current Mode</h4>
          <div className="legend-item">
            <span className="legend-label-current">
              Displaying: <strong>{fillMode.replace(/([A-Z])/g, ' $1').trim()}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
