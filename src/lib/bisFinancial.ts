/**
 * BIS financial vulnerability indicators (SDMX).
 *
 * The dataset has macro levels — GDP, debt, inflation — but nothing about
 * *financial* stress: whether credit has run ahead of the economy, what share
 * of income is already committed to servicing debt, and how tight policy is.
 * The BIS publishes exactly these, and its credit-to-GDP gap is the reference
 * early-warning indicator behind the Basel III countercyclical capital buffer.
 *
 * Two boundaries shape how this is stored and shown:
 *
 *   - **Coverage is deliberately narrow.** BIS reports these for around 45
 *     mostly advanced and large emerging economies, not the whole tracked
 *     universe. A country absent here has *no BIS reporting*, which is not the
 *     same as having no financial vulnerability — so absent countries are
 *     omitted rather than written as zero or "low".
 *   - **The gap is a statistical construct, not a forecast.** It is the
 *     deviation of the credit-to-GDP ratio from a one-sided HP-filter trend.
 *     The trend is re-estimated as new data arrives, so historical gaps get
 *     revised, and a large negative gap after a deleveraging boom says as much
 *     about the filter as about current risk.
 */

/** The three BIS series surfaced by the app. */
export type BisSeriesKey = 'creditToGdpGap' | 'creditToGdpRatio' | 'debtServiceRatio' | 'policyRate';

export interface BisSeriesMeta {
  key: BisSeriesKey;
  label: string;
  unit: string;
  /** What a reader should not conclude from this number. */
  note: string;
}

export const BIS_SERIES: BisSeriesMeta[] = [
  {
    key: 'creditToGdpGap',
    label: 'Credit-to-GDP gap',
    unit: 'pp',
    note: 'Deviation from an HP-filter trend that is re-estimated each release; historical values revise.',
  },
  {
    key: 'creditToGdpRatio',
    label: 'Credit-to-GDP ratio',
    unit: '%',
    note: 'Private non-financial sector credit from all lenders, including cross-border.',
  },
  {
    key: 'debtServiceRatio',
    label: 'Debt service ratio',
    unit: '% of income',
    note: 'Interest plus amortisation as a share of income, private non-financial sector.',
  },
  {
    key: 'policyRate',
    label: 'Central bank policy rate',
    unit: '%',
    note: 'Headline policy rate; not a measure of overall financial conditions.',
  },
];

export interface BisObservation {
  value: number;
  /** BIS period label, e.g. `2025-Q4` or `2026-07`. */
  period: string;
}

export type BisCountrySummary = Partial<Record<BisSeriesKey, BisObservation>>;

export interface BisArtifact {
  fetchedAt: string;
  sourceTitle: string;
  sourceUrl: string;
  series: BisSeriesMeta[];
  countryCount: number;
  perCountry: Record<string, BisCountrySummary>;
}

/**
 * Minimal SDMX-JSON shape. BIS returns series keyed by colon-joined dimension
 * *indexes* into `structure.dimensions.series`, with observations keyed by an
 * index into `structure.dimensions.observation[0]`.
 */
export interface SdmxJson {
  data?: {
    structure?: {
      dimensions?: {
        series?: Array<{ id: string; values: Array<{ id: string }> }>;
        observation?: Array<{ id: string; values: Array<{ id: string }> }>;
      };
    };
    dataSets?: Array<{ series?: Record<string, { observations?: Record<string, unknown[]> }> }>;
  };
}

export interface SdmxPoint {
  /** Dimension id → code, e.g. `BORROWERS_CTY` → `KR`. */
  dimensions: Record<string, string>;
  value: number;
  period: string;
}

/**
 * Flatten an SDMX-JSON message into points.
 *
 * The index-based encoding is the part that silently produces wrong answers if
 * mishandled: a series key of `0:12:0:0:0` means nothing without the dimension
 * table, and reading the wrong position yields a real number attributed to the
 * wrong country. Dimensions are therefore resolved by *id*, never by position.
 */
