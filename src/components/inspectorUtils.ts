/** Shared formatting and utility functions for the RightInspector and related components. */

export const formatPercent = (value: number) => `${value}%`;

export const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${value}%`;

export const formatSignedValue = (value: number) => `${value > 0 ? '+' : ''}${value}`;

export const formatTitle = (value: string) =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);

export const formatIndicatorLabel = (value: string) =>
  value.replace(/([A-Z])/g, ' $1').trim().replace(/^./, (v) => v.toUpperCase());

export const formatEvidenceClass = (value: 'observed' | 'estimated' | 'fallback' | 'derived') =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const formatMineralName = (value: string) => formatIndicatorLabel(value);

export const formatCountryId = (id: string) =>
  id.length === 0
    ? id
    : id.split('-').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

export const parsePeriod = (period: string) => {
  const year = Number.parseInt(period, 10);
  return Number.isFinite(year) ? year : Number.NaN;
};

export const formatMetricValue = (
  value: number,
  unit: string,
  largeValueThreshold: number,
  largeDecimals: number,
  smallDecimals: number,
) => {
  const rounded = Math.abs(value) >= largeValueThreshold
    ? value.toFixed(largeDecimals)
    : value.toFixed(smallDecimals);
  return `${rounded.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} ${unit}`;
};

export const formatNumber = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));

export const formatSigned = (value: number) => {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
};
