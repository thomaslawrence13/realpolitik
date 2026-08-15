/** Geopolitical statistics and UI configuration constants. */

// Risk classification thresholds
export const RISK_THRESHOLDS = {
  high: 67,
  medium: 34,
} as const;

// External debt risk contribution
export const DEBT_RISK = {
  thresholdPct: 100,
  maxContribution: 8,
  multiplier: 0.05,
} as const;

// Map rendering
export const MAP = {
  width: 960,
  height: 600,
  wheelLinePx: 17,
  wheelPagePx: 500,
  minZoom: 0.85,
  maxZoom: 8,
  zoomStep: 0.3,
  panMargin: 80,
  /** Includes the per-stat source citation and data-quality footer lines. */
  hoverCardHeight: 150,
  /** Labels start appearing for selected/related; full labels after +0.55 */
  labelsZoomThreshold: 2.2,
  labelBaseFontSize: 4.2,
  labelStrokeWidth: 0.75,
} as const;

// UI debouncing and persistence
export const UI_TIMING = {
  persistDebounceMs: 300,
  minDrawerHeight: 180,
  maxDrawerHeightRatio: 0.65,
} as const;

// Data quality thresholds
export const INFORMATION_QUALITY = {
  largeValueThreshold: 100,
  largeValueDecimals: 1,
  smallValueDecimals: 2,
  v14ReleaseConfidenceFloor: 0.35,
  relationshipTagBorderAlpha: '33',
  relationshipTagBackgroundAlpha: '14',
} as const;

// Tier mapping
export const TIER_VALUES = {
  low: 18,
  medium: 50,
  high: 82,
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
  welcomeDismissed: 'realpolitik:welcome-dismissed',
  persistedState: 'realpolitik:state',
} as const;
