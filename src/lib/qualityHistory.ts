/**
 * Quality history — the time dimension the quality report never had.
 *
 * `quality_report.json` has always carried a block named `trendableAggregates`,
 * but nothing retained yesterday's values, so the name described an intention
 * rather than a capability: every run overwrote the only copy and the question
 * "is coverage improving?" had no answer in the repository.
 *
 * This module keeps a small, append-only series beside the report. It is
 * deliberately narrow — a handful of aggregates per run, not a snapshot of the
 * whole dataset — because a history file that grows with the dataset would be
 * abandoned within a month.
 *
 * One entry per calendar day: a same-day rerun replaces that day's entry rather
 * than appending, so a CI day with six refresh runs does not read as six days
 * of progress.
 */

/** The aggregates worth watching over time. */
export interface QualitySnapshot {
  /** ISO timestamp of the run that produced the entry. */
  generatedAt: string;
  /** `generatedAt` truncated to a day — the series key. */
  day: string;
  averageInformationScore: number;
  lowQualityCount: number;
  staleCountryCount: number;
  highQualityCount: number;
  ingestAverageCoveragePct: number;
  /** Artifacts inside their refresh budget when the entry was written. */
  artifactsWithinBudget: number;
  artifactCount: number;
  /** Release gate outcome at the time, so a trend line can be read against it. */
  releaseAccepted: boolean;
}

export interface QualityHistory {
  schema: 1;
  /** Oldest first. */
  entries: QualitySnapshot[];
}

/** Entries retained before the oldest are dropped (~6 months of daily runs). */
export const QUALITY_HISTORY_LIMIT = 180;

export const emptyQualityHistory = (): QualityHistory => ({ schema: 1, entries: [] });

/**
 * Accept an unknown JSON payload as history, or start fresh.
 *
 * A malformed or future-schema file is replaced rather than merged: a partial
 * merge would produce a trend line spliced from two different definitions,
 * which is worse than an honestly short one.
 */
export const readQualityHistory = (payload: unknown): QualityHistory => {
  if (!payload || typeof payload !== 'object') return emptyQualityHistory();
  const candidate = payload as Partial<QualityHistory>;
  if (candidate.schema !== 1 || !Array.isArray(candidate.entries)) return emptyQualityHistory();
  return { schema: 1, entries: candidate.entries.filter((entry) => typeof entry?.day === 'string') };
};

/**
 * Append (or replace same-day) and trim to the retention limit.
 *
 * Entries are re-sorted by day so an out-of-order run — a backfill, or a
 * machine with a skewed clock — cannot leave the series unsorted and make the
 * "previous" comparison meaningless.
 */
export const appendQualitySnapshot = (
  history: QualityHistory,
  snapshot: QualitySnapshot,
): QualityHistory => {
  const entries = history.entries.filter((entry) => entry.day !== snapshot.day);
  entries.push(snapshot);
  entries.sort((left, right) => left.day.localeCompare(right.day));
  return { schema: 1, entries: entries.slice(-QUALITY_HISTORY_LIMIT) };
};

export interface QualityTrend {
  /** The entry immediately before the current one, when the series has one. */
  previousDay: string | null;
  /** Oldest retained entry's day — the span the deltas below can cover. */
  firstDay: string | null;
  entryCount: number;
  /** Change since the previous entry. Positive means the metric rose. */
  sincePrevious: QualityDeltas | null;
  /** Change since the oldest retained entry. */
  sinceFirst: QualityDeltas | null;
}

export interface QualityDeltas {
  averageInformationScore: number;
  lowQualityCount: number;
  staleCountryCount: number;
  highQualityCount: number;
  ingestAverageCoveragePct: number;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

const deltas = (current: QualitySnapshot, earlier: QualitySnapshot): QualityDeltas => ({
  averageInformationScore: round(current.averageInformationScore - earlier.averageInformationScore),
  lowQualityCount: current.lowQualityCount - earlier.lowQualityCount,
  staleCountryCount: current.staleCountryCount - earlier.staleCountryCount,
  highQualityCount: current.highQualityCount - earlier.highQualityCount,
  ingestAverageCoveragePct: round(current.ingestAverageCoveragePct - earlier.ingestAverageCoveragePct),
});

/**
 * Compare the newest entry against its predecessor and against the oldest
 * retained entry. Both comparisons are null on a first run — an empty trend is
 * reported as empty rather than as a row of zeroes that would read as "no
 * change" when the truth is "no history yet".
 */
export const summarizeQualityTrend = (history: QualityHistory): QualityTrend => {
  const { entries } = history;
  const current = entries[entries.length - 1];
  const previous = entries[entries.length - 2];
  const first = entries[0];
  if (!current) {
    return { previousDay: null, firstDay: null, entryCount: 0, sincePrevious: null, sinceFirst: null };
  }
  return {
    previousDay: previous?.day ?? null,
    firstDay: first?.day ?? null,
    entryCount: entries.length,
    sincePrevious: previous ? deltas(current, previous) : null,
    sinceFirst: first && first !== current ? deltas(current, first) : null,
  };
};