export const parseSdmxSeries = (payload: SdmxJson): SdmxPoint[] => {
  const structure = payload.data?.structure;
  const seriesDims = structure?.dimensions?.series ?? [];
  const timeValues = structure?.dimensions?.observation?.[0]?.values ?? [];
  const seriesMap = payload.data?.dataSets?.[0]?.series ?? {};

  const points: SdmxPoint[] = [];
  for (const [key, entry] of Object.entries(seriesMap)) {
    const indexes = key.split(':').map((part) => Number.parseInt(part, 10));
    if (indexes.length !== seriesDims.length || indexes.some((index) => !Number.isFinite(index))) continue;

    const dimensions: Record<string, string> = {};
    let resolved = true;
    for (let position = 0; position < seriesDims.length; position++) {
      const dimension = seriesDims[position]!;
      const code = dimension.values[indexes[position]!]?.id;
      if (code === undefined) {
        resolved = false;
        break;
      }
      dimensions[dimension.id] = code;
    }
    if (!resolved) continue;

    for (const [observationIndex, observation] of Object.entries(entry.observations ?? {})) {
      const period = timeValues[Number.parseInt(observationIndex, 10)]?.id;
      const rawValue = Array.isArray(observation) ? observation[0] : undefined;
      const value = typeof rawValue === 'number' ? rawValue : Number.parseFloat(String(rawValue));
      if (!period || !Number.isFinite(value)) continue;
      points.push({ dimensions, value, period });
    }
  }
  return points;
};

/**
 * BIS reference-area codes that are not ISO-3166 alpha-2 countries, or that the
 * app tracks under a different code. `XM` is the euro area — an aggregate, not
 * a country, so it is dropped rather than attributed to any member state.
 */
const NON_COUNTRY_AREAS = new Set(['XM', 'EA', 'EU', '5A', '4T', '1C']);

/**
 * Fold points into per-country summaries, keeping the newest period per series.
 *
 * BIS mixes quarterly and monthly frequencies, so periods are compared as
 * strings only within a series — `2025-Q4` and `2026-07` are never ranked
 * against each other because they never share a series key.
 */
export const aggregateBisSeries = (
  entries: Array<{ key: BisSeriesKey; countryDimension: string; points: SdmxPoint[] }>,
  trackedIso2: ReadonlySet<string>,
): Record<string, BisCountrySummary> => {
  const perCountry: Record<string, BisCountrySummary> = {};

  for (const entry of entries) {
    for (const point of entry.points) {
      const iso = point.dimensions[entry.countryDimension];
      if (!iso || NON_COUNTRY_AREAS.has(iso) || !trackedIso2.has(iso)) continue;
      const summary = perCountry[iso] ?? {};
      const existing = summary[entry.key];
      if (!existing || point.period > existing.period) {
        summary[entry.key] = { value: point.value, period: point.period };
        perCountry[iso] = summary;
      }
    }
  }

  return perCountry;
};

/**
 * Reader-facing reading of a credit-to-GDP gap.
 *
 * The BIS/Basel III buffer guide treats a gap above 2 percentage points as the
 * point where the countercyclical capital buffer starts to build, and 10 as
 * where it maxes out. Those thresholds are used verbatim rather than invented,
 * and the labels describe credit conditions — not a probability of crisis.
 */
export const creditGapBand = (gap: number): 'elevated' | 'building' | 'neutral' | 'below-trend' => {
  if (gap >= 10) return 'elevated';
  if (gap >= 2) return 'building';
  if (gap > -2) return 'neutral';
  return 'below-trend';
};

export const CREDIT_GAP_BAND_LABEL: Record<ReturnType<typeof creditGapBand>, string> = {
  elevated: 'Credit well above trend (Basel buffer guide maxed)',
  building: 'Credit above trend (Basel buffer guide building)',
  neutral: 'Credit close to trend',
  'below-trend': 'Credit below trend',
};
