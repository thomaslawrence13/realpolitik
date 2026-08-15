import type { CountryAssessment, Tier } from '../../types';

export type InsightTone = 'critical' | 'watch' | 'positive' | 'context';

export interface CountryInsight {
  label: string;
  value: string;
  detail: string;
  tone: InsightTone;
  priority: number;
}

export interface CountryBrief {
  tone: Tier;
  headline: string;
  summary: string;
  insights: CountryInsight[];
}

const signedPct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

export const buildCountryBrief = (selected: CountryAssessment): CountryBrief => {
  const { profile } = selected;
  const tone: Tier = selected.risk >= 67 ? 'high' : selected.risk >= 34 ? 'medium' : 'low';
  const headline = tone === 'high'
    ? 'High observed stress requires attention'
    : tone === 'medium'
      ? 'Material pressure, with mixed stabilizers'
      : 'Low observed stress across tracked signals';
  const leadingDrivers = selected.drivers.slice(0, 3).map((driver) => driver.label.toLowerCase());
  const summary = leadingDrivers.length > 0
    ? `The assessment is most influenced by ${leadingDrivers.join(', ')}. This is a current-state reading, not a forecast.`
    : 'No material assessment drivers are available for this profile.';
  const insights: CountryInsight[] = [];
  const add = (insight: CountryInsight) => insights.push(insight);

  if (profile.conflict?.active || profile.indicators.conflictPressure === 'high') {
    add({
      label: 'Conflict',
      value: profile.conflict?.deathsLastYear
        ? `${profile.conflict.deathsLastYear.toLocaleString()} deaths`
        : 'High pressure',
      detail: profile.conflict?.lastYear
        ? `Recorded organized violence in ${profile.conflict.lastYear}`
        : 'Conflict-pressure indicator is high',
      tone: 'critical',
      priority: 100,
    });
  }
  if (profile.sanctions?.entryCount || profile.indicators.sanctionsExposure === 'high') {
    add({
      label: 'Sanctions',
      value: profile.sanctions?.entryCount
        ? `${profile.sanctions.entryCount.toLocaleString()} listings`
        : 'High exposure',
      detail: profile.sanctions ? `${profile.sanctions.programCount} active programs represented` : 'High sanctions exposure',
      tone: 'critical',
      priority: 95,
    });
  }
  const inflation = profile.economicStats?.inflationPct;
  if (inflation != null && inflation >= 8) {
    add({
      label: 'Inflation',
      value: `${inflation.toFixed(1)}%`,
      detail: inflation >= 15 ? 'Severe annual price pressure' : 'Elevated annual price pressure',
      tone: inflation >= 15 ? 'critical' : 'watch',
      priority: inflation >= 15 ? 90 : 78,
    });
  }
  const growth = profile.economicStats?.gdpGrowthPct;
  if (growth != null && (growth < 0 || growth >= 5)) {
    add({
      label: 'Growth',
      value: signedPct(growth),
      detail: growth < 0 ? 'Annual output is contracting' : 'Annual growth is running above 5%',
      tone: growth < 0 ? 'watch' : 'positive',
      priority: growth < 0 ? 82 : 54,
    });
  }
  if (profile.fiscal && profile.fiscal.externalDebtGdpPct >= 60) {
    add({
      label: 'External debt',
      value: `${profile.fiscal.externalDebtGdpPct.toFixed(0)}% GDP`,
      detail: `${profile.fiscal.sovereignRatingTier} sovereign-rating tier`,
      tone: profile.fiscal.externalDebtGdpPct >= 90 ? 'critical' : 'watch',
      priority: profile.fiscal.externalDebtGdpPct >= 90 ? 88 : 72,
    });
  }
  if (profile.foodWater && profile.foodWater.waterStressIndex >= 4) {
    add({
      label: 'Water stress',
      value: `${profile.foodWater.waterStressIndex}/5`,
      detail: 'High structural water vulnerability',
      tone: 'watch',
      priority: 74,
    });
  }
  if (profile.indicators.cohesion < 45) {
    add({
      label: 'Cohesion',
      value: `${profile.indicators.cohesion}/100`,
      detail: 'Domestic cohesion is below the monitoring threshold',
      tone: 'watch',
      priority: 76,
    });
  } else if (profile.indicators.cohesion >= 75) {
    add({
      label: 'Cohesion',
      value: `${profile.indicators.cohesion}/100`,
      detail: 'Strong domestic stabilizer',
      tone: 'positive',
      priority: 50,
    });
  }
  const fallbackPct = profile.dataQuality?.coverage?.fallbackPct ?? 0;
  if (selected.confidence < 65 || fallbackPct >= 25) {
    add({
      label: 'Evidence gap',
      value: `${selected.confidence}% confidence`,
      detail: `${fallbackPct}% of tracked evidence uses fallbacks`,
      tone: 'context',
      priority: 70,
    });
  }

  if (insights.length === 0) {
    add({
      label: 'Signal check',
      value: 'No acute flags',
      detail: 'Tracked indicators are inside the current monitoring thresholds',
      tone: 'positive',
      priority: 1,
    });
  }

  return {
    tone,
    headline,
    summary,
    insights: insights.sort((left, right) => right.priority - left.priority).slice(0, 4),
  };
};
