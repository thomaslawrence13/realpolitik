import type {
  CountryIndicators,
  CountryRelationship,
  IndicatorTelemetry,
  RelationshipDimensionKey,
  CountryAssessment,
  DatasetSource,
  MetricProvenance,
} from '../../types';
import { formatEvidenceClass, formatTitle } from '../inspectorUtils';
import { INFORMATION_QUALITY } from '../../lib/constants';

export const relationshipTagBorderAlpha = INFORMATION_QUALITY.relationshipTagBorderAlpha;
export const relationshipTagBackgroundAlpha = INFORMATION_QUALITY.relationshipTagBackgroundAlpha;
export const LARGE_VALUE_THRESHOLD = INFORMATION_QUALITY.largeValueThreshold;
export const LARGE_VALUE_DECIMALS = INFORMATION_QUALITY.largeValueDecimals;
export const SMALL_VALUE_DECIMALS = INFORMATION_QUALITY.smallValueDecimals;

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
  selected: CountryAssessment,
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

export function MetricProvenanceTag({
  entry,
  sources,
  fallbackLabel = 'Curated snapshot',
}: {
  entry?: MetricProvenance;
  sources: DatasetSource[];
  fallbackLabel?: string;
}) {
  if (!entry) return <span className="metric-telemetry-tag metric-telemetry-tag-neutral">{fallbackLabel}</span>;
  const source = sources.find((candidate) => candidate.id === entry.sourceId);
  const label = `${formatEvidenceClass(entry.evidenceClass)} · ${source?.publisher ?? entry.sourceId} · observed ${entry.observedAt}`;
  const title = `${source?.title ?? entry.sourceId}${entry.retrievedAt ? ` · retrieved ${entry.retrievedAt}` : ''}`;
  return (
    <span className="metric-telemetry-tag metric-telemetry-tag-neutral" title={title}>
      {label}
    </span>
  );
}
