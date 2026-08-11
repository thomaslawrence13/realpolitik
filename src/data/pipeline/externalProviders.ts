import type { CountryProfile } from '../../types';
import { iso2ToCountryId } from '../worldBankClient';
import type { WeoObservation } from '../imfWeoClient';
import type { IndicatorObservation } from './types';
import { toCohesionValue, toMilitaryTier, toRuleOfLawTier, toStabilityTier, toTradeTier } from './transformers';

export interface IngestedSnapshot {
  version: string;
  timestamp: string;
  countryCountRequested?: number;
  world_bank_military_expenditure_pct?: Record<string, number>;
  world_bank_trade_pct?: Record<string, number>;
  world_bank_gdp_growth?: Record<string, number>;
  world_bank_inflation?: Record<string, number>;
  world_bank_political_stability?: Record<string, number>;
  world_bank_rule_of_law?: Record<string, number>;
  world_bank_unemployment?: Record<string, number>;
  world_bank_population?: Record<string, number>;
  world_bank_urban_pct?: Record<string, number>;
  world_bank_gdp_usd?: Record<string, number>;
  world_bank_gdp_per_capita_usd?: Record<string, number>;
  world_bank_energy_import_pct?: Record<string, number>;
}

/**
 * IMF World Economic Outlook snapshot, written by `npm run ingest`.
 *
 * Each entry keeps its reference year alongside the value — the WEO's whole
 * advantage is currency, and a number is only as useful as the period it
 * describes. See `src/data/imfWeoClient.ts` for why this is ingested rather
 * than fetched live.
 */
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
  'TG.VAL.TOTL.GD.ZS': 'world_bank_trade_pct',
  'NY.GDP.MKTP.KD.ZG': 'world_bank_gdp_growth',
  'FP.CPI.TOTL.ZG': 'world_bank_inflation',
  'GOV_WGI_PV.EST': 'world_bank_political_stability',
  'GOV_WGI_RL.EST': 'world_bank_rule_of_law',
  'SL.UEM.TOTL.ZS': 'world_bank_unemployment',
  'SP.POP.TOTL': 'world_bank_population',
  'SP.URB.TOTL.IN.ZS': 'world_bank_urban_pct',
  'NY.GDP.MKTP.CD': 'world_bank_gdp_usd',
  'NY.GDP.PCAP.CD': 'world_bank_gdp_per_capita_usd',
  'EG.IMP.CONS.ZS': 'world_bank_energy_import_pct',
} as const satisfies Record<string, keyof IngestedSnapshot>;

export type SnapshotIndicatorKey =
  (typeof mapIndicatorCodeToSnapshotKey)[keyof typeof mapIndicatorCodeToSnapshotKey];

const normalizeObservedAt = (date: string): string => {
  if (/^\d{4}$/.test(date)) return `${date}-12-31`;
  return date.slice(0, 10);
};

/** countryId → ISO date of that country's newest observation, per snapshot key. */
export type ObservedAtIndex = Record<SnapshotIndicatorKey, Record<string, string>>;

/**
 * Recover the true reference date of each World Bank observation from the raw
 * audit payload.
 *
 * The normalized snapshot stores only values, so without this the best a caller
 * could do is date everything to the ingest run — which would report a 2024
 * military-spending figure as current. Picking the newest date per country
 * mirrors the ingest script's own `pickNewestValues`, rather than trusting the
 * API's row ordering.
 */
export const buildObservedAtIndex = (rawAudit?: RawWorldBankAuditPayload): ObservedAtIndex => {
  const index: ObservedAtIndex = {
    world_bank_military_expenditure_pct: {},
    world_bank_trade_pct: {},
    world_bank_gdp_growth: {},
    world_bank_inflation: {},
    world_bank_political_stability: {},
    world_bank_rule_of_law: {},
    world_bank_unemployment: {},
    world_bank_population: {},
    world_bank_urban_pct: {},
    world_bank_gdp_usd: {},
    world_bank_gdp_per_capita_usd: {},
    world_bank_energy_import_pct: {},
  };
  if (!rawAudit?.indicators) return index;

  for (const [code, points] of Object.entries(rawAudit.indicators)) {
    const snapshotKey = mapIndicatorCodeToSnapshotKey[code as keyof typeof mapIndicatorCodeToSnapshotKey];
    if (!snapshotKey) continue;
    for (const point of points) {
      const countryId = iso2ToCountryId[point.country.id.toUpperCase()];
      if (!countryId || point.value == null) continue;
      const observedAt = normalizeObservedAt(point.date);
      const existing = index[snapshotKey][countryId];
      if (!existing || observedAt > existing) {
        index[snapshotKey][countryId] = observedAt;
      }
    }
  }
  return index;
};

