import type { CountryAssessment } from '../types';
import { getFreshCoverage } from './coverage';

export type GlobalLiveSummary = {
  /** Median model risk across the present simulated set. */
  medianRisk: number;
  /** Mean of per-country fresh coverage (0–100). */
  meanCoverage: number;
  /** Count of countries with risk ≥ 55. */
  elevatedRiskCount: number;
  /** Count of countries with risk ≥ 67 (high tier). */
  highRiskCount: number;
  countryCount: number;
};

const medianSorted = (sorted: number[]): number => {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
};

/** Aggregate glanceable stats for the live global tracker chrome. */
export const buildGlobalLiveSummary = (
  countries: readonly CountryAssessment[],
): GlobalLiveSummary => {
  if (countries.length === 0) {
    return {
      medianRisk: 0,
      meanCoverage: 0,
      elevatedRiskCount: 0,
      highRiskCount: 0,
      countryCount: 0,
    };
  }

  const risks = countries.map((c) => c.risk).sort((a, b) => a - b);
  let coverageSum = 0;
  let elevatedRiskCount = 0;
  let highRiskCount = 0;

  for (const country of countries) {
    coverageSum += getFreshCoverage(country.profile);
    if (country.risk >= 55) elevatedRiskCount += 1;
    if (country.risk >= 67) highRiskCount += 1;
  }

  return {
    medianRisk: medianSorted(risks),
    meanCoverage: Math.round(coverageSum / countries.length),
    elevatedRiskCount,
    highRiskCount,
    countryCount: countries.length,
  };
};

/** Format an ISO timestamp for compact HUD display (local clock). */
export const formatHudClock = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Compact relative age for HUD tooltips. */
export const formatHudAge = (iso: string | null | undefined, now = Date.now()): string => {
  if (!iso) return 'not yet fetched';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 'unknown';
  const seconds = Math.max(0, Math.floor((now - ts) / 1000));
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
