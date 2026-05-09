import type { EventTemplate } from '../types';

export const eventLibrary: EventTemplate[] = [
  // Military
  {
    id: 'nato-article5',
    name: 'NATO Article 5 Invoked',
    category: 'military',
    summary:
      'A member state triggers collective-defense obligations after a confirmed attack. Alliance cohesion surges; forward military posture intensifies.',
    inputs: { treatyShift: 20, invasionPressure: 40 },
    regionTags: ['Europe', 'North America'],
  },
  {
    id: 'taiwan-strait-blockade',
    name: 'Taiwan Strait Blockade',
    category: 'military',
    summary:
      'China imposes a naval exclusion zone around Taiwan, triggering emergency deployments from US carrier groups and allied navies.',
    inputs: { invasionPressure: 60, coupRisk: 10 },
    regionTags: ['Eastern Asia', 'Oceania'],
  },
  {
    id: 'russia-escalation',
    name: 'Russian Conventional Escalation',
    category: 'military',
    summary:
      'Russia broadens operations and openly threatens NATO infrastructure, prompting emergency defense-spending pledges and tighter sanctions.',
    inputs: { invasionPressure: 50, sanctionShock: 20 },
    regionTags: ['Eastern Europe', 'Northern Europe'],
  },
  {
    id: 'gulf-war',
    name: 'Gulf Regional War',
    category: 'military',
    summary:
      'Iran and Gulf Cooperation Council states enter open conflict, disrupting shipping lanes and triggering oil-price shock.',
    inputs: { invasionPressure: 30, sanctionShock: 15, electionVolatility: 10 },
    regionTags: ['Western Asia'],
  },

  // Economic
  {
    id: 'global-recession',
    name: 'Global Recession Shock',
    category: 'economic',
    summary:
      'A synchronized contraction hits advanced economies. Trade volumes fall sharply; domestic pressure elevates political volatility.',
    inputs: { sanctionShock: 30, electionVolatility: 25 },
    regionTags: ['Global'],
  },
  {
    id: 'us-china-decoupling',
    name: 'US–China Trade Decoupling',
    category: 'economic',
    summary:
      'Sweeping tariffs and technology-export controls split global supply chains, forcing countries to choose sides.',
    inputs: { sanctionShock: 45, treatyShift: -15 },
    regionTags: ['Americas', 'Eastern Asia', 'South-Eastern Asia'],
  },
  {
    id: 'energy-crisis',
    name: 'Energy Supply Crisis',
    category: 'economic',
    summary:
      'A major exporter cuts supply. Energy prices spike globally, straining industrial economies and amplifying political discontent.',
    inputs: { sanctionShock: 20, electionVolatility: 20 },
    regionTags: ['Europe', 'Western Asia'],
  },
  {
    id: 'dollar-weaponization',
    name: 'Dollar Weaponization',
    category: 'economic',
    summary:
      'The US imposes sweeping secondary-sanctions and SWIFT exclusions, accelerating de-dollarization efforts and trade fragmentation.',
    inputs: { sanctionShock: 40 },
    regionTags: ['Global'],
  },

  // Political
  {
    id: 'western-alliance-fracture',
    name: 'Western Alliance Fracture',
    category: 'political',
    summary:
      'A major NATO member suspends treaty obligations or signals retreat from collective-defense commitments, destabilizing deterrence.',
    inputs: { treatyShift: -35, electionVolatility: 20 },
    regionTags: ['Europe', 'North America'],
  },
  {
    id: 'election-shock',
    name: 'Major Election Surprise',
    category: 'political',
    summary:
      'An unexpected electoral outcome in a key democracy reshapes foreign-policy orientation and raises near-term institutional uncertainty.',
    inputs: { electionVolatility: 50, coupRisk: 10 },
    regionTags: ['Global'],
  },
  {
    id: 'authoritarian-wave',
    name: 'Authoritarian Backslide Wave',
    category: 'political',
    summary:
      'Multiple hybrid regimes consolidate executive power, weakening democratic institutions and elevating coup-risk signals across the model.',
    inputs: { coupRisk: 25, electionVolatility: 15 },
    regionTags: ['Global'],
  },

  // Compound
  {
    id: 'cold-war-ii',
    name: 'Cold War II Onset',
    category: 'compound',
    summary:
      'Bloc consolidation hardens: NATO and US allies deepen military integration while China and Russia tighten political-economic coordination.',
    inputs: { treatyShift: 15, sanctionShock: 25, invasionPressure: 20 },
    regionTags: ['Global'],
  },
  {
    id: 'multipolar-fragmentation',
    name: 'Multipolar Fragmentation',
    category: 'compound',
    summary:
      'No single bloc achieves dominance. Regional powers pursue divergent trade blocs and security arrangements, eroding traditional alliances.',
    inputs: { treatyShift: -20, sanctionShock: 15, electionVolatility: 20 },
    regionTags: ['Global'],
  },
  {
    id: 'instability-cascade',
    name: 'Global Instability Cascade',
    category: 'compound',
    summary:
      'Multiple crises cascade simultaneously — economic contraction, political upheaval, and military pressure — overwhelming stabilizing institutions.',
    inputs: { sanctionShock: 20, electionVolatility: 25, coupRisk: 20, invasionPressure: 15 },
    regionTags: ['Global'],
  },
];

export const eventById = new Map(eventLibrary.map((event) => [event.id, event]));
