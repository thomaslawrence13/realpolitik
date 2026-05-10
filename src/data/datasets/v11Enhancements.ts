/**
 * v11 supplemental country data layer.
 *
 * Adds six new analytical dimensions that build on the v10 demographic / energy
 * / trade snapshot:
 *
 *   - cyber:           offensive / defensive capability tiers, internet posture
 *   - fiscal:          sovereign rating tier, external debt %GDP, FX reserves
 *   - foodWater:       food import dependence, water stress, arable land
 *   - diplomatic:      UN voting alignment, defense pacts, IGO memberships
 *   - criticalMinerals: per-mineral producer / processor roles
 *   - softPower:       cultural reach proxy, language reach, inbound students
 *
 * Coverage: G20 plus a curated set of strategic mid-powers (~50 countries).
 * Countries not present here keep their v10 fields and the new optional v11
 * properties remain undefined.
 *
 * Sources are illustrative composites of (cyber) MIT Cyber Defense Index +
 * Freedom House "Freedom on the Net"; (fiscal) IMF WEO + S&P/Moody's/Fitch
 * sovereign ratings; (foodWater) FAO + WRI Aqueduct; (diplomatic) UN GA
 * voting records reconciled with treaty rolls; (criticalMinerals) USGS +
 * IEA Critical Minerals Outlook; (softPower) Brand Finance Soft Power Index
 * proxy plus UNESCO inbound-student data.
 */

import type {
  CriticalMineralEntry,
  CyberProfile,
  DiplomaticProfile,
  FiscalProfile,
  FoodWaterProfile,
  SoftPowerProfile,
} from '../../types';

export interface CountryV11Enhancement {
  cyber?: CyberProfile;
  fiscal?: FiscalProfile;
  foodWater?: FoodWaterProfile;
  diplomatic?: DiplomaticProfile;
  criticalMinerals?: CriticalMineralEntry[];
  softPower?: SoftPowerProfile;
}

