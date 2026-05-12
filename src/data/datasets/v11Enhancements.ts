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
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 97, fxReservesMonthsImports: 0.7, primaryBalanceGdpPct: -3.2, notes: 'Reserve-currency issuer; deficit-financed at ultra-low spreads.' },
    foodWater: { foodImportDependencePct: -25, waterStressIndex: 3, arableLandHaPerCapita: 0.47, cerealExporter: true, notes: 'Major grain/soy exporter; Colorado/Ogallala basin stress.' },
    diplomatic: { unVotingAlignmentBlocA: 100, unVotingAlignmentBlocB: 18, defensePacts: ['NATO', 'AUKUS', 'ANZUS', 'JapanMDT', 'ROKMDT', 'PhilippinesMDT', 'RioTreaty'], igoMemberships: ['G7', 'G20', 'OECD', 'UNSC-P5', 'IMF', 'WTO', 'WorldBank', 'NATO'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'producer', globalSharePct: 12 },
      { mineral: 'lithium', role: 'reserves', globalSharePct: 4 },
      { mineral: 'copper', role: 'producer', globalSharePct: 5 },
      { mineral: 'uranium', role: 'consumer', globalSharePct: 25 },
    ],
    softPower: { reachScore: 93, inboundStudentsThousands: 1015, globalLanguageHost: true, notes: 'Hollywood + tech ecosystem + reserve currency.' },
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
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 18, fxReservesMonthsImports: 11.5, primaryBalanceGdpPct: -3.3, notes: 'BBB- (lowest IG); large reserves; structural fiscal deficit.' },
    foodWater: { foodImportDependencePct: 8, waterStressIndex: 4, arableLandHaPerCapita: 0.11, cerealExporter: true, notes: 'Top rice exporter; Punjab/Haryana groundwater crisis.' },
    diplomatic: { unVotingAlignmentBlocA: 36, unVotingAlignmentBlocB: 54, defensePacts: ['IndiaRussiaSP'], igoMemberships: ['G20', 'BRICS', 'SCO', 'Quad', 'Commonwealth', 'IORA'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'reserves', globalSharePct: 6 },
    ],
    softPower: { reachScore: 69, inboundStudentsThousands: 75, globalLanguageHost: true, notes: 'Bollywood reach; Hindi/English language anchor; diaspora.' },
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

  'afghanistan': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 6, internetPenetrationPct: 18, dataLocalization: false, notes: 'Taliban regime; near-total internet repression, minimal infrastructure.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 8, fxReservesMonthsImports: 0.5, primaryBalanceGdpPct: -12.0, notes: 'Aid-dependent; frozen reserves; collapsing formal economy.' },
    foodWater: { foodImportDependencePct: 38, waterStressIndex: 4, arableLandHaPerCapita: 0.23, cerealExporter: false, notes: 'Chronic food insecurity; drought-prone; irrigation collapse.' },
    diplomatic: { unVotingAlignmentBlocA: 10, unVotingAlignmentBlocB: 55, defensePacts: [], igoMemberships: ['OIC', 'ECO', 'SAARC'] },
    criticalMinerals: [
      { mineral: 'lithium', role: 'reserves', globalSharePct: 2 },
      { mineral: 'copper', role: 'reserves', globalSharePct: 1 },
      { mineral: 'rareEarths', role: 'reserves', globalSharePct: 1 },
    ],
    softPower: { reachScore: 5, globalLanguageHost: false, notes: 'Pariah state; near-zero soft power projection.' },
  },

  'albania': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 68, internetPenetrationPct: 79, dataLocalization: false, notes: 'NATO member; EU accession driving cyber reforms after 2022 Iranian hack.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 62, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -1.5, notes: 'Remittances-supported; improving fiscal trajectory.' },
    foodWater: { foodImportDependencePct: 30, waterStressIndex: 2, arableLandHaPerCapita: 0.21, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 85, unVotingAlignmentBlocB: 22, defensePacts: ['NATO'], igoMemberships: ['NATO', 'OSCE', 'OIC'] },
    softPower: { reachScore: 22, globalLanguageHost: false, notes: 'EU accession candidate; diaspora leverage.' },
  },

  'angola': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 40, internetPenetrationPct: 36, dataLocalization: false, notes: 'Limited cyber capacity; growing digital infrastructure.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 88, fxReservesMonthsImports: 7, primaryBalanceGdpPct: 2.5, notes: 'Oil-revenue dependent; Chinese debt significant.' },
    foodWater: { foodImportDependencePct: 45, waterStressIndex: 2, arableLandHaPerCapita: 0.42, cerealExporter: false, notes: 'High import dependence despite large arable land potential.' },
    diplomatic: { unVotingAlignmentBlocA: 32, unVotingAlignmentBlocB: 65, defensePacts: ['AU'], igoMemberships: ['AU', 'SADC', 'OPEC', 'CPLP'] },
    criticalMinerals: [
      { mineral: 'manganese', role: 'producer', globalSharePct: 1 },
    ],
    softPower: { reachScore: 20, globalLanguageHost: false, notes: 'Oil diplomacy; Lusophone cultural links.' },
  },

  'armenia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 62, internetPenetrationPct: 79, dataLocalization: false, notes: 'Improving post-CSTO fallout; tech sector growing.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 72, fxReservesMonthsImports: 4.5, primaryBalanceGdpPct: -2.0 },
    foodWater: { foodImportDependencePct: 40, waterStressIndex: 3, arableLandHaPerCapita: 0.15, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 42, unVotingAlignmentBlocB: 58, defensePacts: [], igoMemberships: ['CSTO', 'EAEU', 'CIS', 'CoE', 'OSCE'] },
    softPower: { reachScore: 28, globalLanguageHost: false, notes: 'Diaspora in France, US, Russia; genocide recognition diplomacy.' },
  },

  'austria': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 82, internetPenetrationPct: 92, dataLocalization: false, notes: 'EU hub; strong GDPR enforcement; Vienna as diplomatic hub.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 78, fxReservesMonthsImports: 5, primaryBalanceGdpPct: -1.2 },
    foodWater: { foodImportDependencePct: 15, waterStressIndex: 1, arableLandHaPerCapita: 0.18, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 80, unVotingAlignmentBlocB: 28, defensePacts: [], igoMemberships: ['EU', 'OSCE', 'OECD', 'CoE'] },
    softPower: { reachScore: 62, inboundStudentsThousands: 90, globalLanguageHost: true, notes: 'Vienna-based multilateral institutions; classical music heritage.' },
  },

  'azerbaijan': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 30, internetPenetrationPct: 85, dataLocalization: true, notes: 'Authoritarian digital control; Israeli cyber-tool imports.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 18, fxReservesMonthsImports: 12, primaryBalanceGdpPct: 3.5, notes: 'SOFAZ SWF buffers; oil/gas dependent.' },
    foodWater: { foodImportDependencePct: 25, waterStressIndex: 3, arableLandHaPerCapita: 0.22, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 38, unVotingAlignmentBlocB: 58, defensePacts: [], igoMemberships: ['CIS', 'OIC', 'OSCE', 'NAM'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'producer', globalSharePct: 0.3 },
    ],
    softPower: { reachScore: 30, globalLanguageHost: false, notes: 'Energy corridor leverage; Aliyev brand diplomacy; COP29 host.' },
  },

  'bahrain': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 25, internetPenetrationPct: 99, dataLocalization: false, notes: 'NSO Pegasus use documented; US 5th Fleet host.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 128, fxReservesMonthsImports: 3, primaryBalanceGdpPct: -4.0, notes: 'High debt but GCC backstop; oil revenue declining.' },
    foodWater: { foodImportDependencePct: 90, waterStressIndex: 5, arableLandHaPerCapita: 0.01, cerealExporter: false, notes: 'Nearly all food imported; desalination-dependent.' },
    diplomatic: { unVotingAlignmentBlocA: 58, unVotingAlignmentBlocB: 48, defensePacts: ['GCC'], igoMemberships: ['GCC', 'AL', 'OIC', 'NAM'] },
    softPower: { reachScore: 28, globalLanguageHost: false, notes: 'Financial services hub; F1 Grand Prix; US base.' },
  },

  'bangladesh': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 40, internetPenetrationPct: 44, dataLocalization: false, notes: 'Central bank hack 2016; growing digital infrastructure.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 22, fxReservesMonthsImports: 3, primaryBalanceGdpPct: -3.5, notes: 'FX reserves strained post-2022; IMF programme.' },
    foodWater: { foodImportDependencePct: 12, waterStressIndex: 3, arableLandHaPerCapita: 0.06, cerealExporter: false, notes: 'Rice self-sufficient mostly; Ganges water-sharing tensions with India.' },
    diplomatic: { unVotingAlignmentBlocA: 32, unVotingAlignmentBlocB: 65, defensePacts: [], igoMemberships: ['SAARC', 'OIC', 'Commonwealth', 'NAM'] },
    softPower: { reachScore: 22, globalLanguageHost: false, notes: 'Garment diplomacy; UN peacekeeping top contributor.' },
  },

  'belarus': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 18, internetPenetrationPct: 83, dataLocalization: true, notes: 'KGB cyber ops; Lukashenko regime; tight internet control.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 78, fxReservesMonthsImports: 3, primaryBalanceGdpPct: -2.0, notes: 'Western-sanctioned; Russian subsidy dependent.' },
    foodWater: { foodImportDependencePct: -10, waterStressIndex: 1, arableLandHaPerCapita: 0.56, cerealExporter: true, notes: 'Net food exporter; potash fertilizer major producer.' },
    diplomatic: { unVotingAlignmentBlocA: 8, unVotingAlignmentBlocB: 92, defensePacts: ['CSTO'], igoMemberships: ['CSTO', 'EAEU', 'CIS', 'SCO'] },
    criticalMinerals: [
      { mineral: 'potash', role: 'producer', globalSharePct: 18 },
    ],
    softPower: { reachScore: 12, globalLanguageHost: false, notes: 'Internationally isolated regime; Russian proxy; sanctions isolation.' },
  },

  'belgium': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 84, internetPenetrationPct: 93, dataLocalization: false, notes: 'NATO HQ host; CCB leads national cyber policy; EU institutions hub.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 106, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -3.5 },
    foodWater: { foodImportDependencePct: 10, waterStressIndex: 2, arableLandHaPerCapita: 0.08, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 88, unVotingAlignmentBlocB: 20, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OECD', 'CoE', 'G10'] },
    softPower: { reachScore: 62, inboundStudentsThousands: 50, globalLanguageHost: true, notes: 'NATO/EU headquarters; multilateral convening power.' },
  },

  'bolivia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 62, internetPenetrationPct: 57, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 55, fxReservesMonthsImports: 2.5, primaryBalanceGdpPct: -8.0, notes: 'FX reserves depleted; gas revenue declining.' },
    foodWater: { foodImportDependencePct: -5, waterStressIndex: 2, arableLandHaPerCapita: 0.42, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 28, unVotingAlignmentBlocB: 68, defensePacts: [], igoMemberships: ['CELAC', 'ALBA', 'Mercosur', 'OAS', 'NAM'] },
    criticalMinerals: [
      { mineral: 'lithium', role: 'reserves', globalSharePct: 21 },
      { mineral: 'potash', role: 'reserves', globalSharePct: 1 },
    ],
    softPower: { reachScore: 18, globalLanguageHost: false, notes: 'Lithium diplomacy; ALBA alignment.' },
  },

  'bosnia-and-herzegovina': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 65, internetPenetrationPct: 75, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 52, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -1.0 },
    foodWater: { foodImportDependencePct: 28, waterStressIndex: 1, arableLandHaPerCapita: 0.28, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 72, unVotingAlignmentBlocB: 38, defensePacts: [], igoMemberships: ['OSCE', 'CoE'], pendingAccession: ['EU', 'NATO'] },
    softPower: { reachScore: 15, globalLanguageHost: false, notes: 'EU candidate; Dayton accord legacy; Republika Srpska Russia alignment complicates.' },
  },

  'botswana': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 65, internetPenetrationPct: 68, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 22, fxReservesMonthsImports: 8, primaryBalanceGdpPct: -3.0, notes: 'Diamond-revenue buffered; solid reserves.' },
    foodWater: { foodImportDependencePct: 40, waterStressIndex: 4, arableLandHaPerCapita: 0.16, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 52, unVotingAlignmentBlocB: 45, defensePacts: ['AU'], igoMemberships: ['AU', 'SADC', 'Commonwealth', 'NAM'] },
    criticalMinerals: [
      { mineral: 'manganese', role: 'producer', globalSharePct: 1 },
      { mineral: 'copper', role: 'producer', globalSharePct: 0.5 },
    ],
    softPower: { reachScore: 28, globalLanguageHost: false, notes: 'Diamond industry diplomacy; democratic governance model.' },
  },

  'brunei': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 45, internetPenetrationPct: 96, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 3, fxReservesMonthsImports: 20, primaryBalanceGdpPct: 5.0, notes: 'Tiny debt; BIA SWF; oil/gas rich.' },
    foodWater: { foodImportDependencePct: 75, waterStressIndex: 1, arableLandHaPerCapita: 0.05, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 42, unVotingAlignmentBlocB: 55, defensePacts: ['ASEAN'], igoMemberships: ['ASEAN', 'RCEP', 'OIC', 'Commonwealth', 'NAM'] },
    criticalMinerals: [],
    softPower: { reachScore: 18, globalLanguageHost: false, notes: 'Sultanate energy diplomacy; ASEAN membership.' },
  },

  'bulgaria': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 68, internetPenetrationPct: 78, dataLocalization: false, notes: 'NATO/EU member; 2019 NRA data breach; IT sector growing.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 58, fxReservesMonthsImports: 6, primaryBalanceGdpPct: -2.0 },
    foodWater: { foodImportDependencePct: -5, waterStressIndex: 2, arableLandHaPerCapita: 0.44, cerealExporter: true },
    diplomatic: { unVotingAlignmentBlocA: 82, unVotingAlignmentBlocB: 25, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'CoE'] },
    softPower: { reachScore: 28, inboundStudentsThousands: 12, globalLanguageHost: false },
  },

  'burkina-faso': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 42, internetPenetrationPct: 22, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 58, fxReservesMonthsImports: 2, primaryBalanceGdpPct: -6.0, notes: 'Junta rule; jihadist insurgency; aid flows disrupted.' },
    foodWater: { foodImportDependencePct: 15, waterStressIndex: 3, arableLandHaPerCapita: 0.36, cerealExporter: false, notes: 'Food crisis; displacement from Sahel conflict.' },
    diplomatic: { unVotingAlignmentBlocA: 18, unVotingAlignmentBlocB: 75, defensePacts: ['AES'], igoMemberships: ['AU', 'AES', 'OIC', 'NAM'] },
    softPower: { reachScore: 8, globalLanguageHost: false, notes: 'Junta-led; regionally isolated; France expulsion signal.' },
  },

  'cambodia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 32, internetPenetrationPct: 60, dataLocalization: false, notes: 'Hun Sen/Hun Manet dynasty; internet suppression; scam compound hub.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 35, fxReservesMonthsImports: 8, primaryBalanceGdpPct: -4.5, notes: 'Chinese FDI heavy; garment-export dependent.' },
    foodWater: { foodImportDependencePct: -5, waterStressIndex: 2, arableLandHaPerCapita: 0.30, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 22, unVotingAlignmentBlocB: 78, defensePacts: ['ASEAN'], igoMemberships: ['ASEAN', 'RCEP', 'NAM'] },
    softPower: { reachScore: 18, globalLanguageHost: false, notes: 'Angkor Wat tourism; Chinese-aligned government.' },
  },

  'cameroon': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 38, internetPenetrationPct: 35, dataLocalization: false, notes: 'Internet shutdowns in Anglophone regions; Biya regime.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 48, fxReservesMonthsImports: 3, primaryBalanceGdpPct: -2.5 },
    foodWater: { foodImportDependencePct: 15, waterStressIndex: 2, arableLandHaPerCapita: 0.35, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 35, unVotingAlignmentBlocB: 60, defensePacts: ['AU'], igoMemberships: ['AU', 'CEMAC', 'OIC', 'Commonwealth', 'NAM'] },
    criticalMinerals: [
      { mineral: 'cobalt', role: 'producer', globalSharePct: 0.2 },
    ],
    softPower: { reachScore: 18, globalLanguageHost: true, notes: 'Bilingual (FR/EN); Francophone Africa influence.' },
  },

  'chile': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 70, internetPenetrationPct: 90, dataLocalization: false, notes: 'CSIRT-GOB national team; data protection reform.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 88, fxReservesMonthsImports: 8, primaryBalanceGdpPct: -1.5, notes: 'Copper stabilisation fund; investment-grade LatAm anchor.' },
    foodWater: { foodImportDependencePct: -15, waterStressIndex: 3, arableLandHaPerCapita: 0.09, cerealExporter: false, notes: 'Net food exporter (fruit, wine, salmon); Atacama water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 65, unVotingAlignmentBlocB: 38, defensePacts: [], igoMemberships: ['CELAC', 'APEC', 'OECD', 'OAS', 'CPTPP'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'producer', globalSharePct: 27 },
      { mineral: 'lithium', role: 'producer', globalSharePct: 26 },
    ],
    softPower: { reachScore: 42, inboundStudentsThousands: 14, globalLanguageHost: false, notes: 'OECD member; copper/lithium diplomacy; democratic model.' },
  },

  'colombia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 65, internetPenetrationPct: 73, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 58, fxReservesMonthsImports: 6, primaryBalanceGdpPct: -3.5 },
    foodWater: { foodImportDependencePct: 5, waterStressIndex: 2, arableLandHaPerCapita: 0.12, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 62, unVotingAlignmentBlocB: 40, defensePacts: [], igoMemberships: ['OAS', 'CELAC', 'APEC', 'OECD', 'NAM'] },
    criticalMinerals: [
      { mineral: 'nickel', role: 'producer', globalSharePct: 2 },
      { mineral: 'copper', role: 'producer', globalSharePct: 0.5 },
    ],
    softPower: { reachScore: 35, inboundStudentsThousands: 8, globalLanguageHost: false, notes: 'Peace process diplomacy; coca-leaf narrative.' },
  },

  'costa-rica': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 72, internetPenetrationPct: 85, dataLocalization: false, notes: '2022 Conti ransomware national emergency; post-attack reforms.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 70, fxReservesMonthsImports: 5, primaryBalanceGdpPct: 1.0, notes: 'Fiscal reform 2019; primary surplus achieved.' },
    foodWater: { foodImportDependencePct: -10, waterStressIndex: 1, arableLandHaPerCapita: 0.10, cerealExporter: false, notes: 'Net food exporter; tropical ag.' },
    diplomatic: { unVotingAlignmentBlocA: 72, unVotingAlignmentBlocB: 30, defensePacts: [], igoMemberships: ['OAS', 'CELAC', 'SICA', 'OECD', 'CPTPP'] },
    softPower: { reachScore: 40, inboundStudentsThousands: 6, globalLanguageHost: false, notes: 'Eco-tourism brand; no army; green energy pioneer.' },
  },

  'cote-divoire': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 48, internetPenetrationPct: 46, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 62, fxReservesMonthsImports: 3.5, primaryBalanceGdpPct: -2.0, notes: 'CFA franc; cocoa-revenue dependent.' },
    foodWater: { foodImportDependencePct: -20, waterStressIndex: 2, arableLandHaPerCapita: 0.28, cerealExporter: false, notes: 'World\'s largest cocoa exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 42, unVotingAlignmentBlocB: 55, defensePacts: ['AU'], igoMemberships: ['AU', 'ECOWAS', 'OIC', 'NAM'] },
    criticalMinerals: [
      { mineral: 'manganese', role: 'producer', globalSharePct: 0.5 },
    ],
    softPower: { reachScore: 22, globalLanguageHost: true, notes: 'WAEMU economic hub; Abidjan financial centre.' },
  },

  'croatia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 72, internetPenetrationPct: 83, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 72, fxReservesMonthsImports: 6, primaryBalanceGdpPct: 0.5, notes: 'Euro adopted 2023; Schengen accession.' },
    foodWater: { foodImportDependencePct: 10, waterStressIndex: 1, arableLandHaPerCapita: 0.22, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 84, unVotingAlignmentBlocB: 24, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'CoE'] },
    softPower: { reachScore: 32, inboundStudentsThousands: 8, globalLanguageHost: false, notes: 'Tourism (Dalmatian coast); EU/NATO member.' },
  },

  'cyprus': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 76, internetPenetrationPct: 88, dataLocalization: false, notes: 'EU member; financial services hub; regional tension with Turkey.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 90, fxReservesMonthsImports: 5, primaryBalanceGdpPct: 1.5, notes: 'Post-2013 bail-in recovery; banking restructured.' },
    foodWater: { foodImportDependencePct: 55, waterStressIndex: 4, arableLandHaPerCapita: 0.11, cerealExporter: false, notes: 'High food import dependence; severe water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 78, unVotingAlignmentBlocB: 30, defensePacts: [], igoMemberships: ['EU', 'OSCE', 'CoE', 'Commonwealth', 'NAM'] },
    softPower: { reachScore: 30, globalLanguageHost: false, notes: 'Financial services centre; Russia-linked capital historical flows.' },
  },

  'czechia': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 78, internetPenetrationPct: 88, dataLocalization: false, notes: 'NUKIB national cyber authority; strong EU/NATO alignment; Huawei ban.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 40, fxReservesMonthsImports: 6, primaryBalanceGdpPct: -2.5 },
    foodWater: { foodImportDependencePct: 8, waterStressIndex: 2, arableLandHaPerCapita: 0.30, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 86, unVotingAlignmentBlocB: 22, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'OECD', 'CoE'] },
    softPower: { reachScore: 40, inboundStudentsThousands: 45, globalLanguageHost: false, notes: 'Prague tech hub; Velvet Revolution democratic brand.' },
  },

  'dem-rep-congo': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 35, internetPenetrationPct: 28, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 28, fxReservesMonthsImports: 1.5, primaryBalanceGdpPct: -4.0, notes: 'Ongoing conflict; humanitarian crisis; aid dependent.' },
    foodWater: { foodImportDependencePct: 20, waterStressIndex: 1, arableLandHaPerCapita: 0.30, cerealExporter: false, notes: 'Congo River basin; vast arable land but conflict disrupts.' },
    diplomatic: { unVotingAlignmentBlocA: 30, unVotingAlignmentBlocB: 62, defensePacts: ['AU'], igoMemberships: ['AU', 'SADC', 'CEEAC', 'OIF', 'NAM'] },
    criticalMinerals: [
      { mineral: 'cobalt', role: 'producer', globalSharePct: 70 },
      { mineral: 'copper', role: 'producer', globalSharePct: 8 },
      { mineral: 'manganese', role: 'producer', globalSharePct: 1 },
    ],
    softPower: { reachScore: 12, globalLanguageHost: true, notes: 'French-language cultural ties; cobalt leverage.' },
  },

  'denmark': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 88, internetPenetrationPct: 98, dataLocalization: false, notes: 'CFCS intelligence integration; Greenland strategic significance.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 35, fxReservesMonthsImports: 6, primaryBalanceGdpPct: 2.5 },
    foodWater: { foodImportDependencePct: -25, waterStressIndex: 1, arableLandHaPerCapita: 0.44, cerealExporter: true, notes: 'Major pork/dairy exporter; net food exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 90, unVotingAlignmentBlocB: 18, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OECD', 'CoE', 'Nordic Council'] },
    softPower: { reachScore: 60, inboundStudentsThousands: 30, globalLanguageHost: false, notes: 'Greenland/Arctic strategic asset; Nordic model diplomacy.' },
  },

  'dominican-republic': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 62, internetPenetrationPct: 80, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 60, fxReservesMonthsImports: 4.5, primaryBalanceGdpPct: -1.0 },
    foodWater: { foodImportDependencePct: 25, waterStressIndex: 2, arableLandHaPerCapita: 0.10, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 68, unVotingAlignmentBlocB: 35, defensePacts: [], igoMemberships: ['OAS', 'CELAC', 'SICA', 'CARICOM'] },
    softPower: { reachScore: 25, globalLanguageHost: false, notes: 'Tourism hub; baseball diplomacy; Caribbean leadership.' },
  },

  'ecuador': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 62, internetPenetrationPct: 68, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 58, fxReservesMonthsImports: 3, primaryBalanceGdpPct: -2.0, notes: 'Dollarised economy; IMF programme; oil dependent.' },
    foodWater: { foodImportDependencePct: -10, waterStressIndex: 2, arableLandHaPerCapita: 0.08, cerealExporter: false, notes: 'Banana, shrimp, cocoa net exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 55, unVotingAlignmentBlocB: 42, defensePacts: [], igoMemberships: ['OAS', 'CELAC', 'CAN', 'UNASUR'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'producer', globalSharePct: 0.5 },
    ],
    softPower: { reachScore: 22, globalLanguageHost: false, notes: 'Galapagos eco-diplomacy; banana export leverage.' },
  },

  'estonia': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 88, internetPenetrationPct: 93, dataLocalization: false, notes: 'Post-2007 attack global cyber leader; NATO CCDCOE HQ Tallinn; e-governance pioneer.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 20, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -2.0 },
    foodWater: { foodImportDependencePct: 10, waterStressIndex: 1, arableLandHaPerCapita: 0.40, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 92, unVotingAlignmentBlocB: 15, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'OECD', 'CoE'] },
    softPower: { reachScore: 45, globalLanguageHost: false, notes: 'Digital-nation brand; Skype birthplace; Tallinn Manual soft power.' },
  },

  'finland': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 90, internetPenetrationPct: 95, dataLocalization: false, notes: 'TRAFICOM NCSC-FI; NATO member 2023; Nordic cyber cooperation.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 44, fxReservesMonthsImports: 5, primaryBalanceGdpPct: -2.5 },
    foodWater: { foodImportDependencePct: 5, waterStressIndex: 1, arableLandHaPerCapita: 0.42, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 90, unVotingAlignmentBlocB: 18, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'OECD', 'CoE', 'Nordic Council'] },
    softPower: { reachScore: 55, inboundStudentsThousands: 20, globalLanguageHost: false, notes: 'Education model (PISA); Nordic brand; Nokia legacy.' },
  },

  'georgia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 62, internetPenetrationPct: 75, dataLocalization: false, notes: '2008 cyberattacks during Russian war; developing CERT capacity.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 102, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -2.5, notes: 'Russia-linked oligarch influence; IMF-supported.' },
    foodWater: { foodImportDependencePct: 35, waterStressIndex: 2, arableLandHaPerCapita: 0.12, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 52, unVotingAlignmentBlocB: 45, defensePacts: [], igoMemberships: ['CoE', 'OSCE', 'GUAM'], pendingAccession: ['EU', 'NATO'] },
    softPower: { reachScore: 25, globalLanguageHost: false, notes: 'Wine/tourism brand; EU candidate; contested between blocs.' },
  },

  'ghana': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 62, internetPenetrationPct: 55, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 98, fxReservesMonthsImports: 2, primaryBalanceGdpPct: -3.0, notes: 'IMF bailout 2023; domestic debt exchange; recovery track.' },
    foodWater: { foodImportDependencePct: 15, waterStressIndex: 2, arableLandHaPerCapita: 0.18, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 48, unVotingAlignmentBlocB: 48, defensePacts: ['AU'], igoMemberships: ['AU', 'ECOWAS', 'Commonwealth', 'NAM'] },
    criticalMinerals: [
      { mineral: 'manganese', role: 'producer', globalSharePct: 2 },
      { mineral: 'graphite', role: 'producer', globalSharePct: 1 },
    ],
    softPower: { reachScore: 30, inboundStudentsThousands: 6, globalLanguageHost: false, notes: 'Pan-African hub; stable democracy brand; Year of Return diaspora.' },
  },

  'greece': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 72, internetPenetrationPct: 85, dataLocalization: false, notes: 'Predator spyware scandal; NATO/EU member; Hellenic NCSA.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 168, fxReservesMonthsImports: 3, primaryBalanceGdpPct: 2.0, notes: 'Post-Troika recovery; highest debt/GDP in EU.' },
    foodWater: { foodImportDependencePct: 10, waterStressIndex: 3, arableLandHaPerCapita: 0.22, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 82, unVotingAlignmentBlocB: 26, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'OECD', 'CoE'] },
    softPower: { reachScore: 50, inboundStudentsThousands: 35, globalLanguageHost: false, notes: 'Classical heritage diplomacy; Orthodox Church reach; shipping power.' },
  },

  'guatemala': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 58, internetPenetrationPct: 52, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 30, fxReservesMonthsImports: 5, primaryBalanceGdpPct: -1.5 },
    foodWater: { foodImportDependencePct: -5, waterStressIndex: 2, arableLandHaPerCapita: 0.08, cerealExporter: false, notes: 'Coffee/banana exporter; inequality undermines food security.' },
    diplomatic: { unVotingAlignmentBlocA: 65, unVotingAlignmentBlocB: 35, defensePacts: [], igoMemberships: ['OAS', 'CELAC', 'SICA', 'CACM'] },
    softPower: { reachScore: 18, globalLanguageHost: false },
  },

  'hungary': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 62, internetPenetrationPct: 88, dataLocalization: false, notes: 'Pegasus spyware use against journalists; Orbán-aligned digital policy.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 68, fxReservesMonthsImports: 5, primaryBalanceGdpPct: -4.5, notes: 'High deficit; EU funds withheld over rule-of-law; forint volatility.' },
    foodWater: { foodImportDependencePct: -20, waterStressIndex: 2, arableLandHaPerCapita: 0.44, cerealExporter: true },
    diplomatic: { unVotingAlignmentBlocA: 62, unVotingAlignmentBlocB: 48, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'OECD', 'CoE'] },
    criticalMinerals: [
      { mineral: 'lithium', role: 'processor', globalSharePct: 0 },
    ],
    softPower: { reachScore: 32, inboundStudentsThousands: 25, globalLanguageHost: false, notes: 'Orbán illiberal-democratic export; Budapest as alternative EU capital.' },
  },

  'iceland': {
    cyber: { offensiveTier: 'low', defensiveTier: 'high', internetFreedomScore: 92, internetPenetrationPct: 99, dataLocalization: false, notes: 'CERT-IS; data centre hub due to geothermal; strong press freedom.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 68, fxReservesMonthsImports: 5, primaryBalanceGdpPct: -0.5 },
    foodWater: { foodImportDependencePct: -30, waterStressIndex: 1, arableLandHaPerCapita: 1.20, cerealExporter: false, notes: 'Major fish exporter; abundant freshwater.' },
    diplomatic: { unVotingAlignmentBlocA: 88, unVotingAlignmentBlocB: 20, defensePacts: ['NATO'], igoMemberships: ['NATO', 'OSCE', 'OECD', 'CoE', 'Nordic Council', 'EEA'] },
    softPower: { reachScore: 40, globalLanguageHost: false, notes: 'Arctic Council; renewable energy model; fishing rights diplomacy.' },
  },

  'ireland': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 86, internetPenetrationPct: 94, dataLocalization: false, notes: 'NCSC Ireland; EU Big Tech DPA lead regulator (GDPR); HSE ransomware 2021.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 42, fxReservesMonthsImports: 5, primaryBalanceGdpPct: 4.0, notes: 'Corporate-tax surplus; Apple tax windfall; GDP distorted by MNC.' },
    foodWater: { foodImportDependencePct: -20, waterStressIndex: 1, arableLandHaPerCapita: 0.30, cerealExporter: false, notes: 'Major dairy/beef exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 82, unVotingAlignmentBlocB: 25, defensePacts: [], igoMemberships: ['EU', 'OECD', 'CoE', 'Commonwealth'] },
    softPower: { reachScore: 55, inboundStudentsThousands: 35, globalLanguageHost: true, notes: 'Global Irish diaspora; EU Big Tech hub; English-language advantage.' },
  },

  'jordan': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 35, internetPenetrationPct: 85, dataLocalization: false, notes: 'US-supported cyber reforms; NSO Pegasus use documented.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 112, fxReservesMonthsImports: 7, primaryBalanceGdpPct: -2.5, notes: 'Donor-dependent; Gulf grants; IMF programme.' },
    foodWater: { foodImportDependencePct: 85, waterStressIndex: 5, arableLandHaPerCapita: 0.02, cerealExporter: false, notes: 'World\'s second-most water-scarce country; 90%+ food imported.' },
    diplomatic: { unVotingAlignmentBlocA: 55, unVotingAlignmentBlocB: 48, defensePacts: [], igoMemberships: ['AL', 'OIC', 'NAM'] },
    criticalMinerals: [
      { mineral: 'phosphate', role: 'producer', globalSharePct: 8 },
    ],
    softPower: { reachScore: 35, globalLanguageHost: false, notes: 'Hashemite legitimacy; refugee-hosting capacity; Palestinian issue centrality.' },
  },

  'kosovo': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 70, internetPenetrationPct: 91, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 22, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -2.0, notes: 'Euro-ised; remittance-dependent; EU and US partial recognition.' },
    foodWater: { foodImportDependencePct: 40, waterStressIndex: 2, arableLandHaPerCapita: 0.14, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 80, unVotingAlignmentBlocB: 28, defensePacts: [], igoMemberships: ['IMF', 'WB'], pendingAccession: ['EU', 'NATO', 'UN'] },
    softPower: { reachScore: 12, globalLanguageHost: false, notes: 'US/NATO dependency; limited UN membership; Serbian dispute.' },
  },

  'kuwait': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 30, internetPenetrationPct: 99, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 12, fxReservesMonthsImports: 24, primaryBalanceGdpPct: 8.0, notes: 'KIA SWF among world\'s largest; oil-funded surpluses.' },
    foodWater: { foodImportDependencePct: 92, waterStressIndex: 5, arableLandHaPerCapita: 0.01, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 55, unVotingAlignmentBlocB: 48, defensePacts: ['GCC'], igoMemberships: ['GCC', 'AL', 'OIC', 'OPEC', 'NAM'] },
    softPower: { reachScore: 35, globalLanguageHost: false, notes: 'SWF financial diplomacy; Palestinian solidarity; Gulf mediation role.' },
  },

  'kyrgyzstan': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 38, internetPenetrationPct: 48, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 68, fxReservesMonthsImports: 3.5, primaryBalanceGdpPct: -4.0, notes: 'Remittance-dependent; gold-mining revenue; China debt.' },
    foodWater: { foodImportDependencePct: 30, waterStressIndex: 2, arableLandHaPerCapita: 0.26, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 22, unVotingAlignmentBlocB: 78, defensePacts: ['CSTO'], igoMemberships: ['CSTO', 'EAEU', 'CIS', 'SCO', 'OIC'] },
    criticalMinerals: [
      { mineral: 'uranium', role: 'producer', globalSharePct: 0.5 },
    ],
    softPower: { reachScore: 10, globalLanguageHost: false },
  },

  'laos': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 24, internetPenetrationPct: 52, dataLocalization: false, notes: 'One-party communist; minimal cyber capacity; Chinese infrastructure.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 125, fxReservesMonthsImports: 1.5, primaryBalanceGdpPct: -6.0, notes: 'Debt trap risk; Chinese loans dominant; kip collapse 2022-24.' },
    foodWater: { foodImportDependencePct: 5, waterStressIndex: 1, arableLandHaPerCapita: 0.22, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 18, unVotingAlignmentBlocB: 82, defensePacts: ['ASEAN'], igoMemberships: ['ASEAN', 'RCEP', 'NAM'] },
    criticalMinerals: [
      { mineral: 'potash', role: 'producer', globalSharePct: 0.5 },
    ],
    softPower: { reachScore: 10, globalLanguageHost: false, notes: 'Chinese Belt and Road showcase; battery of Southeast Asia (hydropower).' },
  },

  'latvia': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 84, internetPenetrationPct: 90, dataLocalization: false, notes: 'CERT-LV; NATO/EU member; front-line Russia threat awareness.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 46, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -2.5 },
    foodWater: { foodImportDependencePct: -5, waterStressIndex: 1, arableLandHaPerCapita: 0.64, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 91, unVotingAlignmentBlocB: 16, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'OECD', 'CoE'] },
    softPower: { reachScore: 30, globalLanguageHost: false, notes: 'Baltic digital hub; NATO eastern flank emphasis.' },
  },

  'lebanon': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 42, internetPenetrationPct: 78, dataLocalization: false, notes: 'Hezbollah cyber units; state collapse limits official capacity.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 280, fxReservesMonthsImports: 0.5, primaryBalanceGdpPct: -18.0, notes: 'Worst financial collapse in modern history; pound hyperinflation.' },
    foodWater: { foodImportDependencePct: 85, waterStressIndex: 4, arableLandHaPerCapita: 0.04, cerealExporter: false, notes: 'Beirut port blast 2020 destroyed grain stores; near-total import dependency.' },
    diplomatic: { unVotingAlignmentBlocA: 35, unVotingAlignmentBlocB: 60, defensePacts: [], igoMemberships: ['AL', 'OIC', 'NAM'] },
    softPower: { reachScore: 28, globalLanguageHost: false, notes: 'Large, influential global diaspora; Francophone culture; banking heritage.' },
  },

  'libya': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 20, internetPenetrationPct: 56, dataLocalization: false, notes: 'Dual-authority collapse; internet weaponised by factions.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 10, fxReservesMonthsImports: 25, primaryBalanceGdpPct: 2.0, notes: 'LIA SWF frozen; oil revenue disputed between factions; anomalous reserve level.' },
    foodWater: { foodImportDependencePct: 88, waterStressIndex: 5, arableLandHaPerCapita: 0.15, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 22, unVotingAlignmentBlocB: 65, defensePacts: [], igoMemberships: ['AL', 'AU', 'OIC', 'OPEC', 'NAM'] },
    criticalMinerals: [],
    softPower: { reachScore: 8, globalLanguageHost: false, notes: 'Failed-state status; oil leverage fragmented by factions.' },
  },

  'lithuania': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 84, internetPenetrationPct: 89, dataLocalization: false, notes: 'NKSC; NATO front-line member; Huawei 5G concerns raised.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 50, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -1.5 },
    foodWater: { foodImportDependencePct: -10, waterStressIndex: 1, arableLandHaPerCapita: 0.56, cerealExporter: true },
    diplomatic: { unVotingAlignmentBlocA: 92, unVotingAlignmentBlocB: 15, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'OECD', 'CoE'] },
    softPower: { reachScore: 32, globalLanguageHost: false, notes: 'Baltic NATO anchor; Taiwan chip diplomacy; China decoupling leader.' },
  },

  'luxembourg': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 86, internetPenetrationPct: 99, dataLocalization: false, notes: 'CIRCL; EU financial tech regulation hub; data centre cluster.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 28, fxReservesMonthsImports: 6, primaryBalanceGdpPct: -0.5, notes: 'Financial centre; AAA-rated; lowest debt in EU relative to GDP.' },
    foodWater: { foodImportDependencePct: 70, waterStressIndex: 1, arableLandHaPerCapita: 0.18, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 88, unVotingAlignmentBlocB: 20, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OECD', 'CoE', 'Benelux'] },
    softPower: { reachScore: 42, globalLanguageHost: true, notes: 'EU Court of Justice seat; ECB partial; multilingual banking hub.' },
  },

  'madagascar': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 52, internetPenetrationPct: 20, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 55, fxReservesMonthsImports: 2.5, primaryBalanceGdpPct: -4.5 },
    foodWater: { foodImportDependencePct: 20, waterStressIndex: 2, arableLandHaPerCapita: 0.20, cerealExporter: false, notes: 'Climate shocks; south experiencing famine conditions.' },
    diplomatic: { unVotingAlignmentBlocA: 30, unVotingAlignmentBlocB: 62, defensePacts: ['AU'], igoMemberships: ['AU', 'SADC', 'IOC', 'NAM', 'OIF'] },
    criticalMinerals: [
      { mineral: 'graphite', role: 'producer', globalSharePct: 4 },
      { mineral: 'nickel', role: 'producer', globalSharePct: 1 },
      { mineral: 'cobalt', role: 'producer', globalSharePct: 0.5 },
    ],
    softPower: { reachScore: 12, globalLanguageHost: true, notes: 'Biodiversity diplomacy; Francophone ties.' },
  },

  'malaysia': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 42, internetPenetrationPct: 90, dataLocalization: false, notes: 'CyberSecurity Malaysia; political content censorship; MH17/MH370 cloud.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 68, fxReservesMonthsImports: 5.5, primaryBalanceGdpPct: -4.5, notes: '1MDB scandal legacy; Ringgit under pressure.' },
    foodWater: { foodImportDependencePct: 25, waterStressIndex: 1, arableLandHaPerCapita: 0.08, cerealExporter: false, notes: 'Palm oil dominant exporter; rice importer.' },
    diplomatic: { unVotingAlignmentBlocA: 32, unVotingAlignmentBlocB: 65, defensePacts: ['ASEAN', 'Five Power'], igoMemberships: ['ASEAN', 'RCEP', 'OIC', 'Commonwealth', 'NAM', 'D-8'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'processor', globalSharePct: 15 },
    ],
    softPower: { reachScore: 45, inboundStudentsThousands: 120, globalLanguageHost: false, notes: 'RE processing hub; Islamic moderation model; Kuala Lumpur financial centre.' },
  },

  'mali': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 38, internetPenetrationPct: 18, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 48, fxReservesMonthsImports: 2, primaryBalanceGdpPct: -5.0, notes: 'Junta rule; donor suspension; Wagner present.' },
    foodWater: { foodImportDependencePct: 25, waterStressIndex: 4, arableLandHaPerCapita: 0.35, cerealExporter: false, notes: 'Sahel drought; displacement; food crisis.' },
    diplomatic: { unVotingAlignmentBlocA: 15, unVotingAlignmentBlocB: 78, defensePacts: ['AES'], igoMemberships: ['AU', 'AES', 'OIC', 'NAM'] },
    criticalMinerals: [
      { mineral: 'manganese', role: 'producer', globalSharePct: 0.5 },
    ],
    softPower: { reachScore: 8, globalLanguageHost: true, notes: 'Junta-led; internationally isolated; gold mining leverage.' },
  },

  'moldova': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 65, internetPenetrationPct: 78, dataLocalization: false, notes: 'Russia disinformation target; EU cyber assistance; Transnistria grey zone.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 42, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -4.0, notes: 'Remittance-dependent; energy price shock 2022.' },
    foodWater: { foodImportDependencePct: -5, waterStressIndex: 2, arableLandHaPerCapita: 0.48, cerealExporter: true, notes: 'Agricultural surplus; wine exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 65, unVotingAlignmentBlocB: 38, defensePacts: [], igoMemberships: ['CIS', 'CoE', 'OSCE'], pendingAccession: ['EU'] },
    softPower: { reachScore: 15, globalLanguageHost: false, notes: 'EU candidate 2022; wine diplomacy; Transnistria conflict.' },
  },

  'mongolia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 60, internetPenetrationPct: 72, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 88, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -4.0, notes: 'Mining-commodity dependent; China trade concentration.' },
    foodWater: { foodImportDependencePct: 20, waterStressIndex: 3, arableLandHaPerCapita: 0.42, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 38, unVotingAlignmentBlocB: 62, defensePacts: [], igoMemberships: ['SCO', 'NAM'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'producer', globalSharePct: 2 },
    ],
    softPower: { reachScore: 18, globalLanguageHost: false, notes: 'Third-neighbour diplomacy; buffer state between Russia and China.' },
  },

  'montenegro': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 68, internetPenetrationPct: 80, dataLocalization: false, notes: '2022 Russian cyberattacks on government; NATO membership expedited response.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 70, fxReservesMonthsImports: 3, primaryBalanceGdpPct: -2.5, notes: 'Euroised; Chinese Bar-Boljare highway debt.' },
    foodWater: { foodImportDependencePct: 42, waterStressIndex: 1, arableLandHaPerCapita: 0.08, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 80, unVotingAlignmentBlocB: 28, defensePacts: ['NATO'], igoMemberships: ['NATO', 'OSCE', 'CoE'], pendingAccession: ['EU'] },
    softPower: { reachScore: 18, globalLanguageHost: false, notes: 'Tourism (Adriatic); EU accession progress.' },
  },

  'mozambique': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 45, internetPenetrationPct: 22, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 112, fxReservesMonthsImports: 3, primaryBalanceGdpPct: -5.0, notes: 'Tuna bond default legacy; LNG revenue not yet flowing; Cabo Delgado insurgency.' },
    foodWater: { foodImportDependencePct: 28, waterStressIndex: 2, arableLandHaPerCapita: 0.32, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 30, unVotingAlignmentBlocB: 65, defensePacts: ['AU'], igoMemberships: ['AU', 'SADC', 'Commonwealth', 'CPLP', 'NAM'] },
    criticalMinerals: [
      { mineral: 'graphite', role: 'producer', globalSharePct: 6 },
      { mineral: 'titanium', role: 'producer', globalSharePct: 3 },
    ],
    softPower: { reachScore: 12, globalLanguageHost: false, notes: 'LNG potential; SADC peacekeeping contributor.' },
  },

  'myanmar': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 15, internetPenetrationPct: 46, dataLocalization: true, notes: 'Military junta controls internet; social media shutdowns; civil-war context.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 55, fxReservesMonthsImports: 2, primaryBalanceGdpPct: -7.0, notes: 'Post-coup collapse; kyat depreciation; sanctions.' },
    foodWater: { foodImportDependencePct: -10, waterStressIndex: 2, arableLandHaPerCapita: 0.22, cerealExporter: false, notes: 'Was rice exporter; conflict disrupting agriculture.' },
    diplomatic: { unVotingAlignmentBlocA: 18, unVotingAlignmentBlocB: 78, defensePacts: [], igoMemberships: ['ASEAN', 'NAM'] },
    criticalMinerals: [
      { mineral: 'rareEarths', role: 'producer', globalSharePct: 10 },
      { mineral: 'tungsten', role: 'producer', globalSharePct: 5 },
      { mineral: 'nickel', role: 'producer', globalSharePct: 1 },
    ],
    softPower: { reachScore: 8, globalLanguageHost: false, notes: 'Junta-led; limited international engagement; Rohingya crisis overhang; jade/gem leverage.' },
  },

  'nepal': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 52, internetPenetrationPct: 56, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 42, fxReservesMonthsImports: 7, primaryBalanceGdpPct: -4.0, notes: 'Remittance-dependent; India-linked economy.' },
    foodWater: { foodImportDependencePct: 12, waterStressIndex: 2, arableLandHaPerCapita: 0.08, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 35, unVotingAlignmentBlocB: 62, defensePacts: [], igoMemberships: ['SAARC', 'NAM', 'OIF'] },
    softPower: { reachScore: 20, globalLanguageHost: false, notes: 'Gurkha military diplomacy; Everest/tourism brand; buffer between India and China.' },
  },

  'new-zealand': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 88, internetPenetrationPct: 93, dataLocalization: false, notes: 'GCSB; Five Eyes full member; AUKUS Pillar II associate; Christchurch Call.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 55, fxReservesMonthsImports: 5, primaryBalanceGdpPct: -2.0 },
    foodWater: { foodImportDependencePct: -60, waterStressIndex: 1, arableLandHaPerCapita: 0.50, cerealExporter: true, notes: 'Major dairy, meat, wool exporter; net food exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 88, unVotingAlignmentBlocB: 20, defensePacts: ['ANZUS', 'Five Eyes'], igoMemberships: ['OECD', 'APEC', 'Commonwealth', 'CPTPP', 'Pacific Islands Forum'] },
    softPower: { reachScore: 52, inboundStudentsThousands: 50, globalLanguageHost: true, notes: 'Soft-power brand; Maori cultural diplomacy; Pacific Islands Forum leadership.' },
  },

  'niger': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 35, internetPenetrationPct: 15, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 52, fxReservesMonthsImports: 1.5, primaryBalanceGdpPct: -6.0, notes: 'Junta 2023; French uranium cut-off; ECOWAS sanctions lifted.' },
    foodWater: { foodImportDependencePct: 22, waterStressIndex: 4, arableLandHaPerCapita: 0.55, cerealExporter: false, notes: 'Sahel food crisis; chronic undernutrition.' },
    diplomatic: { unVotingAlignmentBlocA: 15, unVotingAlignmentBlocB: 75, defensePacts: ['AES'], igoMemberships: ['AU', 'AES', 'OIC', 'NAM'] },
    criticalMinerals: [
      { mineral: 'uranium', role: 'producer', globalSharePct: 5 },
    ],
    softPower: { reachScore: 6, globalLanguageHost: false, notes: 'Uranium leverage; junta-led; internationally isolated.' },
  },

  'north-macedonia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 62, internetPenetrationPct: 80, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 58, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -3.0 },
    foodWater: { foodImportDependencePct: 28, waterStressIndex: 2, arableLandHaPerCapita: 0.20, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 80, unVotingAlignmentBlocB: 28, defensePacts: ['NATO'], igoMemberships: ['NATO', 'OSCE', 'CoE'], pendingAccession: ['EU'] },
    softPower: { reachScore: 15, globalLanguageHost: false, notes: 'Prespa Agreement legacy; EU/NATO accession.' },
  },

  'oman': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 32, internetPenetrationPct: 92, dataLocalization: false, notes: 'OCERT; balanced digital policy; Gulf mediation role.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 38, fxReservesMonthsImports: 8, primaryBalanceGdpPct: 1.5, notes: 'OIA SWF; oil revenue; fiscal reform under Vision 2040.' },
    foodWater: { foodImportDependencePct: 82, waterStressIndex: 5, arableLandHaPerCapita: 0.02, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 48, unVotingAlignmentBlocB: 55, defensePacts: ['GCC'], igoMemberships: ['GCC', 'AL', 'OIC', 'NAM'] },
    softPower: { reachScore: 32, globalLanguageHost: false, notes: 'Mediation diplomacy (Iran, Yemen); neutral Gulf state; DARSAH Institute.' },
  },

  'panama': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 65, internetPenetrationPct: 68, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 62, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -4.5, notes: 'Dollarised; Canal revenue; Panama Papers legacy; fiscal strain.' },
    foodWater: { foodImportDependencePct: 35, waterStressIndex: 1, arableLandHaPerCapita: 0.08, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 68, unVotingAlignmentBlocB: 35, defensePacts: [], igoMemberships: ['OAS', 'CELAC', 'SICA'] },
    softPower: { reachScore: 30, globalLanguageHost: false, notes: 'Canal strategic chokepoint; financial centre; logistics hub.' },
  },

  'papua-new-guinea': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 55, internetPenetrationPct: 28, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 52, fxReservesMonthsImports: 3, primaryBalanceGdpPct: -3.5, notes: 'LNG revenue; resource curse; high debt service.' },
    foodWater: { foodImportDependencePct: -15, waterStressIndex: 1, arableLandHaPerCapita: 0.10, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 62, unVotingAlignmentBlocB: 40, defensePacts: [], igoMemberships: ['APEC', 'Pacific Islands Forum', 'Commonwealth', 'NAM'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'producer', globalSharePct: 0.5 },
      { mineral: 'nickel', role: 'producer', globalSharePct: 0.5 },
      { mineral: 'cobalt', role: 'producer', globalSharePct: 0.3 },
    ],
    softPower: { reachScore: 15, globalLanguageHost: false, notes: 'Pacific Islands geopolitics; LNG leverage; APEC membership.' },
  },

  'paraguay': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 65, internetPenetrationPct: 72, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 42, fxReservesMonthsImports: 6, primaryBalanceGdpPct: -1.5, notes: 'Hydropower revenue; soy agri-dependent; fiscal orthodoxy.' },
    foodWater: { foodImportDependencePct: -30, waterStressIndex: 1, arableLandHaPerCapita: 0.58, cerealExporter: true, notes: 'Major soy exporter; Itaipu/Yacyretá hydropower.' },
    diplomatic: { unVotingAlignmentBlocA: 65, unVotingAlignmentBlocB: 35, defensePacts: [], igoMemberships: ['Mercosur', 'OAS', 'CELAC', 'UNASUR'] },
    softPower: { reachScore: 18, globalLanguageHost: false, notes: 'Hydropower diplomacy; soy export leverage; Taiwan recognition.' },
  },

  'peru': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 65, internetPenetrationPct: 72, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 35, fxReservesMonthsImports: 16, primaryBalanceGdpPct: -2.5, notes: 'Large FX reserves; BCR sterilisation; political risk cloud.' },
    foodWater: { foodImportDependencePct: -5, waterStressIndex: 3, arableLandHaPerCapita: 0.13, cerealExporter: false, notes: 'Fish meal/copper exporter; Atacama/Andes water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 60, unVotingAlignmentBlocB: 42, defensePacts: [], igoMemberships: ['OAS', 'CELAC', 'APEC', 'CAN', 'CPTPP'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'producer', globalSharePct: 10 },
    ],
    softPower: { reachScore: 32, globalLanguageHost: false, notes: 'APEC/CPTPP member; Machu Picchu tourism; copper leverage.' },
  },

  'portugal': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'high', internetFreedomScore: 83, internetPenetrationPct: 88, dataLocalization: false, notes: 'CNCS national cyber strategy; EU/NATO member; Atlantic hub.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 112, fxReservesMonthsImports: 4, primaryBalanceGdpPct: 1.2, notes: 'Post-Troika fiscal recovery; primary surplus maintained.' },
    foodWater: { foodImportDependencePct: 15, waterStressIndex: 3, arableLandHaPerCapita: 0.18, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 85, unVotingAlignmentBlocB: 22, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OECD', 'CoE', 'CPLP'] },
    softPower: { reachScore: 52, inboundStudentsThousands: 50, globalLanguageHost: true, notes: 'CPLP/Lusophone soft power; Atlantic posture; Lisbon tech hub.' },
  },

  'romania': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 70, internetPenetrationPct: 84, dataLocalization: false, notes: 'DNSC; NATO/EU member; significant NATO military build-up.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 50, fxReservesMonthsImports: 5, primaryBalanceGdpPct: -5.5, notes: 'Highest deficit in EU; fiscal consolidation under IMF pressure.' },
    foodWater: { foodImportDependencePct: -10, waterStressIndex: 2, arableLandHaPerCapita: 0.40, cerealExporter: true, notes: 'Black Sea grain exporter; EU agriculture hub.' },
    diplomatic: { unVotingAlignmentBlocA: 85, unVotingAlignmentBlocB: 22, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'CoE'] },
    criticalMinerals: [
      { mineral: 'uranium', role: 'producer', globalSharePct: 0.5 },
    ],
    softPower: { reachScore: 30, inboundStudentsThousands: 18, globalLanguageHost: false, notes: 'Black Sea NATO anchor; Latin heritage cultural diplomacy.' },
  },

  'rwanda': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 38, internetPenetrationPct: 62, dataLocalization: false, notes: 'RISA digital ambitions; Pegasus use against dissidents documented.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 72, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -6.5, notes: 'Kagame development model; high aid-funded investment.' },
    foodWater: { foodImportDependencePct: 18, waterStressIndex: 2, arableLandHaPerCapita: 0.10, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 42, unVotingAlignmentBlocB: 55, defensePacts: ['AU'], igoMemberships: ['AU', 'EAC', 'Commonwealth', 'COMESA', 'OIF'] },
    criticalMinerals: [
      { mineral: 'tungsten', role: 'producer', globalSharePct: 1 },
    ],
    softPower: { reachScore: 28, globalLanguageHost: false, notes: 'Kigali development model; peacekeeping; tech hub ambitions.' },
  },

  'senegal': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 52, internetPenetrationPct: 62, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 82, fxReservesMonthsImports: 3.5, primaryBalanceGdpPct: -5.0, notes: 'Oil/gas production starting 2024; CFA franc; debt rising.' },
    foodWater: { foodImportDependencePct: 35, waterStressIndex: 3, arableLandHaPerCapita: 0.22, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 38, unVotingAlignmentBlocB: 58, defensePacts: ['AU'], igoMemberships: ['AU', 'ECOWAS', 'OIC', 'OIF', 'NAM'] },
    softPower: { reachScore: 30, globalLanguageHost: true, notes: 'West Africa democratic anchor; Dakar cultural capital; French-speaking.' },
  },

  'serbia': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'medium', internetFreedomScore: 60, internetPenetrationPct: 84, dataLocalization: false, notes: 'Pegasus/Cellebrite use against journalists; Vučić balancing act.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 50, fxReservesMonthsImports: 5.5, primaryBalanceGdpPct: -2.0 },
    foodWater: { foodImportDependencePct: -10, waterStressIndex: 2, arableLandHaPerCapita: 0.42, cerealExporter: true },
    diplomatic: { unVotingAlignmentBlocA: 60, unVotingAlignmentBlocB: 50, defensePacts: [], igoMemberships: ['OSCE', 'CoE', 'CEFTA'], pendingAccession: ['EU'] },
    criticalMinerals: [
      { mineral: 'lithium', role: 'reserves', globalSharePct: 4 },
      { mineral: 'copper', role: 'producer', globalSharePct: 0.3 },
    ],
    softPower: { reachScore: 28, globalLanguageHost: false, notes: 'Geopolitical pivot actor; Jadar lithium EU interest; Russia/China relations.' },
  },

  'slovakia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 72, internetPenetrationPct: 84, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 60, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -4.5, notes: 'Fico government fiscal loosening; EU concerns.' },
    foodWater: { foodImportDependencePct: 10, waterStressIndex: 2, arableLandHaPerCapita: 0.28, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 76, unVotingAlignmentBlocB: 35, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'OECD', 'CoE'] },
    softPower: { reachScore: 25, globalLanguageHost: false, notes: 'Fico Russia-friendly drift; automotive industry hub.' },
  },

  'slovenia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 76, internetPenetrationPct: 88, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 70, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -2.5 },
    foodWater: { foodImportDependencePct: 15, waterStressIndex: 1, arableLandHaPerCapita: 0.12, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 84, unVotingAlignmentBlocB: 24, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OSCE', 'OECD', 'CoE'] },
    softPower: { reachScore: 28, globalLanguageHost: false, notes: 'Brdo-Brijuni Process Western Balkans diplomacy; green tech.' },
  },

  'somalia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 12, internetPenetrationPct: 20, dataLocalization: false, notes: 'Fragile state; mobile-money innovation despite collapse; Al-Shabaab comms.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 72, fxReservesMonthsImports: 0.5, primaryBalanceGdpPct: -10.0, notes: 'HIPC; aid-dependent; no functioning central bank historically.' },
    foodWater: { foodImportDependencePct: 45, waterStressIndex: 4, arableLandHaPerCapita: 0.22, cerealExporter: false, notes: 'Chronic drought; famine risk; 2022 near-famine.' },
    diplomatic: { unVotingAlignmentBlocA: 28, unVotingAlignmentBlocB: 58, defensePacts: [], igoMemberships: ['AL', 'AU', 'OIC', 'IGAD', 'NAM'] },
    softPower: { reachScore: 6, globalLanguageHost: false, notes: 'Diaspora remittances critical; Berbera port competition.' },
  },

  'south-sudan': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 10, internetPenetrationPct: 10, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 60, fxReservesMonthsImports: 0.5, primaryBalanceGdpPct: -15.0, notes: 'Oil-dependent; civil war legacy; hyperinflation; currency collapse.' },
    foodWater: { foodImportDependencePct: 55, waterStressIndex: 3, arableLandHaPerCapita: 0.30, cerealExporter: false, notes: 'World\'s most food-insecure country; conflict-driven.' },
    diplomatic: { unVotingAlignmentBlocA: 25, unVotingAlignmentBlocB: 62, defensePacts: [], igoMemberships: ['AU', 'IGAD', 'EAC', 'NAM'] },
    criticalMinerals: [],
    softPower: { reachScore: 4, globalLanguageHost: false, notes: 'World\'s newest state; near-collapsed governance.' },
  },

  'sri-lanka': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 52, internetPenetrationPct: 58, dataLocalization: false, notes: 'Social media shutdowns; post-Rajapaksa reform environment.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 115, fxReservesMonthsImports: 2, primaryBalanceGdpPct: 1.5, notes: '2022 sovereign default; IMF programme; restructuring ongoing.' },
    foodWater: { foodImportDependencePct: 20, waterStressIndex: 3, arableLandHaPerCapita: 0.06, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 35, unVotingAlignmentBlocB: 62, defensePacts: [], igoMemberships: ['SAARC', 'Commonwealth', 'NAM', 'BIMSTEC'] },
    softPower: { reachScore: 22, globalLanguageHost: false, notes: 'Colombo port Indo-Pacific competition; tea diplomacy; cricket.' },
  },

  'sudan': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 14, internetPenetrationPct: 32, dataLocalization: false, notes: 'SAF/RSF civil war; internet disruptions used as weapon.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 195, fxReservesMonthsImports: 0.5, primaryBalanceGdpPct: -12.0, notes: 'Civil war since April 2023; economic collapse; hyperinflation.' },
    foodWater: { foodImportDependencePct: 18, waterStressIndex: 4, arableLandHaPerCapita: 0.62, cerealExporter: false, notes: 'Large arable land but conflict prevents exploitation; famine.' },
    diplomatic: { unVotingAlignmentBlocA: 22, unVotingAlignmentBlocB: 65, defensePacts: [], igoMemberships: ['AL', 'AU', 'OIC', 'IGAD', 'NAM'] },
    criticalMinerals: [],
    softPower: { reachScore: 6, globalLanguageHost: false, notes: 'Collapsed state; gold extraction via UAE channels; Red Sea port.' },
  },

  'sweden': {
    cyber: { offensiveTier: 'high', defensiveTier: 'high', internetFreedomScore: 90, internetPenetrationPct: 97, dataLocalization: false, notes: 'NCSC-SE; NATO member 2024; SAPO; advanced defence industry.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 32, fxReservesMonthsImports: 6, primaryBalanceGdpPct: -0.5 },
    foodWater: { foodImportDependencePct: 10, waterStressIndex: 1, arableLandHaPerCapita: 0.28, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 90, unVotingAlignmentBlocB: 18, defensePacts: ['NATO'], igoMemberships: ['EU', 'NATO', 'OECD', 'CoE', 'Nordic Council'] },
    softPower: { reachScore: 65, inboundStudentsThousands: 35, globalLanguageHost: false, notes: 'IKEA/Spotify/Volvo brand; Nordic model; human rights diplomacy.' },
  },

  'syria': {
    cyber: { offensiveTier: 'medium', defensiveTier: 'low', internetFreedomScore: 12, internetPenetrationPct: 38, dataLocalization: true, notes: 'Assad/post-Assad transition; SyRIA malware; Russian-backed surveillance.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 72, fxReservesMonthsImports: 0.5, primaryBalanceGdpPct: -20.0, notes: 'Decade of war destruction; Western sanctions; pound hyperinflation; HTS transition 2024.' },
    foodWater: { foodImportDependencePct: 55, waterStressIndex: 4, arableLandHaPerCapita: 0.20, cerealExporter: false, notes: 'War destroyed agriculture; Euphrates water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 10, unVotingAlignmentBlocB: 72, defensePacts: [], igoMemberships: ['AL', 'OIC', 'NAM'] },
    softPower: { reachScore: 6, globalLanguageHost: false, notes: 'HTS transition 2024-25; reconstruction leverage; refugee diplomacy.' },
  },

  'tajikistan': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 22, internetPenetrationPct: 40, dataLocalization: true },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 95, fxReservesMonthsImports: 3.5, primaryBalanceGdpPct: -2.5, notes: 'Remittance-dependent; China-heavy debt; Rogun dam project.' },
    foodWater: { foodImportDependencePct: 30, waterStressIndex: 3, arableLandHaPerCapita: 0.10, cerealExporter: false, notes: 'Glacial water tower of Central Asia; upstream Amu Darya.' },
    diplomatic: { unVotingAlignmentBlocA: 20, unVotingAlignmentBlocB: 80, defensePacts: ['CSTO'], igoMemberships: ['CSTO', 'EAEU', 'CIS', 'SCO', 'OIC'] },
    criticalMinerals: [
      { mineral: 'uranium', role: 'producer', globalSharePct: 0.3 },
    ],
    softPower: { reachScore: 8, globalLanguageHost: false },
  },

  'tanzania': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 40, internetPenetrationPct: 45, dataLocalization: false, notes: 'Online Content Regulations restrict expression; growing mobile internet.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 42, fxReservesMonthsImports: 4.5, primaryBalanceGdpPct: -3.5 },
    foodWater: { foodImportDependencePct: 5, waterStressIndex: 3, arableLandHaPerCapita: 0.30, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 30, unVotingAlignmentBlocB: 65, defensePacts: ['AU'], igoMemberships: ['AU', 'EAC', 'SADC', 'Commonwealth', 'NAM'] },
    criticalMinerals: [
      { mineral: 'graphite', role: 'producer', globalSharePct: 3 },
      { mineral: 'nickel', role: 'producer', globalSharePct: 0.5 },
      { mineral: 'uranium', role: 'reserves' },
    ],
    softPower: { reachScore: 22, globalLanguageHost: false, notes: 'Serengeti/Kilimanjaro tourism; Dar es Salaam EAC hub.' },
  },

  'tunisia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 42, internetPenetrationPct: 68, dataLocalization: false, notes: 'Post-Saied consolidation; ANSI cyber agency; Arab Spring legacy.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 88, fxReservesMonthsImports: 2.5, primaryBalanceGdpPct: -4.5, notes: 'IMF programme stalled; dinar depreciation; fiscal crisis.' },
    foodWater: { foodImportDependencePct: 35, waterStressIndex: 4, arableLandHaPerCapita: 0.30, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 35, unVotingAlignmentBlocB: 58, defensePacts: [], igoMemberships: ['AL', 'AU', 'OIC', 'NAM', 'AMU'] },
    criticalMinerals: [
      { mineral: 'phosphate', role: 'producer', globalSharePct: 4 },
    ],
    softPower: { reachScore: 25, globalLanguageHost: false, notes: 'EU migration partnership leverage; Arab Spring origin; Jasmine Revolution brand.' },
  },

  'turkmenistan': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 5, internetPenetrationPct: 30, dataLocalization: true, notes: 'Most closed internet in Central Asia; extreme censorship.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 20, fxReservesMonthsImports: 10, primaryBalanceGdpPct: 3.0, notes: 'Gas-export rich; opaque state finances; manat officially pegged.' },
    foodWater: { foodImportDependencePct: 20, waterStressIndex: 5, arableLandHaPerCapita: 0.35, cerealExporter: false, notes: 'Aral Sea catastrophe; Amu Darya depletion; cotton irrigation waste.' },
    diplomatic: { unVotingAlignmentBlocA: 22, unVotingAlignmentBlocB: 72, defensePacts: [], igoMemberships: ['CIS', 'OIC', 'NAM'] },
    criticalMinerals: [],
    softPower: { reachScore: 6, globalLanguageHost: false, notes: 'Gas diplomacy; permanent neutrality; Berdimuhamedow cult of personality.' },
  },

  'uganda': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 35, internetPenetrationPct: 26, dataLocalization: false, notes: 'Social media tax; election internet shutdowns; Pegasus use documented.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 52, fxReservesMonthsImports: 4, primaryBalanceGdpPct: -4.0, notes: 'EACOP oil project financing; World Bank aid suspended over anti-gay law.' },
    foodWater: { foodImportDependencePct: -5, waterStressIndex: 2, arableLandHaPerCapita: 0.22, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 28, unVotingAlignmentBlocB: 65, defensePacts: ['AU'], igoMemberships: ['AU', 'EAC', 'COMESA', 'Commonwealth', 'NAM'] },
    criticalMinerals: [
      { mineral: 'cobalt', role: 'producer', globalSharePct: 0.2 },
      { mineral: 'copper', role: 'producer', globalSharePct: 0.1 },
    ],
    softPower: { reachScore: 18, globalLanguageHost: false, notes: 'AU peacekeeping contributor; oil pipeline leverage.' },
  },

  'uruguay': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 76, internetPenetrationPct: 88, dataLocalization: false, notes: 'CERTuy; strong data protection; stable democracy.' },
    fiscal: { sovereignRatingTier: 'investment', externalDebtGdpPct: 62, fxReservesMonthsImports: 8, primaryBalanceGdpPct: -2.0 },
    foodWater: { foodImportDependencePct: -40, waterStressIndex: 1, arableLandHaPerCapita: 0.50, cerealExporter: true, notes: 'Major beef, soy, rice exporter.' },
    diplomatic: { unVotingAlignmentBlocA: 65, unVotingAlignmentBlocB: 38, defensePacts: [], igoMemberships: ['Mercosur', 'OAS', 'CELAC', 'CPTPP'] },
    softPower: { reachScore: 35, globalLanguageHost: false, notes: 'LatAm democratic model; cannabis legalisation; progressive policy brand.' },
  },

  'uzbekistan': {
    cyber: { offensiveTier: 'low', defensiveTier: 'medium', internetFreedomScore: 28, internetPenetrationPct: 72, dataLocalization: true, notes: 'State censorship; reform under Mirziyoyev; UzCERT established.' },
    fiscal: { sovereignRatingTier: 'speculative', externalDebtGdpPct: 42, fxReservesMonthsImports: 7, primaryBalanceGdpPct: -3.5, notes: 'Gold + gas revenues; reform trajectory; IMF positive.' },
    foodWater: { foodImportDependencePct: 10, waterStressIndex: 5, arableLandHaPerCapita: 0.13, cerealExporter: false, notes: 'Aral Sea disaster; heavily irrigated cotton/wheat; acute water stress.' },
    diplomatic: { unVotingAlignmentBlocA: 28, unVotingAlignmentBlocB: 72, defensePacts: [], igoMemberships: ['CIS', 'SCO', 'OIC', 'NAM'] },
    criticalMinerals: [
      { mineral: 'uranium', role: 'producer', globalSharePct: 6 },
      { mineral: 'copper', role: 'producer', globalSharePct: 0.5 },
    ],
    softPower: { reachScore: 18, globalLanguageHost: false, notes: 'Silk Road heritage tourism; Mirziyoyev reform diplomacy; Samarkand SCO summit.' },
  },

  'yemen': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 14, internetPenetrationPct: 28, dataLocalization: false, notes: 'Houthi/Sana\'a internet control; UAE-backed south; conflict collapses infrastructure.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 78, fxReservesMonthsImports: 0.5, primaryBalanceGdpPct: -22.0, notes: 'Worst humanitarian crisis; dual-currency; no functioning central bank.' },
    foodWater: { foodImportDependencePct: 90, waterStressIndex: 5, arableLandHaPerCapita: 0.05, cerealExporter: false, notes: 'World\'s most water-scarce country; near-total food import.' },
    diplomatic: { unVotingAlignmentBlocA: 30, unVotingAlignmentBlocB: 55, defensePacts: [], igoMemberships: ['AL', 'OIC', 'NAM', 'GCC'] },
    softPower: { reachScore: 4, globalLanguageHost: false, notes: 'Houthi Red Sea disruption as leverage; Bab-el-Mandeb chokepoint control.' },
  },

  'zambia': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 55, internetPenetrationPct: 38, dataLocalization: false },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 120, fxReservesMonthsImports: 2.5, primaryBalanceGdpPct: 0.5, notes: '2020 first African COVID default; IMF/G20 debt restructuring 2023.' },
    foodWater: { foodImportDependencePct: 10, waterStressIndex: 2, arableLandHaPerCapita: 0.38, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 40, unVotingAlignmentBlocB: 55, defensePacts: ['AU'], igoMemberships: ['AU', 'SADC', 'COMESA', 'Commonwealth', 'NAM'] },
    criticalMinerals: [
      { mineral: 'copper', role: 'producer', globalSharePct: 4 },
      { mineral: 'cobalt', role: 'producer', globalSharePct: 2 },
    ],
    softPower: { reachScore: 18, globalLanguageHost: false, notes: 'Copper-belt leverage; debt restructuring template case.' },
  },

  'zimbabwe': {
    cyber: { offensiveTier: 'low', defensiveTier: 'low', internetFreedomScore: 28, internetPenetrationPct: 34, dataLocalization: false, notes: 'POTRAZ surveillance; ZANU-PF internet control; Interception of Communications Act.' },
    fiscal: { sovereignRatingTier: 'distressed', externalDebtGdpPct: 98, fxReservesMonthsImports: 1.5, primaryBalanceGdpPct: -4.0, notes: 'ZiG currency 2024; legacy hyperinflation; SADC/COMESA arrears.' },
    foodWater: { foodImportDependencePct: 30, waterStressIndex: 3, arableLandHaPerCapita: 0.28, cerealExporter: false },
    diplomatic: { unVotingAlignmentBlocA: 15, unVotingAlignmentBlocB: 82, defensePacts: ['AU'], igoMemberships: ['AU', 'SADC', 'COMESA', 'NAM'] },
    criticalMinerals: [
      { mineral: 'lithium', role: 'producer', globalSharePct: 3 },
      { mineral: 'platinumGroup', role: 'producer' },
    ],
    softPower: { reachScore: 10, globalLanguageHost: false, notes: 'Sanctions-isolated; lithium new leverage; Victoria Falls tourism.' },
  },
};
