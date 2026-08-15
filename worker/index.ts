/// <reference types="@cloudflare/workers-types" />

/**
 * Realpolitik backend runtime.
 *
 * - `GET /api/state` — current World Bank state payload (gzip, KV-backed).
 *   Returns a structurally valid but empty payload (`refreshedAt: null`) until
 *   the first cron refresh has written real data; the browser client falls
 *   back to a direct World Bank fetch in that case.
 * - `GET /api/health` — cheap diagnostics for the HUD.
 * - everything else — delegated to static assets (SPA).
 * - `scheduled` — refresh World Bank indicators into KV on a daily cron.
 *
 * The refresh path shares fetch/selection semantics with the browser client
 * and `scripts/ingest.ts` via `src/lib/worldBankFetch`.
 */

import {
  countryIso2,
  currentFloorYear,
  fetchWorldBankPoints,
  pickNewestValues,
  WB_INDICATORS,
  type IndicatorValues,
  type WbIndicatorCode,
} from '../src/lib/worldBankFetch';

const KV_STATE_KEY = 'live:state:v1';
const KV_TTL_SECONDS = 90 * 24 * 60 * 60;
const API_CACHE_CONTROL = 'public, max-age=300, must-revalidate, stale-while-revalidate=3600';
const API_SECURITY_HEADERS = {
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
} as const;

export interface StateIndicatorBucket {
  latestYear: string | null;
  observedYears: Record<string, string>;
  retrievedAt: string | null;
  values: IndicatorValues;
}

export interface LiveStatePayload {
  schema: 1;
  refreshedAt: string | null;
  source: 'world-bank-open-data';
  indicators: Partial<Record<WbIndicatorCode, StateIndicatorBucket>>;
  diagnostics: {
    totalIndicators: number;
    succeededIndicators: number;
    failedIndicators: number;
    failedCodes: string[];
  };
}

const emptyPayload = (): LiveStatePayload => ({
  schema: 1,
  refreshedAt: null,
  source: 'world-bank-open-data',
  indicators: {},
  diagnostics: {
    totalIndicators: WB_INDICATORS.length,
    succeededIndicators: 0,
    failedIndicators: WB_INDICATORS.length,
    failedCodes: [],
  },
});

const hasValues = (bucket: StateIndicatorBucket | undefined): bucket is StateIndicatorBucket =>
  Boolean(
    bucket &&
      bucket.values &&
      Object.values(bucket.values).some((value) => typeof value === 'number' && Number.isFinite(value)),
  );

