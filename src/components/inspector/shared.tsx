import type { ReactNode } from 'react';
import type {
  CountryIndicators,
  CountryRelationship,
  IndicatorTelemetry,
  RelationshipDimensionKey,
  SimulatedCountry,
} from '../../types';
import { formatEvidenceClass, formatSignedPercent, formatTitle } from '../inspectorUtils';
import { SvgIcon } from '../ui';
import { INFORMATION_QUALITY } from '../../lib/constants';

export interface SparklineSeries {
  labels: string[];
  active: number[];
  baseline: number[];
  currentIndex: number;
}

export const relationshipTagBorderAlpha = INFORMATION_QUALITY.relationshipTagBorderAlpha;
export const relationshipTagBackgroundAlpha = INFORMATION_QUALITY.relationshipTagBackgroundAlpha;
export const LARGE_VALUE_THRESHOLD = INFORMATION_QUALITY.largeValueThreshold;
export const LARGE_VALUE_DECIMALS = INFORMATION_QUALITY.largeValueDecimals;
export const SMALL_VALUE_DECIMALS = INFORMATION_QUALITY.smallValueDecimals;

// Stable ordered key list for probability bars — avoids Object.keys() on every render.
export const PROBABILITY_KEYS: ReadonlyArray<keyof SimulatedCountry['probabilities']> = ['blocA', 'blocB', 'nonAligned'];

export const relationshipDimensionMeta: ReadonlyArray<{
  key: RelationshipDimensionKey;
  label: string;
  shortLabel: string;
  color: string;
}> = [
  { key: 'cooperation', label: 'Cooperative', shortLabel: 'Coop', color: '#38bdf8' },
  { key: 'hostility', label: 'Hostile', shortLabel: 'Host', color: '#fb7185' },
  { key: 'dependency', label: 'Dependency', shortLabel: 'Dep', color: '#f59e0b' },
  { key: 'deterrence', label: 'Deterrence', shortLabel: 'Deter', color: '#a78bfa' },
];

export const getDominantRelationshipDimension = (relationship: CountryRelationship) =>
  relationshipDimensionMeta.reduce((strongest, dimension) =>
    relationship[dimension.key] > relationship[strongest.key] ? dimension : strongest,
  );

export const isRelationshipStale = (relationship: CountryRelationship) =>
  relationship.dataQuality?.dimensions.some((dimension) => dimension.stale) ?? false;

export const getIndicatorTelemetry = (
  selected: SimulatedCountry,
  indicator: keyof CountryIndicators,
): IndicatorTelemetry | null => {
  return selected.profile.dataQuality?.indicators.find((entry) => entry.indicator === indicator) ?? null;
};

export function MetricTelemetryTag({
  entry,
  fallbackLabel,
}: {
  entry?: IndicatorTelemetry | null;
  fallbackLabel?: string;
}) {
  if (!entry && !fallbackLabel) return null;
  const label = entry
    ? `${formatEvidenceClass(entry.evidenceClass)} · ${entry.sourceId} · ${entry.observedAt}${entry.stale ? ' · stale' : ''}`
    : fallbackLabel;
  const tone = entry?.evidenceClass === 'fallback'
    ? 'warning'
    : entry?.evidenceClass === 'derived'
      ? 'derived'
      : entry?.evidenceClass === 'observed'
        ? 'observed'
        : 'neutral';
  return <span className={`metric-telemetry-tag metric-telemetry-tag-${tone}`}>{label}</span>;
}

/**
 * Returns a colored delta hint element when the delta is non-zero.
 * @param delta     The numeric delta value.
 * @param higherIsBetter When true (e.g. confidence), positive delta is green; when false (e.g. risk), positive delta is red.
 */
export const DeltaHint = ({ delta, higherIsBetter }: { delta: number; higherIsBetter: boolean }) => {
  if (delta === 0) return <>{`Δ ${formatSignedPercent(delta)}`}</>;
  const positive = higherIsBetter ? delta > 0 : delta < 0;
  return (
    <span style={{ color: positive ? 'var(--risk-low)' : 'var(--risk-high)' }}>
      Δ {formatSignedPercent(delta)}
    </span>
  );
};

export const BaselineComparison = ({ delta, formattedValue }: { delta: number; formattedValue: string }) => {
  if (delta === 0) {
    return <span>{formattedValue} (at baseline)</span>;
  }
  const isAbove = delta > 0;
  const direction = isAbove ? 'above' : 'below';
  const color = isAbove ? 'var(--risk-low)' : 'var(--risk-high)';
  const chevronDir = isAbove ? 'up' : 'down';
  return (
    <span style={{ color, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <SvgIcon.Chevron dir={chevronDir} />
      {formattedValue} {direction} baseline
    </span>
  );
};

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export function SmallBar({
  label,
  value,
  color,
  emphasized = false,
}: {
  label: string;
  value: number;
  color: string;
  emphasized?: boolean;
}) {
  return (
    <div className={`small-bar ${emphasized ? 'small-bar-emphasized' : ''}`}>
      <span className="small-bar-label">{label}</span>
      <div className="small-bar-track">
        <div className="small-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <strong className="small-bar-value">{value}</strong>
    </div>
  );
}

export function IndicatorBadge({ value }: { value: string }) {
  const tier = value as 'low' | 'medium' | 'high';
  const color =
    tier === 'high' ? 'var(--risk-high)' : tier === 'medium' ? 'var(--risk-med)' : 'var(--risk-low)';
  return (
    <span className="profile-indicator-badge" style={{ color, borderColor: `${color}44` }}>
      {formatTitle(value)}
    </span>
  );
}
