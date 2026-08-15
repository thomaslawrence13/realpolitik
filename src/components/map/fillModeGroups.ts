import type { MapFillMode } from '../../types';

export type FillModeOption = {
  value: MapFillMode;
  label: string;
  hint: string;
};

export type FillModeGroup = {
  label: string;
  options: ReadonlyArray<FillModeOption>;
};

export const fillModeGroups: ReadonlyArray<FillModeGroup> = [
  {
    label: 'Live pressure',
    options: [
      { value: 'risk', label: 'Risk', hint: 'Default live view — teal → red as escalation risk rises' },
      { value: 'confidence', label: 'Confidence', hint: 'Brighter = higher model confidence' },
      { value: 'conflictPressure', label: 'Conflict Pressure', hint: 'Curated conflict-pressure estimate (low / medium / high) — UCDP evidence is annual history, not this tier' },
    ],
  },
  {
    label: 'Macroeconomics',
    options: [
      { value: 'gdpPerCapita', label: 'GDP per capita', hint: 'Choropleth by GDP per capita (USD)' },
      { value: 'gdpGrowth', label: 'GDP Growth', hint: 'GDP growth rate — red for contraction, green for fast growth' },
      { value: 'inflation', label: 'Inflation', hint: 'Consumer price inflation — green (low) → red (high)' },
      { value: 'tradeOpenness', label: 'Trade Openness', hint: 'Total trade as % of GDP — economic openness' },
      { value: 'debtVulnerability', label: 'Debt Vulnerability', hint: 'Composite fiscal vulnerability from rating, debt load, and FX cushion' },
      { value: 'sovereignRating', label: 'Sovereign Rating', hint: 'Sovereign credit tier' },
    ],
  },
  {
    label: 'Security & alignment',
    options: [
      { value: 'alignment', label: 'Alignment', hint: 'Color by current bloc alignment' },
      { value: 'nuclearArmed', label: 'Nuclear Armed', hint: 'Highlight nuclear-armed states' },
      { value: 'militaryBurden', label: 'Military % GDP', hint: 'Military expenditure as % of GDP' },
      { value: 'regime', label: 'Regime Type', hint: 'Color by regime type (democracy / hybrid / authoritarian)' },
      { value: 'defensePactDensity', label: 'Defense Pacts', hint: 'Active defense-pact density' },
    ],
  },
  {
    label: 'Demographics & Resources',
    options: [
      { value: 'population', label: 'Population', hint: 'Total population (millions, log-scaled)' },
      { value: 'medianAge', label: 'Median Age', hint: 'Median age — young (green) → aged (indigo)' },
      { value: 'demographicPressure', label: 'Demo Pressure', hint: 'Composite demographic pressure score (youth bulge + aging + migration)' },
      { value: 'energyExports', label: 'Energy Exports', hint: 'Net energy exports — green (exporter) → red (importer)' },
      { value: 'foodImportDependence', label: 'Food Dependency', hint: 'Food import dependence — exporter → importer' },
      { value: 'waterStress', label: 'Water Stress', hint: 'Water stress index — low → extreme' },
      { value: 'criticalMineralIntensity', label: 'Critical Minerals', hint: 'Weighted critical-mineral supply-chain footprint' },
    ],
  },
  {
    label: 'Information & Soft Power',
    options: [
      { value: 'unVotingBlocA', label: 'UN-A Alignment', hint: 'UN voting alignment with bloc A anchor' },
      { value: 'unVotingBlocB', label: 'UN-B Alignment', hint: 'UN voting alignment with bloc B anchor' },
      { value: 'softPower', label: 'Soft Power', hint: 'Soft-power reach score' },
      { value: 'cyberCapability', label: 'Cyber Capability', hint: 'Composite offensive and defensive cyber capability' },
      { value: 'internetFreedom', label: 'Internet Freedom', hint: 'Internet freedom score — controlled → open' },
    ],
  },
];