/** Skip WDI rows older than this so curated fallbacks can fill sparse reporters. */
const MAX_INGEST_OBSERVATION_AGE_DAYS = 6 * 365;

const isObservationTooOld = (observedAt: string): boolean => {
  const ts = new Date(observedAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > MAX_INGEST_OBSERVATION_AGE_DAYS * 24 * 60 * 60 * 1000;
};

/**
 * IMF WEO → indicator observations.
 *
 * The WEO is the freshest authoritative macro series we can reach, so it is
 * ranked ahead of the World Bank for `cohesion` in `rules.ts`. Confidence sits
 * just above the WDI ingest: the data is more current, and the tradeoff — recent
 * years being staff estimates — is carried explicitly on `projection` rather
 * than hidden in a confidence haircut.
 */
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
    if (!growth && !inflation && !unemployment) continue;

    // Cohesion blends three series; attribute it to the newest year among the
    // ones that were actually present, and treat it as an estimate if any input is.
    const present = [growth, inflation, unemployment].filter(
      (entry): entry is WeoObservation => entry != null,
    );
    const vintage = present.map((entry) => entry.year).sort().at(-1);
    const projection = present.some((entry) => entry.projection);

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
      ...(projection ? { projection: true } : {}),
    });
  }

  return observations;
};

export const buildIngestedObservations = (
  profiles: CountryProfile[],
  snapshot: IngestedSnapshot,
  rawAudit?: RawWorldBankAuditPayload,
): IndicatorObservation[] => {
  const observations: IndicatorObservation[] = [];
  const fallbackObservedAt = snapshot.timestamp.slice(0, 10);
  const observedAtByIndicator = buildObservedAtIndex(rawAudit);
  const seriesUpdatedAt = snapshot.timestamp.slice(0, 10);
  /** WDI observations are annual, so the vintage is the reference year. */
  const vintageOf = (observedAt: string) => observedAt.slice(0, 4);

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
          sourceId: 'world-bank-wdi',
          countryId: profile.id,
          indicator: 'militaryTreatyLevel', // Fallback proxy for treaty level for now
          value: military,
          observedAt,
          method: 'snapshot',
          confidence: 0.90, // High confidence for official data
          vintage: vintageOf(observedAt),
          seriesUpdatedAt,
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
          sourceId: 'world-bank-wdi',
          countryId: profile.id,
          indicator: 'tradeExposure',
          value: trade,
          observedAt,
          method: 'snapshot',
          confidence: 0.88,
          vintage: vintageOf(observedAt),
          seriesUpdatedAt,
        });
      }
    }

    const politicalStability = snapshot.world_bank_political_stability?.[geo];
    const stability = toStabilityTier(politicalStability);
    const stabilityObservedAt = observationDateFor('world_bank_political_stability');
    if (stability !== null && !isObservationTooOld(stabilityObservedAt)) {
      observations.push({
        providerId: 'wb-governance-ingest',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'regimeStability',
        value: stability,
        observedAt: stabilityObservedAt,
        method: 'snapshot',
        confidence: 0.8,
        vintage: vintageOf(stabilityObservedAt),
        seriesUpdatedAt,
      });
    }

    const ruleOfLaw = snapshot.world_bank_rule_of_law?.[geo];
    const ruleOfLawTier = toRuleOfLawTier(ruleOfLaw);
    const ruleObservedAt = observationDateFor('world_bank_rule_of_law');
    if (ruleOfLawTier !== null && !isObservationTooOld(ruleObservedAt)) {
      observations.push({
        providerId: 'wb-governance-ingest',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'regimeStability',
        value: ruleOfLawTier,
        observedAt: ruleObservedAt,
        method: 'snapshot',
        confidence: 0.84,
        vintage: vintageOf(ruleObservedAt),
        seriesUpdatedAt,
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
          sourceId: 'world-bank-wdi',
          countryId: profile.id,
          indicator: 'cohesion',
          value: toCohesionValue(profile.indicators.cohesion, gdpGrowth, inflation, unemployment),
          observedAt,
          method: 'snapshot',
          confidence: 0.74,
          vintage: vintageOf(observedAt),
          seriesUpdatedAt,
        });
      }
    }
  }

  return observations;
};
