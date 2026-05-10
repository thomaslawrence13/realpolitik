/**
 * v10 supplemental country data layer.
 *
 * Demographics, energy posture, top bilateral trade partners, and geographic
 * centroids are merged additively onto v1 country records. Coverage is the
 * G20 plus 20+ additional strategic actors. Countries not present here keep
 * their v1 fields untouched and the new optional properties remain undefined.
 *
 * Population values are ~2024 estimates (UN DESA WPP). Energy values are
 * mid-2024 IEA / EIA snapshots. Trade-partner shares are UN Comtrade
 * 2023-2024 reconciled top-trade-partner directional shares.
 */

import type { DemographicStats, EnergyProfile, GeoCentroid, TopTradePartner } from '../../types';

export interface CountryEnhancement {
  demographics?: DemographicStats;
  energy?: EnergyProfile;
  topTradePartners?: TopTradePartner[];
  geo?: GeoCentroid;
}

export const v10Enhancements: Record<string, CountryEnhancement> = {
  'united-states': {
    demographics: { populationMillions: 335, medianAge: 38.9, urbanizationPct: 83, youthSharePct: 19, netMigrationPer1000: 3.0 },
    energy: { netOilExportMbd: 1.6, netGasExportBcm: 95, energyImportDependencePct: -10, criticalMineralExporter: false, notes: 'Net LNG exporter; reliant on imports of rare earths and processed lithium.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 13.5, flow: 'imports' },
      { countryId: 'mexico', sharePct: 14.7, flow: 'balanced' },
      { countryId: 'canada', sharePct: 14.1, flow: 'balanced' },
      { countryId: 'germany', sharePct: 4.5, flow: 'imports' },
      { countryId: 'japan', sharePct: 4.3, flow: 'imports' },
    ],
    geo: { lat: 39.8, lng: -98.6 },
  },
  'china': {
    demographics: { populationMillions: 1410, medianAge: 39.8, urbanizationPct: 65, youthSharePct: 17, netMigrationPer1000: -0.3 },
    energy: { netOilExportMbd: -11.0, netGasExportBcm: -160, energyImportDependencePct: 22, criticalMineralExporter: true, notes: 'Dominant processor of rare earths, gallium, germanium, and graphite.' },
    topTradePartners: [
      { countryId: 'united-states', sharePct: 11.2, flow: 'exports' },
      { countryId: 'japan', sharePct: 5.4, flow: 'balanced' },
      { countryId: 'south-korea', sharePct: 5.6, flow: 'imports' },
      { countryId: 'germany', sharePct: 3.6, flow: 'balanced' },
      { countryId: 'russia', sharePct: 4.0, flow: 'imports' },
    ],
    geo: { lat: 35.0, lng: 103.8 },
  },
  'russia': {
    demographics: { populationMillions: 144, medianAge: 41.0, urbanizationPct: 75, youthSharePct: 17, netMigrationPer1000: -0.5 },
    energy: { netOilExportMbd: 7.6, netGasExportBcm: 195, energyImportDependencePct: -85, criticalMineralExporter: true, notes: 'Dominant supplier of palladium and a top-five producer of nickel, platinum, and uranium.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 24.0, flow: 'balanced' },
      { countryId: 'india', sharePct: 8.0, flow: 'exports' },
      { countryId: 'turkey', sharePct: 6.5, flow: 'exports' },
      { countryId: 'germany', sharePct: 2.0, flow: 'exports' },
      { countryId: 'kazakhstan', sharePct: 3.5, flow: 'balanced' },
    ],
    geo: { lat: 61.5, lng: 105.3 },
  },
  'germany': {
    demographics: { populationMillions: 84, medianAge: 46.7, urbanizationPct: 78, youthSharePct: 16, netMigrationPer1000: 7.0 },
    energy: { netOilExportMbd: -1.9, netGasExportBcm: -85, energyImportDependencePct: 65, criticalMineralExporter: false, notes: 'High exposure to LNG and pipeline gas substitution after 2022 Russia decoupling.' },
    topTradePartners: [
      { countryId: 'united-states', sharePct: 9.9, flow: 'exports' },
      { countryId: 'china', sharePct: 7.4, flow: 'balanced' },
      { countryId: 'france', sharePct: 7.5, flow: 'exports' },
      { countryId: 'netherlands', sharePct: 8.4, flow: 'imports' },
      { countryId: 'poland', sharePct: 5.5, flow: 'balanced' },
    ],
    geo: { lat: 51.2, lng: 10.5 },
  },
  'france': {
    demographics: { populationMillions: 65, medianAge: 42.6, urbanizationPct: 81, youthSharePct: 17, netMigrationPer1000: 1.1 },
    energy: { netOilExportMbd: -1.5, netGasExportBcm: -38, energyImportDependencePct: 47, criticalMineralExporter: false, notes: 'Nuclear-heavy electricity mix; diversified LNG sourcing.' },
    topTradePartners: [
      { countryId: 'germany', sharePct: 14.3, flow: 'balanced' },
      { countryId: 'italy', sharePct: 7.6, flow: 'balanced' },
      { countryId: 'united-states', sharePct: 7.6, flow: 'exports' },
      { countryId: 'spain', sharePct: 7.8, flow: 'balanced' },
      { countryId: 'china', sharePct: 6.4, flow: 'imports' },
    ],
    geo: { lat: 46.6, lng: 2.2 },
  },
  'united-kingdom': {
    demographics: { populationMillions: 68, medianAge: 40.6, urbanizationPct: 84, youthSharePct: 17, netMigrationPer1000: 7.4 },
    energy: { netOilExportMbd: -0.6, netGasExportBcm: -25, energyImportDependencePct: 38, criticalMineralExporter: false, notes: 'North Sea hydrocarbons declining; LNG and Norwegian gas critical.' },
    topTradePartners: [
      { countryId: 'united-states', sharePct: 16.6, flow: 'balanced' },
      { countryId: 'germany', sharePct: 9.9, flow: 'balanced' },
      { countryId: 'china', sharePct: 6.6, flow: 'imports' },
      { countryId: 'netherlands', sharePct: 7.2, flow: 'balanced' },
      { countryId: 'france', sharePct: 6.4, flow: 'balanced' },
    ],
    geo: { lat: 54.0, lng: -2.0 },
  },
  'japan': {
    demographics: { populationMillions: 124, medianAge: 49.5, urbanizationPct: 92, youthSharePct: 13, netMigrationPer1000: 0.5 },
    energy: { netOilExportMbd: -3.2, netGasExportBcm: -90, energyImportDependencePct: 88, criticalMineralExporter: false, notes: 'Top three LNG importer; nuclear restart program ongoing.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 21.3, flow: 'imports' },
      { countryId: 'united-states', sharePct: 14.8, flow: 'exports' },
      { countryId: 'south-korea', sharePct: 6.8, flow: 'balanced' },
      { countryId: 'australia', sharePct: 6.3, flow: 'imports' },
      { countryId: 'taiwan', sharePct: 6.4, flow: 'balanced' },
    ],
    geo: { lat: 36.2, lng: 138.3 },
  },
  'india': {
    demographics: { populationMillions: 1430, medianAge: 28.4, urbanizationPct: 36, youthSharePct: 26, netMigrationPer1000: -0.3 },
    energy: { netOilExportMbd: -4.8, netGasExportBcm: -32, energyImportDependencePct: 41, criticalMineralExporter: false, notes: 'Highly oil-import-dependent; expanding refining and renewables capacity.' },
    topTradePartners: [
      { countryId: 'united-states', sharePct: 11.7, flow: 'exports' },
      { countryId: 'china', sharePct: 11.0, flow: 'imports' },
      { countryId: 'uae', sharePct: 7.2, flow: 'balanced' },
      { countryId: 'saudi-arabia', sharePct: 5.7, flow: 'imports' },
      { countryId: 'russia', sharePct: 4.1, flow: 'imports' },
    ],
    geo: { lat: 22.3, lng: 78.6 },
  },
  'brazil': {
    demographics: { populationMillions: 215, medianAge: 33.5, urbanizationPct: 88, youthSharePct: 22, netMigrationPer1000: 0.1 },
    energy: { netOilExportMbd: 1.7, netGasExportBcm: -8, energyImportDependencePct: 15, criticalMineralExporter: true, notes: 'Major iron-ore and niobium exporter; oil exporter; ethanol leadership.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 28.2, flow: 'exports' },
      { countryId: 'united-states', sharePct: 12.4, flow: 'balanced' },
      { countryId: 'argentina', sharePct: 5.0, flow: 'exports' },
      { countryId: 'germany', sharePct: 3.6, flow: 'imports' },
      { countryId: 'mexico', sharePct: 3.0, flow: 'exports' },
    ],
    geo: { lat: -14.2, lng: -51.9 },
  },
  'mexico': {
    demographics: { populationMillions: 129, medianAge: 30.0, urbanizationPct: 81, youthSharePct: 24, netMigrationPer1000: -0.6 },
    energy: { netOilExportMbd: 0.3, netGasExportBcm: -45, energyImportDependencePct: 22, criticalMineralExporter: true, notes: 'Top-five silver and copper producer.' },
    topTradePartners: [
      { countryId: 'united-states', sharePct: 64.0, flow: 'balanced' },
      { countryId: 'china', sharePct: 9.0, flow: 'imports' },
      { countryId: 'canada', sharePct: 3.0, flow: 'balanced' },
      { countryId: 'germany', sharePct: 2.5, flow: 'imports' },
      { countryId: 'brazil', sharePct: 1.8, flow: 'imports' },
    ],
    geo: { lat: 23.6, lng: -102.6 },
  },
  'canada': {
    demographics: { populationMillions: 40, medianAge: 41.6, urbanizationPct: 82, youthSharePct: 18, netMigrationPer1000: 11.3 },
    energy: { netOilExportMbd: 3.6, netGasExportBcm: 80, energyImportDependencePct: -55, criticalMineralExporter: true, notes: 'Top-tier uranium, nickel, potash, and aluminium exporter.' },
    topTradePartners: [
      { countryId: 'united-states', sharePct: 64.0, flow: 'balanced' },
      { countryId: 'china', sharePct: 6.8, flow: 'imports' },
      { countryId: 'mexico', sharePct: 3.5, flow: 'balanced' },
      { countryId: 'japan', sharePct: 2.3, flow: 'exports' },
      { countryId: 'germany', sharePct: 1.8, flow: 'imports' },
    ],
    geo: { lat: 56.1, lng: -106.3 },
  },
  'australia': {
    demographics: { populationMillions: 27, medianAge: 38.1, urbanizationPct: 87, youthSharePct: 19, netMigrationPer1000: 12.2 },
    energy: { netOilExportMbd: -0.4, netGasExportBcm: 105, energyImportDependencePct: -120, criticalMineralExporter: true, notes: 'Top global LNG, iron-ore, lithium, and metallurgical-coal exporter.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 35.0, flow: 'exports' },
      { countryId: 'japan', sharePct: 11.0, flow: 'exports' },
      { countryId: 'south-korea', sharePct: 7.5, flow: 'exports' },
      { countryId: 'united-states', sharePct: 6.8, flow: 'imports' },
      { countryId: 'india', sharePct: 4.2, flow: 'exports' },
    ],
    geo: { lat: -25.3, lng: 133.8 },
  },
  'south-korea': {
    demographics: { populationMillions: 51, medianAge: 45.0, urbanizationPct: 81, youthSharePct: 16, netMigrationPer1000: 1.0 },
    energy: { netOilExportMbd: -2.5, netGasExportBcm: -55, energyImportDependencePct: 84, criticalMineralExporter: false, notes: 'Highly import-dependent; LNG and refined products critical.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 22.8, flow: 'balanced' },
      { countryId: 'united-states', sharePct: 14.5, flow: 'exports' },
      { countryId: 'japan', sharePct: 6.6, flow: 'imports' },
      { countryId: 'vietnam', sharePct: 5.4, flow: 'exports' },
      { countryId: 'taiwan', sharePct: 3.7, flow: 'balanced' },
    ],
    geo: { lat: 36.5, lng: 127.8 },
  },
  'indonesia': {
    demographics: { populationMillions: 278, medianAge: 30.2, urbanizationPct: 58, youthSharePct: 25, netMigrationPer1000: -0.5 },
    energy: { netOilExportMbd: -0.9, netGasExportBcm: 25, energyImportDependencePct: 5, criticalMineralExporter: true, notes: 'Top global nickel producer; coal exporter; LNG exporter.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 25.0, flow: 'balanced' },
      { countryId: 'united-states', sharePct: 9.8, flow: 'exports' },
      { countryId: 'japan', sharePct: 8.5, flow: 'exports' },
      { countryId: 'singapore', sharePct: 7.5, flow: 'imports' },
      { countryId: 'india', sharePct: 7.2, flow: 'exports' },
    ],
    geo: { lat: -2.5, lng: 117.0 },
  },
  'turkey': {
    demographics: { populationMillions: 86, medianAge: 33.1, urbanizationPct: 77, youthSharePct: 22, netMigrationPer1000: 0.3 },
    energy: { netOilExportMbd: -1.0, netGasExportBcm: -50, energyImportDependencePct: 73, criticalMineralExporter: false, notes: 'Major hydrocarbon importer; key transit hub for Caspian and Russian flows.' },
    topTradePartners: [
      { countryId: 'germany', sharePct: 8.5, flow: 'exports' },
      { countryId: 'russia', sharePct: 11.0, flow: 'imports' },
      { countryId: 'china', sharePct: 11.5, flow: 'imports' },
      { countryId: 'united-states', sharePct: 6.0, flow: 'exports' },
      { countryId: 'iraq', sharePct: 4.0, flow: 'exports' },
    ],
    geo: { lat: 39.0, lng: 35.2 },
  },
  'saudi-arabia': {
    demographics: { populationMillions: 36, medianAge: 32.0, urbanizationPct: 85, youthSharePct: 24, netMigrationPer1000: 2.5 },
    energy: { netOilExportMbd: 7.4, netGasExportBcm: 0, energyImportDependencePct: -70, criticalMineralExporter: false, notes: 'World swing producer; OPEC+ leader; growing petrochemicals exposure.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 17.0, flow: 'exports' },
      { countryId: 'india', sharePct: 11.0, flow: 'exports' },
      { countryId: 'japan', sharePct: 9.5, flow: 'exports' },
      { countryId: 'united-states', sharePct: 8.2, flow: 'imports' },
      { countryId: 'south-korea', sharePct: 7.8, flow: 'exports' },
    ],
    geo: { lat: 24.0, lng: 45.0 },
  },
  'iran': {
    demographics: { populationMillions: 89, medianAge: 33.4, urbanizationPct: 76, youthSharePct: 23, netMigrationPer1000: -0.5 },
    energy: { netOilExportMbd: 1.5, netGasExportBcm: 12, energyImportDependencePct: -55, criticalMineralExporter: false, notes: 'Sanctions-compressed oil exports; large gas reserves with limited monetization.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 30.0, flow: 'exports' },
      { countryId: 'uae', sharePct: 16.0, flow: 'imports' },
      { countryId: 'iraq', sharePct: 9.0, flow: 'exports' },
      { countryId: 'turkey', sharePct: 8.5, flow: 'balanced' },
      { countryId: 'india', sharePct: 4.5, flow: 'exports' },
    ],
    geo: { lat: 32.4, lng: 53.7 },
  },
  'israel': {
    demographics: { populationMillions: 9.7, medianAge: 30.6, urbanizationPct: 93, youthSharePct: 22, netMigrationPer1000: 1.3 },
    energy: { netOilExportMbd: -0.25, netGasExportBcm: 9, energyImportDependencePct: 50, criticalMineralExporter: false, notes: 'Eastern Mediterranean gas producer; oil-import dependent.' },
    topTradePartners: [
      { countryId: 'united-states', sharePct: 19.5, flow: 'balanced' },
      { countryId: 'china', sharePct: 9.5, flow: 'imports' },
      { countryId: 'germany', sharePct: 5.5, flow: 'imports' },
      { countryId: 'india', sharePct: 4.4, flow: 'exports' },
      { countryId: 'turkey', sharePct: 4.7, flow: 'balanced' },
    ],
    geo: { lat: 31.5, lng: 34.9 },
  },
  'ukraine': {
    demographics: { populationMillions: 33, medianAge: 41.3, urbanizationPct: 70, youthSharePct: 16, netMigrationPer1000: -10.5 },
    energy: { netOilExportMbd: -0.2, netGasExportBcm: -10, energyImportDependencePct: 35, criticalMineralExporter: true, notes: 'Major iron-ore, manganese, titanium and grain exporter; pipeline transit role disrupted by war.' },
    topTradePartners: [
      { countryId: 'poland', sharePct: 11.0, flow: 'balanced' },
      { countryId: 'china', sharePct: 8.5, flow: 'imports' },
      { countryId: 'germany', sharePct: 8.0, flow: 'imports' },
      { countryId: 'turkey', sharePct: 5.8, flow: 'balanced' },
      { countryId: 'romania', sharePct: 4.5, flow: 'exports' },
    ],
    geo: { lat: 48.4, lng: 31.2 },
  },
  'poland': {
    demographics: { populationMillions: 38, medianAge: 42.6, urbanizationPct: 60, youthSharePct: 16, netMigrationPer1000: 1.5 },
    energy: { netOilExportMbd: -0.6, netGasExportBcm: -15, energyImportDependencePct: 45, criticalMineralExporter: false, notes: 'Coal-heavy electricity mix transitioning to LNG and nuclear.' },
    topTradePartners: [
      { countryId: 'germany', sharePct: 27.0, flow: 'balanced' },
      { countryId: 'czechia', sharePct: 6.2, flow: 'exports' },
      { countryId: 'france', sharePct: 5.8, flow: 'exports' },
      { countryId: 'netherlands', sharePct: 4.3, flow: 'imports' },
      { countryId: 'ukraine', sharePct: 3.0, flow: 'exports' },
    ],
    geo: { lat: 51.9, lng: 19.1 },
  },
  'italy': {
    demographics: { populationMillions: 59, medianAge: 47.5, urbanizationPct: 71, youthSharePct: 14, netMigrationPer1000: 3.0 },
    energy: { netOilExportMbd: -1.2, netGasExportBcm: -65, energyImportDependencePct: 73, criticalMineralExporter: false, notes: 'Highly gas-import dependent; Mediterranean LNG hubs growing.' },
    topTradePartners: [
      { countryId: 'germany', sharePct: 12.5, flow: 'balanced' },
      { countryId: 'france', sharePct: 10.5, flow: 'exports' },
      { countryId: 'united-states', sharePct: 10.4, flow: 'exports' },
      { countryId: 'china', sharePct: 6.2, flow: 'imports' },
      { countryId: 'spain', sharePct: 5.4, flow: 'balanced' },
    ],
    geo: { lat: 41.9, lng: 12.6 },
  },
  'spain': {
    demographics: { populationMillions: 48, medianAge: 44.7, urbanizationPct: 81, youthSharePct: 16, netMigrationPer1000: 4.6 },
    energy: { netOilExportMbd: -1.0, netGasExportBcm: -32, energyImportDependencePct: 70, criticalMineralExporter: false, notes: 'Top European LNG regasification capacity.' },
    topTradePartners: [
      { countryId: 'france', sharePct: 14.0, flow: 'balanced' },
      { countryId: 'germany', sharePct: 10.6, flow: 'balanced' },
      { countryId: 'italy', sharePct: 7.6, flow: 'balanced' },
      { countryId: 'united-states', sharePct: 4.5, flow: 'exports' },
      { countryId: 'morocco', sharePct: 3.0, flow: 'exports' },
    ],
    geo: { lat: 40.5, lng: -3.7 },
  },
  'argentina': {
    demographics: { populationMillions: 46, medianAge: 32.8, urbanizationPct: 92, youthSharePct: 22, netMigrationPer1000: 0 },
    energy: { netOilExportMbd: 0.1, netGasExportBcm: -3, energyImportDependencePct: 8, criticalMineralExporter: true, notes: 'Vaca Muerta shale unlocks emerging gas-export potential; lithium triangle.' },
    topTradePartners: [
      { countryId: 'brazil', sharePct: 14.5, flow: 'balanced' },
      { countryId: 'china', sharePct: 13.0, flow: 'imports' },
      { countryId: 'united-states', sharePct: 8.8, flow: 'imports' },
      { countryId: 'chile', sharePct: 5.0, flow: 'exports' },
      { countryId: 'india', sharePct: 4.0, flow: 'exports' },
    ],
    geo: { lat: -38.4, lng: -63.6 },
  },
  'south-africa': {
    demographics: { populationMillions: 60, medianAge: 28.0, urbanizationPct: 67, youthSharePct: 27, netMigrationPer1000: 1.5 },
    energy: { netOilExportMbd: -0.5, netGasExportBcm: -3, energyImportDependencePct: 18, criticalMineralExporter: true, notes: 'Top global producer of platinum-group metals, manganese, and chrome.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 13.5, flow: 'balanced' },
      { countryId: 'germany', sharePct: 8.0, flow: 'balanced' },
      { countryId: 'united-states', sharePct: 7.6, flow: 'exports' },
      { countryId: 'india', sharePct: 4.2, flow: 'exports' },
      { countryId: 'japan', sharePct: 4.5, flow: 'exports' },
    ],
    geo: { lat: -30.6, lng: 22.9 },
  },
  'egypt': {
    demographics: { populationMillions: 110, medianAge: 24.6, urbanizationPct: 43, youthSharePct: 27, netMigrationPer1000: -0.4 },
    energy: { netOilExportMbd: -0.1, netGasExportBcm: 4, energyImportDependencePct: 8, criticalMineralExporter: false, notes: 'Suez Canal transit; eastern Mediterranean gas hub.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 14.5, flow: 'imports' },
      { countryId: 'saudi-arabia', sharePct: 8.0, flow: 'imports' },
      { countryId: 'turkey', sharePct: 5.5, flow: 'exports' },
      { countryId: 'united-states', sharePct: 5.8, flow: 'balanced' },
      { countryId: 'italy', sharePct: 5.2, flow: 'exports' },
    ],
    geo: { lat: 26.8, lng: 30.8 },
  },
  'nigeria': {
    demographics: { populationMillions: 220, medianAge: 17.6, urbanizationPct: 54, youthSharePct: 30, netMigrationPer1000: -0.4 },
    energy: { netOilExportMbd: 1.4, netGasExportBcm: 25, energyImportDependencePct: -55, criticalMineralExporter: false, notes: 'OPEC member; LNG exporter; structural fuel-import dependence due to refining gap.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 17.5, flow: 'imports' },
      { countryId: 'india', sharePct: 12.0, flow: 'exports' },
      { countryId: 'spain', sharePct: 8.0, flow: 'exports' },
      { countryId: 'netherlands', sharePct: 5.5, flow: 'exports' },
      { countryId: 'united-states', sharePct: 5.0, flow: 'balanced' },
    ],
    geo: { lat: 9.1, lng: 8.7 },
  },
  'pakistan': {
    demographics: { populationMillions: 240, medianAge: 20.6, urbanizationPct: 38, youthSharePct: 28, netMigrationPer1000: -1.6 },
    energy: { netOilExportMbd: -0.5, netGasExportBcm: -10, energyImportDependencePct: 26, criticalMineralExporter: false, notes: 'Severe energy-import strain; recurrent IMF programs.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 24.0, flow: 'imports' },
      { countryId: 'united-states', sharePct: 13.0, flow: 'exports' },
      { countryId: 'uae', sharePct: 9.5, flow: 'imports' },
      { countryId: 'saudi-arabia', sharePct: 5.0, flow: 'imports' },
      { countryId: 'germany', sharePct: 4.5, flow: 'exports' },
    ],
    geo: { lat: 30.4, lng: 69.3 },
  },
  'taiwan': {
    demographics: { populationMillions: 23.4, medianAge: 43.5, urbanizationPct: 80, youthSharePct: 16, netMigrationPer1000: 0.2 },
    energy: { netOilExportMbd: -1.0, netGasExportBcm: -22, energyImportDependencePct: 97, criticalMineralExporter: false, notes: 'Highly import-dependent; LNG strategic vulnerability.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 22.5, flow: 'exports' },
      { countryId: 'united-states', sharePct: 16.0, flow: 'exports' },
      { countryId: 'japan', sharePct: 11.0, flow: 'imports' },
      { countryId: 'south-korea', sharePct: 7.0, flow: 'imports' },
      { countryId: 'singapore', sharePct: 4.5, flow: 'exports' },
    ],
    geo: { lat: 23.7, lng: 121.0 },
  },
  'vietnam': {
    demographics: { populationMillions: 99, medianAge: 32.5, urbanizationPct: 39, youthSharePct: 22, netMigrationPer1000: -0.3 },
    energy: { netOilExportMbd: -0.4, netGasExportBcm: 0, energyImportDependencePct: 18, criticalMineralExporter: true, notes: 'Top-five global rare-earth reserve holder; coal-heavy power mix.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 24.0, flow: 'balanced' },
      { countryId: 'united-states', sharePct: 18.5, flow: 'exports' },
      { countryId: 'south-korea', sharePct: 11.5, flow: 'imports' },
      { countryId: 'japan', sharePct: 7.0, flow: 'exports' },
      { countryId: 'thailand', sharePct: 4.5, flow: 'imports' },
    ],
    geo: { lat: 16.0, lng: 108.0 },
  },
  'philippines': {
    demographics: { populationMillions: 117, medianAge: 25.7, urbanizationPct: 48, youthSharePct: 27, netMigrationPer1000: -0.6 },
    energy: { netOilExportMbd: -0.4, netGasExportBcm: 0, energyImportDependencePct: 50, criticalMineralExporter: true, notes: 'Top global nickel producer; growing LNG imports.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 19.0, flow: 'imports' },
      { countryId: 'united-states', sharePct: 15.5, flow: 'exports' },
      { countryId: 'japan', sharePct: 14.0, flow: 'exports' },
      { countryId: 'south-korea', sharePct: 6.5, flow: 'imports' },
      { countryId: 'singapore', sharePct: 6.0, flow: 'balanced' },
    ],
    geo: { lat: 12.9, lng: 121.8 },
  },
  'thailand': {
    demographics: { populationMillions: 71, medianAge: 40.1, urbanizationPct: 53, youthSharePct: 18, netMigrationPer1000: 0.3 },
    energy: { netOilExportMbd: -0.7, netGasExportBcm: -8, energyImportDependencePct: 50, criticalMineralExporter: false, notes: 'Net energy importer; auto and electronics export hub.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 19.5, flow: 'imports' },
      { countryId: 'united-states', sharePct: 13.5, flow: 'exports' },
      { countryId: 'japan', sharePct: 11.5, flow: 'imports' },
      { countryId: 'malaysia', sharePct: 4.5, flow: 'balanced' },
      { countryId: 'vietnam', sharePct: 4.5, flow: 'exports' },
    ],
    geo: { lat: 15.9, lng: 101.0 },
  },
  'singapore': {
    demographics: { populationMillions: 5.9, medianAge: 42.8, urbanizationPct: 100, youthSharePct: 17, netMigrationPer1000: 4.5 },
    energy: { netOilExportMbd: -0.3, netGasExportBcm: -12, energyImportDependencePct: 95, criticalMineralExporter: false, notes: 'Strait of Malacca refining and bunkering hub.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 14.5, flow: 'balanced' },
      { countryId: 'united-states', sharePct: 11.5, flow: 'balanced' },
      { countryId: 'malaysia', sharePct: 10.0, flow: 'balanced' },
      { countryId: 'taiwan', sharePct: 7.5, flow: 'imports' },
      { countryId: 'indonesia', sharePct: 7.0, flow: 'balanced' },
    ],
    geo: { lat: 1.35, lng: 103.8 },
  },
  'uae': {
    demographics: { populationMillions: 9.5, medianAge: 33.5, urbanizationPct: 87, youthSharePct: 19, netMigrationPer1000: 5.0 },
    energy: { netOilExportMbd: 2.6, netGasExportBcm: 5, energyImportDependencePct: -75, criticalMineralExporter: false, notes: 'OPEC producer; growing nuclear and solar capacity.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 18.0, flow: 'imports' },
      { countryId: 'india', sharePct: 13.0, flow: 'balanced' },
      { countryId: 'saudi-arabia', sharePct: 7.5, flow: 'exports' },
      { countryId: 'united-states', sharePct: 6.0, flow: 'imports' },
      { countryId: 'iran', sharePct: 4.0, flow: 'imports' },
    ],
    geo: { lat: 23.4, lng: 53.8 },
  },
  'qatar': {
    demographics: { populationMillions: 3.0, medianAge: 32.2, urbanizationPct: 99, youthSharePct: 17, netMigrationPer1000: 6.0 },
    energy: { netOilExportMbd: 1.5, netGasExportBcm: 145, energyImportDependencePct: -350, criticalMineralExporter: false, notes: 'Top-three global LNG exporter.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 18.0, flow: 'exports' },
      { countryId: 'japan', sharePct: 14.5, flow: 'exports' },
      { countryId: 'india', sharePct: 11.0, flow: 'exports' },
      { countryId: 'south-korea', sharePct: 12.5, flow: 'exports' },
      { countryId: 'united-states', sharePct: 6.0, flow: 'imports' },
    ],
    geo: { lat: 25.4, lng: 51.2 },
  },
  'norway': {
    demographics: { populationMillions: 5.5, medianAge: 40.0, urbanizationPct: 84, youthSharePct: 18, netMigrationPer1000: 4.5 },
    energy: { netOilExportMbd: 1.6, netGasExportBcm: 110, energyImportDependencePct: -550, criticalMineralExporter: false, notes: 'Largest European gas supplier post-2022.' },
    topTradePartners: [
      { countryId: 'united-kingdom', sharePct: 19.0, flow: 'exports' },
      { countryId: 'germany', sharePct: 16.5, flow: 'exports' },
      { countryId: 'netherlands', sharePct: 9.0, flow: 'exports' },
      { countryId: 'sweden', sharePct: 7.5, flow: 'imports' },
      { countryId: 'france', sharePct: 6.5, flow: 'exports' },
    ],
    geo: { lat: 60.5, lng: 8.5 },
  },
  'kazakhstan': {
    demographics: { populationMillions: 20, medianAge: 31.6, urbanizationPct: 58, youthSharePct: 22, netMigrationPer1000: -0.6 },
    energy: { netOilExportMbd: 1.5, netGasExportBcm: 2, energyImportDependencePct: -120, criticalMineralExporter: true, notes: 'Top global uranium producer; significant chrome and copper.' },
    topTradePartners: [
      { countryId: 'russia', sharePct: 19.0, flow: 'balanced' },
      { countryId: 'china', sharePct: 19.5, flow: 'balanced' },
      { countryId: 'italy', sharePct: 7.5, flow: 'exports' },
      { countryId: 'turkey', sharePct: 5.0, flow: 'exports' },
      { countryId: 'south-korea', sharePct: 4.5, flow: 'exports' },
    ],
    geo: { lat: 48.0, lng: 66.9 },
  },
  'venezuela': {
    demographics: { populationMillions: 28, medianAge: 30.3, urbanizationPct: 88, youthSharePct: 24, netMigrationPer1000: -8.5 },
    energy: { netOilExportMbd: 0.7, netGasExportBcm: 0, energyImportDependencePct: -120, criticalMineralExporter: false, notes: 'World-largest oil reserves but degraded production capacity; sanctions-affected.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 25.0, flow: 'exports' },
      { countryId: 'united-states', sharePct: 30.0, flow: 'exports' },
      { countryId: 'india', sharePct: 18.0, flow: 'exports' },
      { countryId: 'brazil', sharePct: 5.0, flow: 'imports' },
      { countryId: 'colombia', sharePct: 4.0, flow: 'imports' },
    ],
    geo: { lat: 6.4, lng: -66.6 },
  },
  'ethiopia': {
    demographics: { populationMillions: 126, medianAge: 19.0, urbanizationPct: 23, youthSharePct: 28, netMigrationPer1000: -0.2 },
    energy: { netOilExportMbd: -0.1, netGasExportBcm: 0, energyImportDependencePct: 25, criticalMineralExporter: false, notes: 'Hydropower-heavy; GERD operational.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 24.0, flow: 'imports' },
      { countryId: 'india', sharePct: 7.0, flow: 'imports' },
      { countryId: 'united-states', sharePct: 6.0, flow: 'exports' },
      { countryId: 'saudi-arabia', sharePct: 5.0, flow: 'imports' },
      { countryId: 'uae', sharePct: 5.0, flow: 'balanced' },
    ],
    geo: { lat: 9.1, lng: 40.5 },
  },
  'kenya': {
    demographics: { populationMillions: 55, medianAge: 20.1, urbanizationPct: 30, youthSharePct: 28, netMigrationPer1000: -0.2 },
    energy: { netOilExportMbd: -0.1, netGasExportBcm: 0, energyImportDependencePct: 18, criticalMineralExporter: false, notes: 'Geothermal and hydropower mix; East African transit hub.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 18.5, flow: 'imports' },
      { countryId: 'india', sharePct: 9.5, flow: 'imports' },
      { countryId: 'uae', sharePct: 9.0, flow: 'imports' },
      { countryId: 'united-states', sharePct: 6.5, flow: 'exports' },
      { countryId: 'tanzania', sharePct: 4.0, flow: 'exports' },
    ],
    geo: { lat: -0.0, lng: 37.9 },
  },
  'morocco': {
    demographics: { populationMillions: 38, medianAge: 30.0, urbanizationPct: 64, youthSharePct: 23, netMigrationPer1000: -2.5 },
    energy: { netOilExportMbd: -0.3, netGasExportBcm: -1, energyImportDependencePct: 90, criticalMineralExporter: true, notes: 'World-largest phosphate reserves and producer.' },
    topTradePartners: [
      { countryId: 'spain', sharePct: 22.0, flow: 'balanced' },
      { countryId: 'france', sharePct: 19.0, flow: 'balanced' },
      { countryId: 'china', sharePct: 9.5, flow: 'imports' },
      { countryId: 'united-states', sharePct: 7.0, flow: 'imports' },
      { countryId: 'germany', sharePct: 5.0, flow: 'exports' },
    ],
    geo: { lat: 31.8, lng: -7.1 },
  },
  'algeria': {
    demographics: { populationMillions: 46, medianAge: 28.9, urbanizationPct: 75, youthSharePct: 24, netMigrationPer1000: -0.7 },
    energy: { netOilExportMbd: 0.7, netGasExportBcm: 50, energyImportDependencePct: -250, criticalMineralExporter: false, notes: 'Major Mediterranean gas supplier; OPEC+ member.' },
    topTradePartners: [
      { countryId: 'italy', sharePct: 14.0, flow: 'exports' },
      { countryId: 'france', sharePct: 13.0, flow: 'balanced' },
      { countryId: 'spain', sharePct: 12.0, flow: 'exports' },
      { countryId: 'china', sharePct: 16.0, flow: 'imports' },
      { countryId: 'turkey', sharePct: 6.0, flow: 'balanced' },
    ],
    geo: { lat: 28.0, lng: 1.7 },
  },
  'iraq': {
    demographics: { populationMillions: 44, medianAge: 21.2, urbanizationPct: 71, youthSharePct: 28, netMigrationPer1000: -0.3 },
    energy: { netOilExportMbd: 3.4, netGasExportBcm: -3, energyImportDependencePct: -200, criticalMineralExporter: false, notes: 'OPEC second-largest producer; export reliance > 90% of revenue.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 30.0, flow: 'exports' },
      { countryId: 'india', sharePct: 18.0, flow: 'exports' },
      { countryId: 'united-states', sharePct: 12.0, flow: 'exports' },
      { countryId: 'turkey', sharePct: 9.0, flow: 'imports' },
      { countryId: 'south-korea', sharePct: 8.0, flow: 'exports' },
    ],
    geo: { lat: 33.2, lng: 43.7 },
  },
  'north-korea': {
    demographics: { populationMillions: 26, medianAge: 35.6, urbanizationPct: 63, youthSharePct: 21, netMigrationPer1000: 0 },
    energy: { netOilExportMbd: -0.05, netGasExportBcm: 0, energyImportDependencePct: 70, criticalMineralExporter: true, notes: 'Sanctions-isolated; coal and rare-earth reserves with limited export channels.' },
    topTradePartners: [
      { countryId: 'china', sharePct: 96.0, flow: 'balanced' },
      { countryId: 'russia', sharePct: 2.5, flow: 'balanced' },
    ],
    geo: { lat: 40.3, lng: 127.0 },
  },
};