export const v11Enhancements: Record<string, CountryV11Enhancement> = {
  'united-states': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 76, internetPenetrationPct: 92, dataLocalization: false, notes: 'Cyber Command + NSA capability stack; private-sector incident base.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 95, fxReservesMonthsImports: 0.6, primaryBalanceGdpPct: -3.0, notes: 'Reserve-currency issuer; deficit-financed at ultra-low spreads.' },
    foodWater: { foodImportDependencePct: -25, waterStressIndex: 3, arableLandHaPerCapita: 0.47, cerealExporter: true, notes: 'Major grain/soy exporter; Colorado/Ogallala basin stress.' },
    diplomatic: { unVotingAlignmentBlocA: 100, unVotingAlignmentBlocB: 18, defensePacts: ['NATO', 'AUKUS', 'ANZUS', 'JapanMDT', 'ROKMDT', 'PhilippinesMDT', 'RioTreaty'], igoMemberships: ['G7', 'G20', 'OECD', 'UNSC-P5', 'IMF', 'WTO', 'WorldBank', 'NATO'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'producer', globalSharePct: 12 },
      { mineral: 'lithium', role: 'reserves', globalSharePct: 4 },
      { mineral: 'copper', role: 'producer', globalSharePct: 5 },
      { mineral: 'uranium', role: 'consumer', globalSharePct: 25 },
    ],
    softPower: { reachScore: 92, inboundStudentsThousands: 1000, globalLanguageHost: true, notes: 'Hollywood + tech ecosystem + reserve currency.' },
  },
  'china': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 9, internetPenetrationPct: 76, dataLocalization: true, notes: 'PLA SSF + MSS programs; Great Firewall; sovereign internet posture.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 14, fxReservesMonthsImports: 14, primaryBalanceGdpPct: -2.7, notes: 'Massive reserves; LGFV/property-debt overhang; closed capital account.' },
    foodWater: { foodImportDependencePct: 15, waterStressIndex: 4, arableLandHaPerCapita: 0.08, cerealExporter: false, notes: 'Top global soy/corn importer; severe N. China water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 22, unVotingAlignmentBlocB: 100, defensePacts: ['DPRKTreaty'], igoMemberships: ['G20', 'UNSC-P5', 'BRICS', 'SCO', 'RCEP', 'AIIB', 'WTO', 'IMF'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'processor', globalSharePct: 85 },
      { mineral: 'gallium', role: 'producer', globalSharePct: 95 },
      { mineral: 'germanium', role: 'producer', globalSharePct: 80 },
      { mineral: 'graphite', role: 'producer', globalSharePct: 75 },
      { mineral: 'lithium', role: 'processor', globalSharePct: 65 },
      { mineral: 'cobalt', role: 'processor', globalSharePct: 75 },
      { mineral: 'tungsten', role: 'producer', globalSharePct: 80 },
    ],
    softPower: { reachScore: 64, inboundStudentsThousands: 290, globalLanguageHost: true, notes: 'CGTN/Xinhua reach; Confucius Institutes; rising film industry.' },
  },
  'russia': {
    cyber: { offensiveTier: 'high', defensiveTier: 'medium', internetFreedomScore: 21, internetPenetrationPct: 88, dataLocalization: true, notes: 'GRU/SVR/FSB programs; sovereign-internet RuNet; aggressive offensive ops.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 16, fxReservesMonthsImports: 16, primaryBalanceGdpPct: -1.5, notes: '~50% of FX reserves frozen by G7; war economy; rouble float.' },
    foodWater: { foodImportDependencePct: -15, waterStressIndex: 2, arableLandHaPerCapita: 0.85, cerealExporter: true, notes: 'Top global wheat exporter; abundant freshwater.' },
    diplomatic: { unVotingAlignmentBlocA: 14, unVotingAlignmentBlocB: 92, defensePacts: ['CSTO', 'DPRKTreaty'], igoMemberships: ['UNSC-P5', 'BRICS', 'SCO', 'EAEU', 'CIS'] },
    criticalMinerals: [
      { mineral: 'platinumGroup', role: 'producer', globalSharePct: 40 },
      { mineral: 'nickel', role: 'producer', globalSharePct: 11 },
      { mineral: 'uranium', role: 'producer', globalSharePct: 7 },
      { mineral: 'titanium', role: 'producer', globalSharePct: 14 },
    ],
    softPower: { reachScore: 38, inboundStudentsThousands: 350, globalLanguageHost: true, notes: 'RT decline post-2022; CIS soft-power footprint persists.' },
  },
  'germany': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 77, internetPenetrationPct: 93, dataLocalization: false, notes: 'BSI defensive lead; CIR cyber command; GDPR-anchored privacy posture.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 165, fxReservesMonthsImports: 1.8, primaryBalanceGdpPct: -1.5, notes: 'AAA sovereign; debt-brake constitutional rule under reform.' },
    foodWater: { foodImportDependencePct: 25, waterStressIndex: 3, arableLandHaPerCapita: 0.14, cerealExporter: true, notes: 'Net cereal exporter; rising drought stress in eastern states.' },
    diplomatic: { unVotingAlignmentBlocA: 82, unVotingAlignmentBlocB: 28, defensePacts: ['NATO'], igoMemberships: ['G7', 'G20', 'OECD', 'EU', 'NATO', 'IMF', 'WTO'] },
    criticalMinerals: [
      { mineral: 'lithium', role: 'consumer', globalSharePct: 8 },
      { mineral: 'rareEarths', role: 'consumer', globalSharePct: 6 },
    ],
    softPower: { reachScore: 78, inboundStudentsThousands: 460, globalLanguageHost: false, notes: 'Goethe-Institut network; Mittelstand reputation; Bundesliga reach.' },
  },
  'france': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 76, internetPenetrationPct: 91, dataLocalization: false, notes: 'ANSSI defensive; DGSE offensive; doctrine of "active cyber defense".' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 240, fxReservesMonthsImports: 1.4, primaryBalanceGdpPct: -3.2, notes: 'High debt stock but EU/ECB anchor; rating recently AA- by S&P.' },
    foodWater: { foodImportDependencePct: 5, waterStressIndex: 3, arableLandHaPerCapita: 0.27, cerealExporter: true, notes: 'EU top wheat exporter; growing southern-France water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 80, unVotingAlignmentBlocB: 30, defensePacts: ['NATO'], igoMemberships: ['G7', 'G20', 'UNSC-P5', 'OECD', 'EU', 'NATO', 'IMF'] },
    criticalMinerals: [
      { mineral: 'uranium', role: 'consumer', globalSharePct: 12 },
    ],
    softPower: { reachScore: 80, inboundStudentsThousands: 365, globalLanguageHost: true, notes: 'Francophonie + luxury/cultural exports; UNSC P5 status.' },
  },
  'united-kingdom': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 79, internetPenetrationPct: 95, dataLocalization: false, notes: 'NCSC + GCHQ stack; Five Eyes member.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 290, fxReservesMonthsImports: 4.0, primaryBalanceGdpPct: -3.8, notes: 'AA rating; reserve-status pound; high gross external liabilities.' },
    foodWater: { foodImportDependencePct: 45, waterStressIndex: 3, arableLandHaPerCapita: 0.09, cerealExporter: false, notes: 'Significant food-import dependence post-Brexit.' },
    diplomatic: { unVotingAlignmentBlocA: 85, unVotingAlignmentBlocB: 22, defensePacts: ['NATO', 'AUKUS', 'FivePowerDefense'], igoMemberships: ['G7', 'G20', 'UNSC-P5', 'OECD', 'NATO', 'Commonwealth', 'CPTPP'] },
    criticalMinerals: [],
    softPower: { reachScore: 85, inboundStudentsThousands: 680, globalLanguageHost: true, notes: 'BBC reach; English-language anchor; strong universities.' },
  },
  'japan': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 76, internetPenetrationPct: 93, dataLocalization: false, notes: 'NISC defensive; Self-Defense Cyber Unit growing; minimal offensive posture.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 80, fxReservesMonthsImports: 16, primaryBalanceGdpPct: -2.2, notes: 'World-largest creditor nation; massive domestic debt holdings.' },
    foodWater: { foodImportDependencePct: 60, waterStressIndex: 2, arableLandHaPerCapita: 0.03, cerealExporter: false, notes: 'High structural food import dependence; small arable base.' },
    diplomatic: { unVotingAlignmentBlocA: 82, unVotingAlignmentBlocB: 25, defensePacts: ['JapanMDT'], igoMemberships: ['G7', 'G20', 'OECD', 'CPTPP', 'IMF', 'Quad'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'consumer', globalSharePct: 14 },
      { mineral: 'lithium', role: 'consumer', globalSharePct: 9 },
    ],
    softPower: { reachScore: 82, inboundStudentsThousands: 230, globalLanguageHost: false, notes: 'Anime/manga + cuisine + tech-export soft power.' },
  },
  'india': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 50, internetPenetrationPct: 52, dataLocalization: true, notes: 'CERT-In; rising indigenous capability; data-localization Bill 2023.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 19, fxReservesMonthsImports: 11, primaryBalanceGdpPct: -3.5, notes: 'BBB- (lowest IG); large reserves; structural fiscal deficit.' },
    foodWater: { foodImportDependencePct: 8, waterStressIndex: 4, arableLandHaPerCapita: 0.11, cerealExporter: true, notes: 'Top rice exporter; Punjab/Haryana groundwater crisis.' },
    diplomatic: { unVotingAlignmentBlocA: 35, unVotingAlignmentBlocB: 55, defensePacts: ['IndiaRussiaSP'], igoMemberships: ['G20', 'BRICS', 'SCO', 'Quad', 'Commonwealth', 'IORA'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'reserves', globalSharePct: 6 },
    ],
    softPower: { reachScore: 67, inboundStudentsThousands: 65, globalLanguageHost: true, notes: 'Bollywood reach; Hindi/English language anchor; diaspora.' },
  },
  'south-korea': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 67, internetPenetrationPct: 97, dataLocalization: false, notes: 'KISA + Cyber Command; high-bandwidth target environment.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 38, fxReservesMonthsImports: 8, primaryBalanceGdpPct: 0.8, notes: 'AA rating; strong external position.' },
    foodWater: { foodImportDependencePct: 50, waterStressIndex: 3, arableLandHaPerCapita: 0.03, cerealExporter: false, notes: 'High food-import structural dependence.' },
    diplomatic: { unVotingAlignmentBlocA: 80, unVotingAlignmentBlocB: 30, defensePacts: ['ROKMDT'], igoMemberships: ['G20', 'OECD', 'IMF'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'consumer', globalSharePct: 10 },
      { mineral: 'lithium', role: 'consumer', globalSharePct: 12 },
    ],
    softPower: { reachScore: 78, inboundStudentsThousands: 165, globalLanguageHost: false, notes: 'K-pop / K-drama cultural wave; semiconductor-hub identity.' },
  },
  'australia': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 76, internetPenetrationPct: 95, dataLocalization: false, notes: 'ASD; Five Eyes anchor; AUKUS Pillar 2.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 105, fxReservesMonthsImports: 3.4, primaryBalanceGdpPct: 0.5, notes: 'AAA rating; commodity-export-leveraged.' },
    foodWater: { foodImportDependencePct: -50, waterStressIndex: 4, arableLandHaPerCapita: 1.5, cerealExporter: true, notes: 'Major wheat/beef exporter; severe Murray-Darling water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 90, unVotingAlignmentBlocB: 18, defensePacts: ['ANZUS', 'AUKUS', 'FivePowerDefense'], igoMemberships: ['G20', 'OECD', 'CPTPP', 'Commonwealth', 'Quad'] },
    criticalMinerals: [
      { mineral: 'lithium', role: 'producer', globalSharePct: 47 },
      { mineral: 'rareEarths', role: 'producer', globalSharePct: 9 },
      { mineral: 'nickel', role: 'producer', globalSharePct: 5 },
      { mineral: 'cobalt', role: 'producer', globalSharePct: 3 },
      { mineral: 'uranium', role: 'reserves', globalSharePct: 28 },
    ],
    softPower: { reachScore: 70, inboundStudentsThousands: 430, globalLanguageHost: true, notes: 'Universities + diaspora + minerals diplomacy.' },
  },
  'canada': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 87, internetPenetrationPct: 94, dataLocalization: false, notes: 'CSE + Five Eyes; defensive-leaning posture.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 145, fxReservesMonthsImports: 1.2, primaryBalanceGdpPct: -1.1, notes: 'AAA rating; resource-export sensitive.' },
    foodWater: { foodImportDependencePct: -45, waterStressIndex: 1, arableLandHaPerCapita: 1.1, cerealExporter: true, notes: 'Top global wheat/canola exporter; abundant fresh water.' },
    diplomatic: { unVotingAlignmentBlocA: 85, unVotingAlignmentBlocB: 22, defensePacts: ['NATO', 'NORAD'], igoMemberships: ['G7', 'G20', 'OECD', 'NATO', 'Commonwealth', 'Francophonie', 'CPTPP'] },
    criticalMinerals: [
      { mineral: 'uranium', role: 'producer', globalSharePct: 13 },
      { mineral: 'nickel', role: 'producer', globalSharePct: 7 },
      { mineral: 'potash', role: 'producer', globalSharePct: 32 },
      { mineral: 'cobalt', role: 'producer', globalSharePct: 3 },
    ],
    softPower: { reachScore: 76, inboundStudentsThousands: 800, globalLanguageHost: true, notes: 'Universities + immigration brand; resource-major reputation.' },
  },
  'italy': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 76, internetPenetrationPct: 88, dataLocalization: false, notes: 'ACN agency since 2021; growing capability.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 130, fxReservesMonthsImports: 1.7, primaryBalanceGdpPct: -3.5, notes: 'BBB rating; high debt burden anchored by ECB.' },
    foodWater: { foodImportDependencePct: 35, waterStressIndex: 4, arableLandHaPerCapita: 0.11, cerealExporter: false, notes: 'Net food importer; severe southern-Italy water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 80, unVotingAlignmentBlocB: 28, defensePacts: ['NATO'], igoMemberships: ['G7', 'G20', 'OECD', 'EU', 'NATO'] },
    criticalMinerals: [],
    softPower: { reachScore: 75, inboundStudentsThousands: 110, globalLanguageHost: false, notes: 'Cultural-heritage / fashion / cuisine reach.' },
  },
  'spain': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 76, internetPenetrationPct: 94, dataLocalization: false, notes: 'CCN-CERT defensive lead.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 175, fxReservesMonthsImports: 1.6, primaryBalanceGdpPct: -2.5, notes: 'A rating; ECB-anchored; tourism-sensitive recovery.' },
    foodWater: { foodImportDependencePct: 10, waterStressIndex: 4, arableLandHaPerCapita: 0.26, cerealExporter: false, notes: 'Severe drought stress; major olive-oil/wine/produce exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 78, unVotingAlignmentBlocB: 30, defensePacts: ['NATO'], igoMemberships: ['G20', 'OECD', 'EU', 'NATO', 'OEI'] },
    criticalMinerals: [],
    softPower: { reachScore: 70, inboundStudentsThousands: 90, globalLanguageHost: true, notes: 'Spanish-language anchor + tourism + cultural reach.' },
  },
  'netherlands': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 79, internetPenetrationPct: 96, dataLocalization: false, notes: 'NCSC + AIVD/MIVD; ASML cyber-security exposure.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 470, fxReservesMonthsImports: 1.0, primaryBalanceGdpPct: -1.0, notes: 'AAA rating; high gross external claims (financial-hub).' },
    foodWater: { foodImportDependencePct: -75, waterStressIndex: 2, arableLandHaPerCapita: 0.06, cerealExporter: false, notes: 'World #2 ag exporter by value; horticulture/dairy hub.' },
    diplomatic: { unVotingAlignmentBlocA: 84, unVotingAlignmentBlocB: 24, defensePacts: ['NATO'], igoMemberships: ['G20guest', 'OECD', 'EU', 'NATO'] },
    criticalMinerals: [],
    softPower: { reachScore: 70, inboundStudentsThousands: 130, globalLanguageHost: false, notes: 'Universities; Rotterdam-Amsterdam logistics; legal hub (ICJ/ICC).' },
  },
  'poland': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 73, internetPenetrationPct: 90, dataLocalization: false, notes: 'CSIRT GOV.PL; rising defense-industrial cyber posture.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 60, fxReservesMonthsImports: 5.5, primaryBalanceGdpPct: -3.5, notes: 'A- rating; aggressive defense-spending ramp.' },
    foodWater: { foodImportDependencePct: -10, waterStressIndex: 3, arableLandHaPerCapita: 0.27, cerealExporter: true, notes: 'Net food exporter; coal-water-stress in central regions.' },
    diplomatic: { unVotingAlignmentBlocA: 82, unVotingAlignmentBlocB: 22, defensePacts: ['NATO'], igoMemberships: ['G20guest', 'OECD', 'EU', 'NATO', 'V4'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'producer', globalSharePct: 3 },
    ],
    softPower: { reachScore: 60, inboundStudentsThousands: 95, globalLanguageHost: false, notes: 'Eastern-flank security narrative; diaspora reach.' },
  },
  'ukraine': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 60, internetPenetrationPct: 80, dataLocalization: true, notes: 'SBU + GUR cyber programs; battle-hardened defense; international support flows.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 90, fxReservesMonthsImports: 5, primaryBalanceGdpPct: -10, notes: 'Eurobond restructure 2024; donor-financed budget.' },
    foodWater: { foodImportDependencePct: -200, waterStressIndex: 3, arableLandHaPerCapita: 0.78, cerealExporter: true, notes: 'Top-tier wheat/corn exporter; Black-Sea-corridor disruption.' },
    diplomatic: { unVotingAlignmentBlocA: 80, unVotingAlignmentBlocB: 12, defensePacts: ['BilateralUSStrategicPartnership'], igoMemberships: ['UN', 'CoE'], pendingAccession: ['EU', 'NATO'] },
    criticalMinerals: [
      { mineral: 'titanium', role: 'producer', globalSharePct: 7 },
      { mineral: 'manganese', role: 'reserves', globalSharePct: 11 },
    ],
    softPower: { reachScore: 58, inboundStudentsThousands: 80, globalLanguageHost: false, notes: 'Wartime brand; Zelensky-era global communication.' },
  },
  'turkey': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 30, internetPenetrationPct: 86, dataLocalization: true, notes: 'USOM defensive; periodic platform throttling.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 50, fxReservesMonthsImports: 3.5, primaryBalanceGdpPct: -2.0, notes: 'B+ rating; orthodox-pivot 2023; chronic FX volatility.' },
    foodWater: { foodImportDependencePct: 5, waterStressIndex: 4, arableLandHaPerCapita: 0.27, cerealExporter: false, notes: 'Severe water stress; major hazelnut/wheat exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 55, unVotingAlignmentBlocB: 50, defensePacts: ['NATO'], igoMemberships: ['G20', 'NATO', 'OECD', 'D-8'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'reserves', globalSharePct: 12 },
      { mineral: 'tungsten', role: 'producer', globalSharePct: 4 },
    ],
    softPower: { reachScore: 60, inboundStudentsThousands: 250, globalLanguageHost: false, notes: 'TRT World; Diyanet network; drone-export reputation.' },
  },
  'saudi-arabia': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 24, internetPenetrationPct: 99, dataLocalization: true, notes: 'NCA defensive; Pegasus-procurement history.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 30, fxReservesMonthsImports: 14, primaryBalanceGdpPct: -2.5, notes: 'A rating; PIF-led diversification; oil-revenue dependency.' },
    foodWater: { foodImportDependencePct: 80, waterStressIndex: 5, arableLandHaPerCapita: 0.10, cerealExporter: false, notes: 'Extreme water stress; near-total food import dependence.' },
    diplomatic: { unVotingAlignmentBlocA: 50, unVotingAlignmentBlocB: 60, defensePacts: ['GCC'], igoMemberships: ['G20', 'OPEC', 'GCC', 'OIC', 'AL'] },
    criticalMinerals: [],
    softPower: { reachScore: 48, inboundStudentsThousands: 90, globalLanguageHost: false, notes: 'Vision 2030 sportswashing; OPEC convening role.' },
  },
  'iran': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 11, internetPenetrationPct: 80, dataLocalization: true, notes: 'IRGC + APT35/APT39; National Information Network.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 5, fxReservesMonthsImports: 7, primaryBalanceGdpPct: -4.5, notes: 'Sanctions-locked from global capital; rial collapse cycles.' },
    foodWater: { foodImportDependencePct: 25, waterStressIndex: 5, arableLandHaPerCapita: 0.18, cerealExporter: false, notes: 'Extreme water stress; chronic drought protests.' },
    diplomatic: { unVotingAlignmentBlocA: 12, unVotingAlignmentBlocB: 88, defensePacts: ['IranRussiaSP'], igoMemberships: ['BRICS', 'SCO', 'OPEC', 'OIC', 'ECO'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'producer', globalSharePct: 2 },
    ],
    softPower: { reachScore: 38, inboundStudentsThousands: 75, globalLanguageHost: false, notes: 'Persian-cultural reach; Press TV; sanctions limit broader projection.' },
  },
  'israel': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 70, internetPenetrationPct: 92, dataLocalization: false, notes: 'Unit 8200 + INCD; major cyber-export industry.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 28, fxReservesMonthsImports: 12, primaryBalanceGdpPct: -6.5, notes: 'A rating (downgraded 2024); war fiscal drag.' },
    foodWater: { foodImportDependencePct: 50, waterStressIndex: 5, arableLandHaPerCapita: 0.04, cerealExporter: false, notes: 'Extreme water stress; desalination leadership.' },
    diplomatic: { unVotingAlignmentBlocA: 88, unVotingAlignmentBlocB: 18, defensePacts: ['IsraelUSStrategicPartnership'], igoMemberships: ['OECD', 'IMF'] },
    criticalMinerals: [],
    softPower: { reachScore: 65, inboundStudentsThousands: 25, globalLanguageHost: false, notes: 'Tech/cyber export brand; diaspora reach.' },
  },
  'uae': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 28, internetPenetrationPct: 99, dataLocalization: true, notes: 'CSC; G42 AI-cybersecurity ecosystem.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 50, fxReservesMonthsImports: 7, primaryBalanceGdpPct: 5.0, notes: 'AA rating; sovereign-fund firepower.' },
    foodWater: { foodImportDependencePct: 85, waterStressIndex: 5, arableLandHaPerCapita: 0.005, cerealExporter: false, notes: 'Near-total food-import dependence; desalination-driven water.' },
    diplomatic: { unVotingAlignmentBlocA: 60, unVotingAlignmentBlocB: 50, defensePacts: ['GCC'], igoMemberships: ['BRICS', 'GCC', 'OPEC', 'OIC', 'AL'] },
    criticalMinerals: [],
    softPower: { reachScore: 60, inboundStudentsThousands: 95, globalLanguageHost: false, notes: 'Aviation/financial hub; sovereign-fund cultural diplomacy.' },
  },
  'qatar': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 31, internetPenetrationPct: 99, dataLocalization: true, notes: 'NCSA defensive; Qatar Computing Research Institute.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 110, fxReservesMonthsImports: 9, primaryBalanceGdpPct: 6.5, notes: 'AA rating; LNG-revenue underwriting.' },
    foodWater: { foodImportDependencePct: 90, waterStressIndex: 5, arableLandHaPerCapita: 0.005, cerealExporter: false, notes: 'Near-total food-import dependence post-2017 blockade lessons learned.' },
    diplomatic: { unVotingAlignmentBlocA: 55, unVotingAlignmentBlocB: 45, defensePacts: ['BilateralUSDefense'], igoMemberships: ['GCC', 'OPECdeparted', 'OIC', 'AL'] },
    criticalMinerals: [],
    softPower: { reachScore: 55, inboundStudentsThousands: 30, globalLanguageHost: false, notes: 'Al Jazeera; mediator role; FIFA 2022 footprint.' },
  },
  'taiwan': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 78, internetPenetrationPct: 92, dataLocalization: false, notes: 'NICS + Information Communication Cybersecurity Office; TSMC critical-asset protection.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 35, fxReservesMonthsImports: 18, primaryBalanceGdpPct: 1.5, notes: 'AA+ rating; massive trade surplus.' },
    foodWater: { foodImportDependencePct: 65, waterStressIndex: 4, arableLandHaPerCapita: 0.03, cerealExporter: false, notes: 'High food-import dependence; recurring drought stress.' },
    diplomatic: { unVotingAlignmentBlocA: 88, unVotingAlignmentBlocB: 12, defensePacts: ['TRA'], igoMemberships: ['WTO', 'APEC', 'ADB'] },
    criticalMinerals: [],
    softPower: { reachScore: 60, inboundStudentsThousands: 116, globalLanguageHost: false, notes: 'Semiconductor anchor; democracy-vs-autocracy framing.' },
  },
  'vietnam': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 22, internetPenetrationPct: 80, dataLocalization: true, notes: 'A41 cyber unit; cybersecurity law restricts cross-border data.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 38, fxReservesMonthsImports: 3.0, primaryBalanceGdpPct: -3.0, notes: 'BB+ rating; managed-float dong; manufacturing FDI surge.' },
    foodWater: { foodImportDependencePct: -15, waterStressIndex: 3, arableLandHaPerCapita: 0.07, cerealExporter: true, notes: 'Top-three rice exporter; Mekong-Delta climate stress.' },
    diplomatic: { unVotingAlignmentBlocA: 30, unVotingAlignmentBlocB: 65, defensePacts: [], igoMemberships: ['ASEAN', 'CPTPP', 'RCEP'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'reserves', globalSharePct: 18 },
    ],
    softPower: { reachScore: 50, inboundStudentsThousands: 50, globalLanguageHost: false, notes: 'Bamboo-diplomacy brand; manufacturing-hub identity.' },
  },
  'singapore': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 53, internetPenetrationPct: 97, dataLocalization: false, notes: 'CSA + DIS; financial-hub critical-infrastructure focus.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 480, fxReservesMonthsImports: 9, primaryBalanceGdpPct: 0.5, notes: 'AAA rating; financial-hub gross-debt distortion; massive net-creditor.' },
    foodWater: { foodImportDependencePct: 90, waterStressIndex: 5, arableLandHaPerCapita: 0.0001, cerealExporter: false, notes: 'Near-total food/water import dependence; "30 by 30" food-resilience target.' },
    diplomatic: { unVotingAlignmentBlocA: 70, unVotingAlignmentBlocB: 35, defensePacts: ['FivePowerDefense'], igoMemberships: ['ASEAN', 'CPTPP', 'RCEP', 'Commonwealth'] },
    criticalMinerals: [],
    softPower: { reachScore: 70, inboundStudentsThousands: 75, globalLanguageHost: true, notes: 'Financial hub + good-governance brand.' },
  },
  'philippines': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 60, internetPenetrationPct: 73, dataLocalization: false, notes: 'DICT cybersecurity bureau; growing capability.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 30, fxReservesMonthsImports: 8, primaryBalanceGdpPct: -3.0, notes: 'BBB rating; remittance-anchored external position.' },
    foodWater: { foodImportDependencePct: 30, waterStressIndex: 3, arableLandHaPerCapita: 0.04, cerealExporter: false, notes: 'Top global rice importer; typhoon climate risk.' },
    diplomatic: { unVotingAlignmentBlocA: 75, unVotingAlignmentBlocB: 32, defensePacts: ['PhilippinesMDT'], igoMemberships: ['ASEAN', 'RCEP'] },
    criticalMinerals: [
      { mineral: 'nickel', role: 'producer', globalSharePct: 11 },
      { mineral: 'cobalt', role: 'producer', globalSharePct: 4 },
    ],
    softPower: { reachScore: 55, inboundStudentsThousands: 40, globalLanguageHost: true, notes: 'Diaspora; English-language anchor; BPO industry.' },
  },
  'thailand': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 39, internetPenetrationPct: 88, dataLocalization: true, notes: 'NCSA + lese-majeste-driven content controls.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 38, fxReservesMonthsImports: 11, primaryBalanceGdpPct: -2.5, notes: 'BBB+ rating; tourism-leveraged recovery.' },
    foodWater: { foodImportDependencePct: -30, waterStressIndex: 3, arableLandHaPerCapita: 0.22, cerealExporter: true, notes: 'Top global rice/sugar exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 50, unVotingAlignmentBlocB: 55, defensePacts: ['ThailandMDT'], igoMemberships: ['ASEAN', 'RCEP'] },
    criticalMinerals: [],
    softPower: { reachScore: 56, inboundStudentsThousands: 35, globalLanguageHost: false, notes: 'Tourism + cuisine + Buddhism-cultural reach.' },
  },
  'indonesia': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 47, internetPenetrationPct: 78, dataLocalization: true, notes: 'BSSN agency since 2017; rising indigenous capability.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 30, fxReservesMonthsImports: 6, primaryBalanceGdpPct: -2.5, notes: 'BBB rating; rule-bound fiscal cap.' },
    foodWater: { foodImportDependencePct: 8, waterStressIndex: 3, arableLandHaPerCapita: 0.08, cerealExporter: false, notes: 'Net rice importer; palm-oil exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 28, unVotingAlignmentBlocB: 65, defensePacts: [], igoMemberships: ['G20', 'ASEAN', 'BRICSpartner', 'OIC', 'RCEP'] },
    criticalMinerals: [
      { mineral: 'nickel', role: 'producer', globalSharePct: 50 },
      { mineral: 'cobalt', role: 'producer', globalSharePct: 6 },
      { mineral: 'tungsten', role: 'producer', globalSharePct: 3 },
    ],
    softPower: { reachScore: 55, inboundStudentsThousands: 30, globalLanguageHost: false, notes: 'ASEAN-anchor narrative; world-largest Muslim-majority democracy.' },
  },
  'brazil': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 65, internetPenetrationPct: 84, dataLocalization: true, notes: 'GSI + ComDCiber; LGPD privacy regime.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 35, fxReservesMonthsImports: 16, primaryBalanceGdpPct: -2.0, notes: 'BB rating; large reserves; new fiscal framework 2023.' },
    foodWater: { foodImportDependencePct: -40, waterStressIndex: 2, arableLandHaPerCapita: 0.27, cerealExporter: true, notes: 'Top global soy/beef/coffee exporter; Amazon climate exposure.' },
    diplomatic: { unVotingAlignmentBlocA: 38, unVotingAlignmentBlocB: 60, defensePacts: ['RioTreaty'], igoMemberships: ['G20', 'BRICS', 'Mercosur', 'CELAC', 'OEI'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'reserves', globalSharePct: 16 },
      { mineral: 'lithium', role: 'producer', globalSharePct: 3 },
      { mineral: 'manganese', role: 'producer', globalSharePct: 5 },
    ],
    softPower: { reachScore: 64, inboundStudentsThousands: 25, globalLanguageHost: true, notes: 'Portuguese-language anchor; carnival/football reach.' },
  },
  'mexico': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 60, internetPenetrationPct: 78, dataLocalization: false, notes: 'CNS-CERT; growing private-sector capability.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 38, fxReservesMonthsImports: 5, primaryBalanceGdpPct: -2.5, notes: 'BBB rating; nearshoring-driven peso strength.' },
    foodWater: { foodImportDependencePct: 25, waterStressIndex: 4, arableLandHaPerCapita: 0.18, cerealExporter: false, notes: 'Net corn importer; severe northern-Mexico water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 52, unVotingAlignmentBlocB: 50, defensePacts: ['RioTreaty'], igoMemberships: ['G20', 'OECD', 'CPTPP', 'Mercosurassociate', 'CELAC'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'producer', globalSharePct: 4 },
    ],
    softPower: { reachScore: 60, inboundStudentsThousands: 18, globalLanguageHost: true, notes: 'Spanish-language anchor + cuisine + Hollywood-talent corridor.' },
  },
  'argentina': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 70, internetPenetrationPct: 87, dataLocalization: false, notes: 'CERT.ar; small specialized stack.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 75, fxReservesMonthsImports: 1.5, primaryBalanceGdpPct: -3.5, notes: 'CCC rating; recurrent IMF programs; FX-control regime.' },
    foodWater: { foodImportDependencePct: -120, waterStressIndex: 3, arableLandHaPerCapita: 0.95, cerealExporter: true, notes: 'Top global soy/beef exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 50, unVotingAlignmentBlocB: 50, defensePacts: ['RioTreaty'], igoMemberships: ['G20', 'Mercosur', 'CELAC'] },
    criticalMinerals: [
      { mineral: 'lithium', role: 'producer', globalSharePct: 6 },
    ],
    softPower: { reachScore: 60, inboundStudentsThousands: 110, globalLanguageHost: true, notes: 'Spanish-language anchor; football/cinema reach.' },
  },
  'venezuela': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 28, internetPenetrationPct: 65, dataLocalization: true, notes: 'CNTI; chronic infrastructure degradation.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 200, fxReservesMonthsImports: 3, primaryBalanceGdpPct: -5.0, notes: 'In selective-default; sanctions exposure.' },
    foodWater: { foodImportDependencePct: 60, waterStressIndex: 3, arableLandHaPerCapita: 0.08, cerealExporter: false, notes: 'Acute food insecurity; ag sector collapse.' },
    diplomatic: { unVotingAlignmentBlocA: 16, unVotingAlignmentBlocB: 88, defensePacts: [], igoMemberships: ['OPEC', 'CELAC'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'reserves', globalSharePct: 4 },
    ],
    softPower: { reachScore: 30, inboundStudentsThousands: 5, globalLanguageHost: true, notes: 'Sanctions-isolated; cultural reach diminished.' },
  },
  'south-africa': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 73, internetPenetrationPct: 75, dataLocalization: false, notes: 'CSIRT-ZA; POPIA privacy regime.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 50, fxReservesMonthsImports: 5, primaryBalanceGdpPct: -1.5, notes: 'BB- rating; load-shedding fiscal drag.' },
    foodWater: { foodImportDependencePct: -10, waterStressIndex: 4, arableLandHaPerCapita: 0.18, cerealExporter: true, notes: 'Net cereal exporter; Cape Town water-crisis precedent.' },
    diplomatic: { unVotingAlignmentBlocA: 30, unVotingAlignmentBlocB: 65, defensePacts: [], igoMemberships: ['G20', 'BRICS', 'AU', 'SADC', 'Commonwealth'] },
    criticalMinerals: [
      { mineral: 'platinumGroup', role: 'producer', globalSharePct: 70 },
      { mineral: 'manganese', role: 'producer', globalSharePct: 35 },
      { mineral: 'rareEarths', role: 'reserves', globalSharePct: 3 },
    ],
    softPower: { reachScore: 50, inboundStudentsThousands: 45, globalLanguageHost: true, notes: 'BRICS anchor + Mandela legacy reach.' },
  },
  'nigeria': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 56, internetPenetrationPct: 55, dataLocalization: false, notes: 'NITDA defensive; large fraud-actor base.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 38, fxReservesMonthsImports: 6, primaryBalanceGdpPct: -4.0, notes: 'B- rating; naira float 2023; oil-revenue sensitive.' },
    foodWater: { foodImportDependencePct: 25, waterStressIndex: 3, arableLandHaPerCapita: 0.15, cerealExporter: false, notes: 'Lake Chad climate stress; insurgency disrupts north.' },
    diplomatic: { unVotingAlignmentBlocA: 25, unVotingAlignmentBlocB: 70, defensePacts: [], igoMemberships: ['G20guest', 'AU', 'ECOWAS', 'Commonwealth', 'OPEC', 'OIC'] },
    criticalMinerals: [],
    softPower: { reachScore: 60, inboundStudentsThousands: 30, globalLanguageHost: true, notes: 'Nollywood; Afrobeats; ECOWAS-anchor.' },
  },
  'egypt': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 28, internetPenetrationPct: 71, dataLocalization: true, notes: 'EG-CERT; security-state surveillance posture.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 45, fxReservesMonthsImports: 6, primaryBalanceGdpPct: 0.0, notes: 'B- rating; IMF program; 2024 mega-investment from UAE.' },
    foodWater: { foodImportDependencePct: 50, waterStressIndex: 5, arableLandHaPerCapita: 0.025, cerealExporter: false, notes: 'World-largest wheat importer; Nile-basin water tension (GERD).' },
    diplomatic: { unVotingAlignmentBlocA: 32, unVotingAlignmentBlocB: 60, defensePacts: ['BilateralUSStrategicPartnership'], igoMemberships: ['BRICS', 'AU', 'AL', 'OIC', 'NAM'] },
    criticalMinerals: [],
    softPower: { reachScore: 55, inboundStudentsThousands: 80, globalLanguageHost: false, notes: 'Al-Azhar religious authority; Suez Canal anchor.' },
  },
  'pakistan': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'low', internetFreedomScore: 26, internetPenetrationPct: 36, dataLocalization: true, notes: 'NTISB; periodic platform shutdowns.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 38, fxReservesMonthsImports: 1.5, primaryBalanceGdpPct: -2.0, notes: 'CCC rating; recurrent IMF/Saudi/UAE bridge financing.' },
    foodWater: { foodImportDependencePct: 5, waterStressIndex: 5, arableLandHaPerCapita: 0.13, cerealExporter: true, notes: 'Top rice exporter; severe Indus-basin water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 22, unVotingAlignmentBlocB: 78, defensePacts: ['ChinaPakistanSP'], igoMemberships: ['SCO', 'OIC', 'Commonwealth', 'NAM'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'reserves', globalSharePct: 3 },
    ],
    softPower: { reachScore: 35, inboundStudentsThousands: 35, globalLanguageHost: false, notes: 'OIC role; nuclear-power identity; cricket reach.' },
  },
  'kazakhstan': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 32, internetPenetrationPct: 92, dataLocalization: true, notes: 'State CERT; 2022-unrest information lockdown precedent.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 80, fxReservesMonthsImports: 10, primaryBalanceGdpPct: 0.5, notes: 'BBB rating; National Fund commodity-anchor.' },
    foodWater: { foodImportDependencePct: -50, waterStressIndex: 4, arableLandHaPerCapita: 1.55, cerealExporter: true, notes: 'Major wheat exporter; cross-border water-stress with Uzbekistan.' },
    diplomatic: { unVotingAlignmentBlocA: 30, unVotingAlignmentBlocB: 65, defensePacts: ['CSTO'], igoMemberships: ['EAEU', 'CIS', 'SCO', 'CSTO', 'OIC'] },
    criticalMinerals: [
      { mineral: 'uranium', role: 'producer', globalSharePct: 43 },
      { mineral: 'rareEarths', role: 'reserves', globalSharePct: 3 },
    ],
    softPower: { reachScore: 35, inboundStudentsThousands: 38, globalLanguageHost: false, notes: 'Multi-vector diplomacy brand; cultural ties across CIS.' },
  },
  'norway': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 87, internetPenetrationPct: 99, dataLocalization: false, notes: 'NSM/NorCERT; Five Eyes-adjacent Nordic intel cooperation.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 145, fxReservesMonthsImports: 4.5, primaryBalanceGdpPct: 9.0, notes: 'AAA rating; sovereign wealth fund > $1.6T.' },
    foodWater: { foodImportDependencePct: 50, waterStressIndex: 1, arableLandHaPerCapita: 0.15, cerealExporter: false, notes: 'Top global salmon exporter; abundant freshwater.' },
    diplomatic: { unVotingAlignmentBlocA: 88, unVotingAlignmentBlocB: 22, defensePacts: ['NATO'], igoMemberships: ['OECD', 'NATO', 'NordicCouncil', 'EFTA'] },
    criticalMinerals: [],
    softPower: { reachScore: 70, inboundStudentsThousands: 12, globalLanguageHost: false, notes: 'Nobel Prize / mediator brand; environmental leadership.' },
  },
  'switzerland': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 87, internetPenetrationPct: 96, dataLocalization: false, notes: 'NCSC; high-profile financial-cyber target environment.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 280, fxReservesMonthsImports: 15, primaryBalanceGdpPct: 1.0, notes: 'AAA rating; reserve-currency-adjacent CHF.' },
    foodWater: { foodImportDependencePct: 50, waterStressIndex: 1, arableLandHaPerCapita: 0.04, cerealExporter: false, notes: 'Net food importer; Alpine water-tower abundance.' },
    diplomatic: { unVotingAlignmentBlocA: 70, unVotingAlignmentBlocB: 30, defensePacts: [], igoMemberships: ['OECD', 'EFTA'] },
    criticalMinerals: [],
    softPower: { reachScore: 80, inboundStudentsThousands: 60, globalLanguageHost: false, notes: 'Banking + watchmaking + Geneva multilateral hub.' },
  },
  'morocco': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 51, internetPenetrationPct: 90, dataLocalization: false, notes: 'DGSSI; Pegasus deployment history.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 60, fxReservesMonthsImports: 6, primaryBalanceGdpPct: -2.0, notes: 'BB+ rating; dirham-managed-float regime.' },
    foodWater: { foodImportDependencePct: 30, waterStressIndex: 5, arableLandHaPerCapita: 0.25, cerealExporter: false, notes: 'Severe drought stress; major phosphate exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 55, unVotingAlignmentBlocB: 45, defensePacts: [], igoMemberships: ['AU', 'AL', 'OIC'] },
    criticalMinerals: [
      { mineral: 'phosphate', role: 'producer', globalSharePct: 70 },
    ],
    softPower: { reachScore: 55, inboundStudentsThousands: 23, globalLanguageHost: false, notes: 'Mediterranean hub + monarchy continuity brand.' },
  },
  'algeria': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 28, internetPenetrationPct: 71, dataLocalization: true, notes: 'CERIST; periodic platform shutdowns during exams/crises.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 5, fxReservesMonthsImports: 16, primaryBalanceGdpPct: -1.0, notes: 'Unrated externally; gas-revenue-anchored.' },
    foodWater: { foodImportDependencePct: 60, waterStressIndex: 4, arableLandHaPerCapita: 0.18, cerealExporter: false, notes: 'Top global wheat importer; arid-Sahara water context.' },
    diplomatic: { unVotingAlignmentBlocA: 22, unVotingAlignmentBlocB: 75, defensePacts: [], igoMemberships: ['BRICSpartner', 'AU', 'AL', 'OPEC', 'OIC'] },
    criticalMinerals: [],
    softPower: { reachScore: 38, inboundStudentsThousands: 12, globalLanguageHost: false, notes: 'Liberation-era cred + Mediterranean gas anchor.' },
  },
  'iraq': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 32, internetPenetrationPct: 79, dataLocalization: false, notes: 'Iraq-CERT nascent; periodic content blocks.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 35, fxReservesMonthsImports: 11, primaryBalanceGdpPct: 0.0, notes: 'B- rating; oil-revenue-dependent budget.' },
    foodWater: { foodImportDependencePct: 50, waterStressIndex: 5, arableLandHaPerCapita: 0.15, cerealExporter: false, notes: 'Tigris-Euphrates flow stress; Turkey-Iran upstream control.' },
    diplomatic: { unVotingAlignmentBlocA: 35, unVotingAlignmentBlocB: 60, defensePacts: [], igoMemberships: ['OPEC', 'AL', 'OIC'] },
    criticalMinerals: [],
    softPower: { reachScore: 30, inboundStudentsThousands: 8, globalLanguageHost: false, notes: 'Religious-tourism flows; cultural-heritage reach.' },
  },
  'ethiopia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 27, internetPenetrationPct: 25, dataLocalization: true, notes: 'INSA; Tigray-era nationwide internet shutdowns.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 30, fxReservesMonthsImports: 1, primaryBalanceGdpPct: -2.5, notes: 'In default 2023; common-framework restructuring.' },
    foodWater: { foodImportDependencePct: 25, waterStressIndex: 4, arableLandHaPerCapita: 0.12, cerealExporter: false, notes: 'Drought + GERD water-tension with Egypt/Sudan.' },
    diplomatic: { unVotingAlignmentBlocA: 25, unVotingAlignmentBlocB: 70, defensePacts: [], igoMemberships: ['BRICS', 'AU', 'IGAD'] },
    criticalMinerals: [],
    softPower: { reachScore: 38, inboundStudentsThousands: 8, globalLanguageHost: false, notes: 'AU-headquarters; coffee origin-of-cultivation reach.' },
  },
  'kenya': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 66, internetPenetrationPct: 42, dataLocalization: false, notes: 'KE-CIRT; mobile-money cyber posture.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 35, fxReservesMonthsImports: 3.5, primaryBalanceGdpPct: -1.5, notes: 'B rating; IMF program; 2024 Eurobond rollover.' },
    foodWater: { foodImportDependencePct: 30, waterStressIndex: 4, arableLandHaPerCapita: 0.10, cerealExporter: false, notes: 'Recurrent drought; net food importer.' },
    diplomatic: { unVotingAlignmentBlocA: 35, unVotingAlignmentBlocB: 60, defensePacts: [], igoMemberships: ['AU', 'EAC', 'IGAD', 'Commonwealth'] },
    criticalMinerals: [],
    softPower: { reachScore: 50, inboundStudentsThousands: 8, globalLanguageHost: false, notes: 'East-Africa hub + safari/wildlife brand.' },
  },
  'north-korea': {
    cyber: { offensiveTier: 'high', defensiveTier: 'low', internetFreedomScore: 0, internetPenetrationPct: 1, dataLocalization: true, notes: 'Lazarus / Kimsuky / APT38; crypto-theft revenue program.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 35, fxReservesMonthsImports: 1, primaryBalanceGdpPct: -3.0, notes: 'Sanctions-isolated; opaque accounts.' },
    foodWater: { foodImportDependencePct: 25, waterStressIndex: 3, arableLandHaPerCapita: 0.07, cerealExporter: false, notes: 'Chronic food insecurity; flood/drought cycles.' },
    diplomatic: { unVotingAlignmentBlocA: 5, unVotingAlignmentBlocB: 95, defensePacts: ['DPRKTreaty'], igoMemberships: ['UN'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'reserves', globalSharePct: 3 },
      { mineral: 'tungsten', role: 'producer', globalSharePct: 1 },
    ],
    softPower: { reachScore: 8, inboundStudentsThousands: 1, globalLanguageHost: false, notes: 'Sanctions-isolated; minimal cultural projection.' },
  },
  'cuba': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 22, internetPenetrationPct: 70, dataLocalization: true, notes: 'Constrained-internet posture; ETECSA monopoly.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 35, fxReservesMonthsImports: 2, primaryBalanceGdpPct: -8.0, notes: 'Sanctions-isolated; FX rationing; Paris Club arrears.' },
    foodWater: { foodImportDependencePct: 70, waterStressIndex: 2, arableLandHaPerCapita: 0.27, cerealExporter: false, notes: 'High food-import dependence; diesel/fuel shortages cripple ag.' },
    diplomatic: { unVotingAlignmentBlocA: 12, unVotingAlignmentBlocB: 88, defensePacts: [], igoMemberships: ['ALBA', 'CELAC'] },
    criticalMinerals: [
      { mineral: 'nickel', role: 'producer', globalSharePct: 3 },
      { mineral: 'cobalt', role: 'producer', globalSharePct: 4 },
    ],
    softPower: { reachScore: 40, inboundStudentsThousands: 10, globalLanguageHost: true, notes: 'Medical-diplomacy + revolutionary-narrative reach.' },
  },
};