export const buildLiveStatePayload = async (
  options: { signal?: AbortSignal } = {},
): Promise<LiveStatePayload> => {
  const payload = emptyPayload();
  const failedCodes: string[] = [];
  const retrievedAt = new Date().toISOString();

  // Indicators are independent requests. Fetching them concurrently keeps the
  // scheduled refresh close to one upstream round trip instead of ten.
  const outcomes = await Promise.all(WB_INDICATORS.map(async (def) => {
    try {
      const points = await fetchWorldBankPoints(def, { signal: options.signal });
      const { values, newestObservation, observedYears } = pickNewestValues(points, currentFloorYear());
      if (Object.keys(values).length === 0) {
        throw new Error('response contained no observations inside the recency window');
      }
      return {
        def,
        bucket: { latestYear: newestObservation, observedYears, retrievedAt, values },
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(JSON.stringify({
        event: 'indicator_refresh_failed',
        indicator: def.code,
        reason,
      }));
      return { def, bucket: null };
    }
  }));

  for (const outcome of outcomes) {
    if (outcome.bucket) {
      payload.indicators[outcome.def.code] = outcome.bucket;
      payload.diagnostics.succeededIndicators += 1;
    } else {
      failedCodes.push(outcome.def.code);
    }
  }

  payload.diagnostics.failedIndicators = failedCodes.length;
  payload.diagnostics.failedCodes = failedCodes;
  payload.refreshedAt = payload.diagnostics.succeededIndicators > 0 ? retrievedAt : null;
  return payload;
};

/**
 * Merge a refresh attempt into the last good state without letting one failed
 * World Bank indicator erase a previously healthy bucket. The diagnostics stay
 * tied to the current attempt so the UI can still surface a partial refresh;
 * per-indicator `retrievedAt` makes the retained bucket's age visible.
 */
export const mergeLiveStatePayload = (
  previous: LiveStatePayload | null | undefined,
  next: LiveStatePayload,
): LiveStatePayload => {
  const indicators: LiveStatePayload['indicators'] = {};
  for (const def of WB_INDICATORS) {
    const fresh = next.indicators[def.code];
    const retained = previous?.indicators?.[def.code];
    if (hasValues(fresh)) indicators[def.code] = fresh;
    else if (hasValues(retained)) indicators[def.code] = retained;
  }

  return {
    ...next,
    refreshedAt: next.refreshedAt ?? previous?.refreshedAt ?? null,
    indicators,
    diagnostics: {
      ...next.diagnostics,
      totalIndicators: WB_INDICATORS.length,
    },
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizePayload = (value: unknown): LiveStatePayload | null => {
  if (!isRecord(value) || value.schema !== 1) return null;
  const rawIndicators = isRecord(value.indicators) ? value.indicators : {};
  const indicators: LiveStatePayload['indicators'] = {};
  for (const def of WB_INDICATORS) {
    const rawBucket = rawIndicators[def.code];
    if (!isRecord(rawBucket) || !isRecord(rawBucket.values)) continue;
    const observedYears: Record<string, string> = {};
    for (const [iso, year] of Object.entries(rawBucket.observedYears ?? {})) {
      if (/^[A-Z]{2}$/.test(iso) && typeof year === 'string' && /^\d{4}$/.test(year)) {
        observedYears[iso] = year;
      }
    }
    const values: IndicatorValues = {};
    for (const [iso, value] of Object.entries(rawBucket.values)) {
      if (/^[A-Z]{2}$/.test(iso) && (value === null || (typeof value === 'number' && Number.isFinite(value)))) {
        values[iso] = value;
      }
    }
    indicators[def.code] = {
      latestYear: typeof rawBucket.latestYear === 'string' ? rawBucket.latestYear : null,
      observedYears,
      retrievedAt: typeof rawBucket.retrievedAt === 'string' ? rawBucket.retrievedAt : null,
      values,
    };
  }

  const rawDiagnostics = isRecord(value.diagnostics) ? value.diagnostics : {};
  const failedCodeSet = new Set(WB_INDICATORS.map((def) => def.code));
  const succeededIndicators =
    typeof rawDiagnostics.succeededIndicators === 'number' && Number.isFinite(rawDiagnostics.succeededIndicators)
      ? Math.max(0, Math.min(WB_INDICATORS.length, Math.trunc(rawDiagnostics.succeededIndicators)))
      : 0;
  const failedIndicators =
    typeof rawDiagnostics.failedIndicators === 'number' && Number.isFinite(rawDiagnostics.failedIndicators)
      ? Math.max(0, Math.min(WB_INDICATORS.length, Math.trunc(rawDiagnostics.failedIndicators)))
      : WB_INDICATORS.length;
  return {
    schema: 1,
    refreshedAt: typeof value.refreshedAt === 'string' ? value.refreshedAt : null,
    source: 'world-bank-open-data',
    indicators,
    diagnostics: {
      totalIndicators: WB_INDICATORS.length,
      succeededIndicators,
      failedIndicators,
      failedCodes: Array.isArray(rawDiagnostics.failedCodes)
        ? Array.from(new Set(rawDiagnostics.failedCodes.filter(
            (code): code is WbIndicatorCode => typeof code === 'string' && failedCodeSet.has(code as WbIndicatorCode),
          )))
        : [],
    },
  };
};

/**
 * How long the daily cron may go without a successful write before the state
 * is treated as stale. Two missed runs, not one: a single failed refresh is
 * routine (upstream rate limiting), two in a row means the schedule itself is
 * not firing.
 */
const STATE_STALE_AFTER_HOURS = 50;

export type BackendHealthStatus = 'healthy' | 'degraded' | 'stale' | 'empty' | 'unconfigured';

export interface BackendHealthReport {
  status: BackendHealthStatus;
  /** Kept for compatibility with the existing HUD check. */
  ok: boolean;
  refreshedAt: string | null;
  /** Hours since the last successful refresh, or null when never refreshed. */
  stateAgeHours: number | null;
  /** False when the KV namespace is not bound — the silent misconfiguration. */
  kvBound: boolean;
  /** One-line operator-facing explanation of the status. */
  reason: string;
  coverage: LiveStatePayload['diagnostics'];
}

/**
 * Assess backend health from the stored state.
 *
 * `ok: true` on its own could not distinguish a healthy backend from one whose
 * cron stopped firing three weeks ago — the state keeps being served, so
 * nothing looks wrong until someone notices the numbers never move. The
 * statuses below separate the failure modes an operator would act on
 * differently:
 *
 *   - `unconfigured` — the KV binding is missing. Deployment problem.
 *   - `empty`        — bound, but no refresh has ever succeeded. Cron never ran.
 *   - `stale`        — refreshes stopped. Schedule or upstream is broken.
 *   - `degraded`     — refreshing, but some indicators are failing.
 *   - `healthy`      — refreshing, all indicators present.
 *
 * `now` is injectable so the assessment is not clock-bound in tests.
 */
export const assessBackendHealth = (
  payload: LiveStatePayload,
  options: { now?: number; kvBound?: boolean } = {},
): BackendHealthReport => {
  const now = options.now ?? Date.now();
  const kvBound = options.kvBound ?? true;
  const coverage = payload.diagnostics;

  const refreshedMs = payload.refreshedAt ? Date.parse(payload.refreshedAt) : Number.NaN;
  const stateAgeHours = Number.isFinite(refreshedMs)
    ? Math.max(0, Math.round(((now - refreshedMs) / 3_600_000) * 10) / 10)
    : null;

  const report = (status: BackendHealthStatus, reason: string): BackendHealthReport => ({
    status,
    ok: status === 'healthy' || status === 'degraded',
    refreshedAt: payload.refreshedAt,
    stateAgeHours,
    kvBound,
    reason,
    coverage,
  });

  if (!kvBound) {
    return report('unconfigured', 'LIVE_STATE KV namespace is not bound — check the Worker configuration.');
  }
  if (payload.refreshedAt === null || coverage.succeededIndicators === 0) {
    return report('empty', 'No successful refresh recorded yet — the client falls back to a direct API fetch.');
  }
  if (stateAgeHours !== null && stateAgeHours > STATE_STALE_AFTER_HOURS) {
    return report(
      'stale',
      `Last refresh was ${stateAgeHours}h ago, past the ${STATE_STALE_AFTER_HOURS}h budget — the daily cron may not be firing.`,
    );
  }
  if (coverage.failedIndicators > 0) {
    return report(
      'degraded',
      `Serving last-good state with ${coverage.failedIndicators} of ${coverage.totalIndicators} indicators failing` +
        `${coverage.failedCodes.length > 0 ? ` (${coverage.failedCodes.join(', ')})` : ''}.`,
    );
  }
  return report('healthy', `All ${coverage.totalIndicators} indicators refreshed ${stateAgeHours ?? 0}h ago.`);
};

const readState = async (env: Pick<Env, 'LIVE_STATE'>): Promise<LiveStatePayload> => {
  const raw = await env.LIVE_STATE.get(KV_STATE_KEY);
  if (!raw) return emptyPayload();
  try {
    return normalizePayload(JSON.parse(raw)) ?? emptyPayload();
  } catch {
    return emptyPayload();
  }
};

const stateEtag = (payload: LiveStatePayload): string =>
  `W/\"state-${payload.refreshedAt ?? 'empty'}-${payload.diagnostics.succeededIndicators}\"`;

const apiHeaders = (payload: LiveStatePayload): Headers => {
  const headers = new Headers(API_SECURITY_HEADERS);
  headers.set('cache-control', API_CACHE_CONTROL);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('etag', stateEtag(payload));
  headers.set('vary', 'Accept-Encoding');
  return headers;
};

const jsonResponse = async (payload: LiveStatePayload, request: Request): Promise<Response> => {
  const headers = apiHeaders(payload);
  if (request.headers.get('if-none-match') === headers.get('etag')) {
    return new Response(null, { status: 304, headers });
  }
  if (request.method === 'HEAD') {
    return new Response(null, { headers });
  }

  const body = JSON.stringify(payload);
  if (!request.headers.get('accept-encoding')?.includes('gzip')) {
    return new Response(body, { headers });
  }
  const compressed = new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'));
  headers.set('content-encoding', 'gzip');
  return new Response(compressed, { headers });
};

const methodNotAllowed = (): Response => new Response(
  JSON.stringify({ error: 'Method not allowed' }),
  {
    status: 405,
    headers: {
      ...API_SECURITY_HEADERS,
      allow: 'GET, HEAD',
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  },
);

export const handleApiRequest = async (
  request: Request,
  env: Pick<Env, 'LIVE_STATE'>,
): Promise<Response | null> => {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed();

  if (url.pathname === '/api/state') {
    const payload = await readState(env);
    return jsonResponse(payload, request);
  }

  if (url.pathname === '/api/health') {
    // An unbound namespace throws on read rather than returning empty, so the
    // binding is probed here and reported as `unconfigured` — the failure an
    // operator most needs named, and the one an empty payload would disguise
    // as "no refresh yet".
    const kvBound = typeof env.LIVE_STATE?.get === 'function';
    const payload = kvBound ? await readState(env) : emptyPayload();
    const headers = apiHeaders(payload);
    if (request.headers.get('if-none-match') === headers.get('etag')) {
      return new Response(null, { status: 304, headers });
    }
    if (request.method === 'HEAD') return new Response(null, { headers });
    return new Response(JSON.stringify(assessBackendHealth(payload, { kvBound })), { headers });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: {
      ...API_SECURITY_HEADERS,
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const apiResponse = await handleApiRequest(request, env);
    if (apiResponse) return apiResponse;

    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    console.log(JSON.stringify({ event: 'scheduled_refresh_started' }));
    const payload = await buildLiveStatePayload();
    const previous = await readState(env);

    if (payload.refreshedAt === null) {
      if (previous.refreshedAt !== null) {
        console.error(JSON.stringify({
          event: 'scheduled_refresh_failed',
          action: 'retained_previous_state',
          previousRefreshedAt: previous.refreshedAt,
        }));
        return;
      }
      console.error(JSON.stringify({
        event: 'scheduled_refresh_failed',
        action: 'no_previous_state',
      }));
      return;
    }

    const merged = mergeLiveStatePayload(previous, payload);
    await env.LIVE_STATE.put(KV_STATE_KEY, JSON.stringify(merged), {
      expirationTtl: KV_TTL_SECONDS,
    });
    console.log(JSON.stringify({
      event: 'scheduled_refresh_completed',
      refreshedAt: merged.refreshedAt,
      succeededIndicators: merged.diagnostics.succeededIndicators,
      totalIndicators: merged.diagnostics.totalIndicators,
      failedCodes: merged.diagnostics.failedCodes,
    }));
  },
} satisfies ExportedHandler<Env>;
