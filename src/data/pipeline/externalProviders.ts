import type { CountryProfile } from '../../types';
import { WB_INDICATOR_BY_KEY, type WbIndicatorKey } from '../../lib/worldBankFetch';
import { iso2ToCountryId } from '../worldBankClient';
import type { WeoObservation } from '../imfWeoClient';
import type { IndicatorObservation } from './types';
import { toCohesionValue, toMilitaryTier, toRuleOfLawTier, toStabilityTier, toTradeTier } from './transformers';

export interface IngestedSnapshot {
  version: string;
  timestamp: string;
  countryCountRequested?: number;
  /** ISO year selected per country and indicator during ingestion. */
  observationYears?: Partial<Record<SnapshotIndicatorKey, Record<string, string>>>;
  /** ISO observation dates emitted by the newer multi-source ingest. */
  observation_dates?: Partial<Record<SnapshotIndicatorKey, Record<string, string>>>;
  world_bank_military_expenditure_pct?: Record<string, number>;
  world_bank_military_expenditure_usd?: Record<string, number>;
  world_bank_trade_pct?: Record<string, number>;
  world_bank_gdp_growth?: Record<string, number>;
  world_bank_gdp_nominal_usd?: Record<string, number>;
  world_bank_gdp_usd?: Record<string, number>;
  world_bank_gdp_per_capita_usd?: Record<string, number>;
  world_bank_inflation?: Record<string, number>;
  world_bank_political_stability?: Record<string, number>;
  world_bank_rule_of_law?: Record<string, number>;
  world_bank_unemployment?: Record<string, number>;
  world_bank_population?: Record<string, number>;
  world_bank_urban_pct?: Record<string, number>;
  world_bank_energy_import_pct?: Record<string, number>;
}

export interface ImfWeoSnapshot {
  version: string;
  timestamp: string;
  countryCountRequested?: number;
  imf_gdp_growth?: Record<string, WeoObservation>;
  imf_inflation?: Record<string, WeoObservation>;
  imf_gdp_usd_billions?: Record<string, WeoObservation>;
  imf_gdp_per_capita_usd?: Record<string, WeoObservation>;
  imf_unemployment?: Record<string, WeoObservation>;
  imf_government_debt_pct_gdp?: Record<string, WeoObservation>;
  imf_current_account_pct_gdp?: Record<string, WeoObservation>;
  imf_population_millions?: Record<string, WeoObservation>;
}

interface RawWorldBankPoint {
  country: {
    id: string;
    value: string;
  };
  date: string;
  value: number | null;
}

export interface RawWorldBankAuditPayload {
  fetchedAt: string;
  indicators?: Record<string, RawWorldBankPoint[]>;
}

const mapIndicatorCodeToSnapshotKey = {
  'MS.MIL.XPND.GD.ZS': 'world_bank_military_expenditure_pct',
  'MS.MIL.XPND.CD': 'world_bank_military_expenditure_usd',
  'TG.VAL.TOTL.GD.ZS': 'world_bank_trade_pct',
  'NY.GDP.MKTP.KD.ZG': 'world_bank_gdp_growth',
  'NY.GDP.MKTP.CD': 'world_bank_gdp_nominal_usd',
  'NY.GDP.PCAP.CD': 'world_bank_gdp_per_capita_usd',
  'FP.CPI.TOTL.ZG': 'world_bank_inflation',
  // Accept both the canonical indicator code and the WGI wire code used by
  // older raw audit artifacts.
  'PV.EST': 'world_bank_political_stability',
  'GOV_WGI_PV.EST': 'world_bank_political_stability',
  'RL.EST': 'world_bank_rule_of_law',
  'GOV_WGI_RL.EST': 'world_bank_rule_of_law',
  'SL.UEM.TOTL.ZS': 'world_bank_unemployment',
  'SP.POP.TOTL': 'world_bank_population',
  'SP.URB.TOTL.IN.ZS': 'world_bank_urban_pct',
  'EG.IMP.CONS.ZS': 'world_bank_energy_import_pct',
} as const satisfies Record<string, keyof IngestedSnapshot>;

export type SnapshotIndicatorKey =
  | (typeof mapIndicatorCodeToSnapshotKey)[keyof typeof mapIndicatorCodeToSnapshotKey]
  | 'world_bank_gdp_usd';
export type ObservedAtIndex = Record<SnapshotIndicatorKey, Record<string, string>>;

const normalizeObservedAt = (date: string): string => {
  if (/^\d{4}$/.test(date)) return `${date}-12-31`;
  return date.slice(0, 10);
};

