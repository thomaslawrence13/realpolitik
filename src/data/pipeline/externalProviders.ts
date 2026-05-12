import type { CountryProfile } from '../../types';
import { iso2ToCountryId } from '../worldBankClient';
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
} as const satisfies Record<string, keyof IngestedSnapshot>;

type SnapshotIndicatorKey = (typeof mapIndicatorCodeToSnapshotKey)[keyof typeof mapIndicatorCodeToSnapshotKey];

const normalizeObservedAt = (date: string): string => {
  if (/^\d{4}$/.test(date)) return `${date}-12-31`;
  return date.slice(0, 10);
};

const buildObservedAtIndex = (rawAudit?: RawWorldBankAuditPayload): Record<SnapshotIndicatorKey, Record<string, string>> => {
  const empty = {
    world_bank_military_expenditure_pct: {},
    world_bank_trade_pct: {},
    world_bank_gdp_growth: {},
    world_bank_inflation: {},
    world_bank_political_stability: {},
    world_bank_rule_of_law: {},
    world_bank_unemployment: {},
  } satisfies Record<SnapshotIndicatorKey, Record<string, string>>;
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

export const buildIngestedObservations = (
  profiles: CountryProfile[],
  snapshot: IngestedSnapshot,
  rawAudit?: RawWorldBankAuditPayload,
): IndicatorObservation[] => {
  const observations: IndicatorObservation[] = [];
  const fallbackObservedAt = snapshot.timestamp.slice(0, 10);
  const observedAtByIndicator = buildObservedAtIndex(rawAudit);

  for (const profile of profiles) {
    const geo = profile.id;
    const observationDateFor = (indicator: SnapshotIndicatorKey) =>
      observedAtByIndicator[indicator][geo] ?? fallbackObservedAt;

    const militaryExpPct = snapshot.world_bank_military_expenditure_pct?.[geo];
    if (militaryExpPct !== undefined) {
      const military = toMilitaryTier(militaryExpPct);
      if (military !== null) {
        observations.push({
          providerId: 'wb-military-ingest',
          sourceId: 'world-bank-wdi',
          countryId: profile.id,
          indicator: 'militaryTreatyLevel', // Fallback proxy for treaty level for now
          value: military,
          observedAt: observationDateFor('world_bank_military_expenditure_pct'),
          method: 'snapshot',
          confidence: 0.90, // High confidence for official data
        });
      }
    }

    const tradePct = snapshot.world_bank_trade_pct?.[geo];
    if (tradePct !== undefined) {
      const trade = toTradeTier(tradePct);
      if (trade !== null) {
        observations.push({
          providerId: 'wb-trade-ingest',
          sourceId: 'world-bank-wdi',
          countryId: profile.id,
          indicator: 'tradeExposure',
          value: trade,
          observedAt: observationDateFor('world_bank_trade_pct'),
          method: 'snapshot',
          confidence: 0.88,
        });
      }
    }

    const politicalStability = snapshot.world_bank_political_stability?.[geo];
    const stability = toStabilityTier(politicalStability);
    if (stability !== null) {
      observations.push({
        providerId: 'wb-governance-ingest',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'regimeStability',
        value: stability,
        observedAt: observationDateFor('world_bank_political_stability'),
        method: 'snapshot',
        confidence: 0.8,
      });
    }

    const ruleOfLaw = snapshot.world_bank_rule_of_law?.[geo];
    const ruleOfLawTier = toRuleOfLawTier(ruleOfLaw);
    if (ruleOfLawTier !== null) {
      observations.push({
        providerId: 'wb-governance-ingest',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'regimeStability',
        value: ruleOfLawTier,
        observedAt: observationDateFor('world_bank_rule_of_law'),
        method: 'snapshot',
        confidence: 0.84,
      });
    }

    const gdpGrowth = snapshot.world_bank_gdp_growth?.[geo];
    const inflation = snapshot.world_bank_inflation?.[geo];
    const unemployment = snapshot.world_bank_unemployment?.[geo];
    if (gdpGrowth != null || inflation != null || unemployment != null) {
      observations.push({
        providerId: 'wb-cohesion-ingest',
        sourceId: 'world-bank-wdi',
        countryId: profile.id,
        indicator: 'cohesion',
        value: toCohesionValue(profile.indicators.cohesion, gdpGrowth, inflation, unemployment),
        observedAt: [observationDateFor('world_bank_gdp_growth'), observationDateFor('world_bank_inflation'), observationDateFor('world_bank_unemployment')]
          .sort()
          .at(-1) ?? fallbackObservedAt,
        method: 'snapshot',
        confidence: 0.74,
      });
    }
  }

  return observations;
};
