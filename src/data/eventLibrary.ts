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

  // v10 additions — leverage new energy, demographic, and trade-partner data
  {
    id: 'food-security-shock',
    name: 'Global Food Security Shock',
    category: 'economic',
    summary:
      'Compound failures in major grain belts (Black Sea + South Asia) and fertilizer supply spike food prices. Import-dependent economies see sharp social pressure and unrest in youth-bulge demographies.',
    inputs: { sanctionShock: 18, electionVolatility: 30, coupRisk: 15 },
    regionTags: ['Africa', 'Western Asia', 'Southern Asia'],
  },
  {
    id: 'debt-currency-cascade',
    name: 'Emerging-Market Debt Cascade',
    category: 'economic',
    summary:
      'Dollar strength and refinancing walls trigger sovereign-debt crises across exposed emerging markets. IMF programs proliferate; political volatility spikes where austerity bites hardest.',
    inputs: { sanctionShock: 25, electionVolatility: 35, coupRisk: 18 },
    regionTags: ['Africa', 'Americas', 'Southern Asia'],
  },
  {
    id: 'energy-weaponization',
    name: 'Energy Supply Weaponization',
    category: 'economic',
    summary:
      'Major exporters coordinate supply cuts targeting consuming-country alliances. LNG-import-dependent economies bear the brunt; treaty cohesion strained as energy costs reorder priorities.',
    inputs: { sanctionShock: 30, treatyShift: -20, electionVolatility: 20 },
    regionTags: ['Europe', 'Eastern Asia', 'Western Asia'],
  },
  {
    id: 'climate-displacement',
    name: 'Climate Displacement Crisis',
    category: 'compound',
    summary:
      'Compounded heat, drought, and coastal-flooding events trigger mass cross-border displacement. Receiving states face acute political volatility; origin states see governance collapse.',
    inputs: { electionVolatility: 30, coupRisk: 22, invasionPressure: 12 },
    regionTags: ['Southern Asia', 'Africa', 'Eastern Mediterranean', 'Central America'],
  },
  {
    id: 'critical-minerals-decoupling',
    name: 'Critical Minerals Decoupling',
    category: 'economic',
    summary:
      'Export controls on rare earths, gallium, germanium, and processed lithium fragment the high-tech supply chain. Producers bloc-shop; consumers race to onshore mineral processing capacity.',
    inputs: { sanctionShock: 35, treatyShift: 5 },
    regionTags: ['Eastern Asia', 'North America', 'Africa', 'Oceania'],
  },
  {
    id: 'demographic-collapse',
    name: 'Aging-Population Fiscal Squeeze',
    category: 'political',
    summary:
      'Countries with median age above 45 hit fiscal walls as labour-force contraction collides with pension and healthcare costs. Domestic politics turn inward; defense and aid budgets compete with entitlements.',
    inputs: { treatyShift: -15, electionVolatility: 25, sanctionShock: 5 },
    regionTags: ['Eastern Asia', 'Southern Europe', 'Western Europe'],
  },
  {
    id: 'tech-sovereignty-race',
    name: 'AI & Semiconductor Sovereignty Race',
    category: 'compound',
    summary:
      'Allied blocs accelerate domestic AI compute and semiconductor capacity. Export controls harden; non-aligned states are pressured into supply-chain choices that constrain their strategic flexibility.',
    inputs: { sanctionShock: 25, treatyShift: 15, electionVolatility: 10 },
    regionTags: ['Eastern Asia', 'North America', 'Europe', 'Oceania'],
  },

  // v11 additions — leverage cyber, fiscal, food/water, diplomatic and critical-mineral data
  {
    id: 'systemic-cyber-attack',
    name: 'Systemic Cyber Attack on Critical Infrastructure',
    category: 'compound',
    summary:
      'Coordinated intrusions strike power grids, financial-clearing systems, and undersea cables. Defensive-cyber-light states face cascade failures; offensive-cyber peers manage attribution disputes that risk kinetic spillover.',
    inputs: { sanctionShock: 25, invasionPressure: 12, electionVolatility: 18 },
    regionTags: ['Global'],
  },
  {
    id: 'taiwan-semiconductor-shock',
    name: 'Taiwan Semiconductor Supply Shock',
    category: 'economic',
    summary:
      'Disruption at Taiwan fabs collapses leading-node chip supply for 6–18 months. Allied governments compete for allocations; consumer-electronics inflation spills into political volatility.',
    inputs: { sanctionShock: 35, electionVolatility: 25, treatyShift: 10 },
    regionTags: ['Eastern Asia', 'North America', 'Europe'],
  },
  {
    id: 'hormuz-canal-closure',
    name: 'Strait of Hormuz / Suez Canal Closure',
    category: 'military',
    summary:
      'A maritime chokepoint is closed by attack or blockade. ~25% of seaborne oil and a fifth of global trade re-routes around the Cape, spiking insurance premiums and hardening import-dependent economies.',
    inputs: { invasionPressure: 35, sanctionShock: 25, treatyShift: 10 },
    regionTags: ['Western Asia', 'Northern Africa', 'Europe', 'Eastern Asia'],
  },
  {
    id: 'water-stress-conflict',
    name: 'Transboundary Water-Stress Conflict',
    category: 'political',
    summary:
      'Compounded drought and upstream-dam disputes (GERD, Tigris-Euphrates, Indus, Mekong) push downstream states toward open friction. Domestic legitimacy of incumbents falters as water rationing bites.',
    inputs: { invasionPressure: 18, electionVolatility: 28, coupRisk: 18 },
    regionTags: ['Northern Africa', 'Western Asia', 'Southern Asia', 'South-Eastern Asia'],
  },
  {
    id: 'sovereign-default-cascade',
    name: 'Frontier-Market Sovereign Default Cascade',
    category: 'economic',
    summary:
      'A sequence of distressed-rated sovereigns enters selective default. Bilateral and Paris-Club restructurings drag on; political legitimacy in receiving polities collapses under austerity.',
    inputs: { sanctionShock: 28, electionVolatility: 35, coupRisk: 22 },
    regionTags: ['Africa', 'Southern Asia', 'Americas'],
  },
  {
    id: 'un-bloc-vote-realignment',
    name: 'UN General Assembly Bloc Realignment',
    category: 'political',
    summary:
      'A high-profile vote (Israel/Palestine, Russia/Ukraine, Taiwan strait) crystallizes new voting coalitions. Soft-power realignments translate into trade-and-arms reorientation over 6–24 months.',
    inputs: { treatyShift: -10, electionVolatility: 12, sanctionShock: 8 },
    regionTags: ['Global'],
  },
  {
    id: 'cobalt-rare-earth-cartel',
    name: 'Cobalt / Rare-Earth Producer Cartel',
    category: 'economic',
    summary:
      'DRC, Indonesia, China-processing actors coordinate output ceilings on cobalt and rare-earth concentrate. Battery and defense-electronics costs spike across consuming blocs.',
    inputs: { sanctionShock: 30, treatyShift: 8 },
    regionTags: ['Africa', 'Eastern Asia', 'North America', 'Europe'],
  },
];

export const eventById = new Map(eventLibrary.map((event) => [event.id, event]));