export const buildObservedAtIndex = (
  snapshot: IngestedSnapshot,
  rawAudit?: RawWorldBankAuditPayload,
): ObservedAtIndex => {
  const empty: ObservedAtIndex = {
    world_bank_military_expenditure_pct: {},
    world_bank_military_expenditure_usd: {},
    world_bank_trade_pct: {},
    world_bank_gdp_growth: {},
    world_bank_gdp_nominal_usd: {},
    world_bank_gdp_per_capita_usd: {},
    world_bank_inflation: {},
    world_bank_political_stability: {},
    world_bank_rule_of_law: {},
    world_bank_unemployment: {},
    world_bank_population: {},
    world_bank_urban_pct: {},
    world_bank_gdp_usd: {},
    world_bank_energy_import_pct: {},
  };
  for (const indicator of Object.keys(empty) as SnapshotIndicatorKey[]) {
    Object.assign(
      empty[indicator],
      snapshot.observation_dates?.[indicator] ?? snapshot.observationYears?.[indicator] ?? {},
    );
  }

  // The older snapshot called this series `gdp_nominal`; retain date parity in
  // both directions while artifacts roll forward.
  if (Object.keys(empty.world_bank_gdp_usd).length === 0) {
    Object.assign(empty.world_bank_gdp_usd, empty.world_bank_gdp_nominal_usd);
  }
  if (Object.keys(empty.world_bank_gdp_nominal_usd).length === 0) {
    Object.assign(empty.world_bank_gdp_nominal_usd, empty.world_bank_gdp_usd);
  }

  if (!rawAudit?.indicators) return empty;

  for (const [code, points] of Object.entries(rawAudit.indicators)) {
    const snapshotKey = mapIndicatorCodeToSnapshotKey[code as keyof typeof mapIndicatorCodeToSnapshotKey];
    if (!snapshotKey) continue;
    for (const point of points) {
      const countryId = iso2ToCountryId[point.country.id.toUpperCase()];
      if (!countryId || point.value == null || empty[snapshotKey][countryId]) continue;
      empty[snapshotKey][countryId] = normalizeObservedAt(point.date);
    }
  }
  return empty;
};

/** Skip WDI rows older than this so curated fallbacks can fill sparse reporters. */
const MAX_INGEST_OBSERVATION_AGE_DAYS = 6 * 365;

const isObservationTooOld = (observedAt: string): boolean => {
  const ts = new Date(observedAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > MAX_INGEST_OBSERVATION_AGE_DAYS * 24 * 60 * 60 * 1000;
};

const worldBankSourceId = (key: WbIndicatorKey) =>
  WB_INDICATOR_BY_KEY.get(key)?.provenanceSourceId ?? 'world-bank-wdi';

export const buildImfWeoObservations = (
  profiles: CountryProfile[],
  weo: ImfWeoSnapshot,
): IndicatorObservation[] => {
  const observations: IndicatorObservation[] = [];
  const seriesUpdatedAt = weo.timestamp.slice(0, 10);

  for (const profile of profiles) {
    const growth = weo.imf_gdp_growth?.[profile.id];
    const inflation = weo.imf_inflation?.[profile.id];
    const unemployment = weo.imf_unemployment?.[profile.id];
    const present = [growth, inflation, unemployment].filter(
      (entry): entry is WeoObservation => entry != null,
    );
    if (present.length === 0) continue;
    const vintage = present.map((entry) => entry.year).sort().at(-1);

    observations.push({
      providerId: 'imf-weo-ingest',
      sourceId: 'imf-weo',
      countryId: profile.id,
      indicator: 'cohesion',
      value: toCohesionValue(
        profile.indicators.cohesion,
        growth?.value ?? null,
        inflation?.value ?? null,
        unemployment?.value ?? null,
      ),
      observedAt: vintage ? `${vintage}-12-31` : seriesUpdatedAt,
      method: 'snapshot',
      confidence: 0.78,
      ...(vintage ? { vintage } : {}),
      seriesUpdatedAt,
      ...(present.some((entry) => entry.projection) ? { projection: true } : {}),
    });
  }

  return observations;
};

export const buildIngestedObservations = (
  profiles: CountryProfile[],
  snapshot: IngestedSnapshot,
  rawAuditOrIndex?: RawWorldBankAuditPayload | ObservedAtIndex,
): IndicatorObservation[] => {
  const observations: IndicatorObservation[] = [];
  const fallbackObservedAt = snapshot.timestamp.slice(0, 10);
  const observedAtByIndicator = rawAuditOrIndex && 'world_bank_trade_pct' in rawAuditOrIndex
    ? rawAuditOrIndex as ObservedAtIndex
    : buildObservedAtIndex(snapshot, rawAuditOrIndex as RawWorldBankAuditPayload | undefined);

  for (const profile of profiles) {
    const geo = profile.id;
    const observationDateFor = (indicator: SnapshotIndicatorKey) =>
      observedAtByIndicator[indicator][geo] ?? fallbackObservedAt;

    const militaryExpPct = snapshot.world_bank_military_expenditure_pct?.[geo];
    if (militaryExpPct !== undefined) {
      const military = toMilitaryTier(militaryExpPct);
      const observedAt = observationDateFor('world_bank_military_expenditure_pct');
      if (military !== null && !isObservationTooOld(observedAt)) {
        observations.push({
          providerId: 'wb-military-ingest',
          sourceId: worldBankSourceId('militaryExpPct'),
          countryId: profile.id,
          indicator: 'militaryTreatyLevel', // Fallback proxy for treaty level for now
          value: military,
          observedAt,
          retrievedAt: snapshot.timestamp,
          method: 'snapshot',
          confidence: 0.90, // High confidence for official data
        });
      }
    }

    const tradePct = snapshot.world_bank_trade_pct?.[geo];
    if (tradePct !== undefined) {
      const trade = toTradeTier(tradePct);
      const observedAt = observationDateFor('world_bank_trade_pct');
      if (trade !== null && !isObservationTooOld(observedAt)) {
        observations.push({
          providerId: 'wb-trade-ingest',
          sourceId: worldBankSourceId('tradePct'),
          countryId: profile.id,
          indicator: 'tradeExposure',
          value: trade,
          observedAt,
          retrievedAt: snapshot.timestamp,
          method: 'snapshot',
          confidence: 0.88,
        });
      }
    }

    const politicalStability = snapshot.world_bank_political_stability?.[geo];
    const stability = toStabilityTier(politicalStability);
    const stabilityObservedAt = observationDateFor('world_bank_political_stability');
    if (stability !== null && !isObservationTooOld(stabilityObservedAt)) {
      observations.push({
        providerId: 'wb-governance-ingest',
        sourceId: worldBankSourceId('politicalStability'),
        countryId: profile.id,
        indicator: 'regimeStability',
        value: stability,
        observedAt: stabilityObservedAt,
        retrievedAt: snapshot.timestamp,
        method: 'snapshot',
        confidence: 0.8,
      });
    }

    const ruleOfLaw = snapshot.world_bank_rule_of_law?.[geo];
    const ruleOfLawTier = toRuleOfLawTier(ruleOfLaw);
    const ruleObservedAt = observationDateFor('world_bank_rule_of_law');
    if (ruleOfLawTier !== null && !isObservationTooOld(ruleObservedAt)) {
      observations.push({
        providerId: 'wb-governance-ingest',
        sourceId: worldBankSourceId('ruleOfLaw'),
        countryId: profile.id,
        indicator: 'regimeStability',
        value: ruleOfLawTier,
        observedAt: ruleObservedAt,
        retrievedAt: snapshot.timestamp,
        method: 'snapshot',
        confidence: 0.84,
      });
    }

    const gdpGrowth = snapshot.world_bank_gdp_growth?.[geo];
    const inflation = snapshot.world_bank_inflation?.[geo];
    const unemployment = snapshot.world_bank_unemployment?.[geo];
    if (gdpGrowth != null || inflation != null || unemployment != null) {
      // Cohesion uses three WB inputs; tag the observation with the most recent
      // available source date across those inputs for accurate staleness checks.
      const cohesionObservedDates = [
        observationDateFor('world_bank_gdp_growth'),
        observationDateFor('world_bank_inflation'),
        observationDateFor('world_bank_unemployment'),
      ];
      const observedAt = cohesionObservedDates.sort().at(-1) ?? fallbackObservedAt;
      if (!isObservationTooOld(observedAt)) {
        observations.push({
          providerId: 'wb-cohesion-ingest',
          sourceId: worldBankSourceId('gdpGrowth'),
          countryId: profile.id,
          indicator: 'cohesion',
          value: toCohesionValue(profile.indicators.cohesion, gdpGrowth, inflation, unemployment),
          observedAt,
          retrievedAt: snapshot.timestamp,
          method: 'snapshot',
          confidence: 0.74,
        });
      }
    }
  }

  return observations;
};
