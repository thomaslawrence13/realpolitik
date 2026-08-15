import assert from 'node:assert/strict';
import test from 'node:test';
import { WB_INDICATORS, type WbIndicatorCode } from '../src/lib/worldBankFetch';
import { assessBackendHealth, handleApiRequest, mergeLiveStatePayload, type LiveStatePayload } from './index';

const bucket = (value: number, retrievedAt: string) => ({
  latestYear: '2025',
  observedYears: { US: '2025' },
  retrievedAt,
  values: { US: value },
});

const payload = (indicators: Partial<LiveStatePayload['indicators']>): LiveStatePayload => ({
  schema: 1,
  refreshedAt: '2026-08-08T00:00:00.000Z',
  source: 'world-bank-open-data',
  indicators,
  diagnostics: {
    totalIndicators: WB_INDICATORS.length,
    succeededIndicators: Object.keys(indicators).length,
    failedIndicators: WB_INDICATORS.length - Object.keys(indicators).length,
    failedCodes: WB_INDICATORS.map((def) => def.code).filter((code) => !(code in indicators)),
  },
});

test('partial refresh preserves the last good bucket for a failed indicator', () => {
  const previous = payload({
    'MS.MIL.XPND.GD.ZS': bucket(2.4, '2026-08-07T00:00:00.000Z'),
    'TG.VAL.TOTL.GD.ZS': bucket(68, '2026-08-07T00:00:00.000Z'),
  });
  const next = payload({
    'MS.MIL.XPND.GD.ZS': bucket(2.8, '2026-08-08T00:00:00.000Z'),
  });

  const merged = mergeLiveStatePayload(previous, next);

  assert.equal(merged.indicators['MS.MIL.XPND.GD.ZS']?.values.US, 2.8);
  assert.equal(merged.indicators['TG.VAL.TOTL.GD.ZS']?.values.US, 68);
  assert.equal(merged.indicators['TG.VAL.TOTL.GD.ZS']?.retrievedAt, '2026-08-07T00:00:00.000Z');
  assert.deepEqual(merged.diagnostics.failedCodes, next.diagnostics.failedCodes);
});

test('a refresh with no prior state keeps only the buckets that succeeded', () => {
  const code = 'NY.GDP.MKTP.KD.ZG' as WbIndicatorCode;
  const next = payload({ [code]: bucket(3.1, '2026-08-08T00:00:00.000Z') });
  const merged = mergeLiveStatePayload(null, next);

  assert.deepEqual(Object.keys(merged.indicators), [code]);
  assert.equal(merged.refreshedAt, next.refreshedAt);
});

const apiEnv = (stored: LiveStatePayload | null = null): Pick<Env, 'LIVE_STATE'> => ({
  LIVE_STATE: {
    get: async () => stored ? JSON.stringify(stored) : null,
  } as KVNamespace,
});

test('API rejects unsupported methods and unknown routes without falling through to SPA assets', async () => {
  const methodResponse = await handleApiRequest(
    new Request('https://example.com/api/state', { method: 'POST' }),
    apiEnv(),
  );
  assert.equal(methodResponse?.status, 405);
  assert.equal(methodResponse?.headers.get('allow'), 'GET, HEAD');

  const missingResponse = await handleApiRequest(
    new Request('https://example.com/api/unknown'),
    apiEnv(),
  );
  assert.equal(missingResponse?.status, 404);
});

test('state API supports conditional requests and hardened response headers', async () => {
  const first = await handleApiRequest(
    new Request('https://example.com/api/state'),
    apiEnv(payload({ 'NY.GDP.MKTP.KD.ZG': bucket(3.1, '2026-08-08T00:00:00.000Z') })),
  );
  assert.equal(first?.status, 200);
  assert.equal(first?.headers.get('x-content-type-options'), 'nosniff');
  assert.match(first?.headers.get('cache-control') ?? '', /max-age=300/);
  const etag = first?.headers.get('etag');
  assert.ok(etag);

  const conditional = await handleApiRequest(
    new Request('https://example.com/api/state', { headers: { 'if-none-match': etag } }),
    apiEnv(payload({ 'NY.GDP.MKTP.KD.ZG': bucket(3.1, '2026-08-08T00:00:00.000Z') })),
  );
  assert.equal(conditional?.status, 304);
});

/**
 * Health assessment. The failure this exists to catch is a backend that keeps
 * answering `ok: true` while its cron has not fired in weeks — the state is
 * still served, so nothing looks wrong until someone notices the numbers never
 * move.
 */
const allIndicators = (): Partial<LiveStatePayload['indicators']> =>
  Object.fromEntries(
    WB_INDICATORS.map((def) => [def.code, bucket(1, '2026-08-08T00:00:00.000Z')]),
  ) as Partial<LiveStatePayload['indicators']>;

const AT = Date.parse('2026-08-08T00:00:00.000Z');
const hoursAfter = (hours: number) => AT + hours * 3_600_000;

test('a fully refreshed recent state is healthy', () => {
  const report = assessBackendHealth(payload(allIndicators()), { now: hoursAfter(3) });

  assert.equal(report.status, 'healthy');
  assert.equal(report.ok, true);
  assert.equal(report.stateAgeHours, 3);
  assert.equal(report.kvBound, true);
});

test('a partially failing refresh is degraded but still serving', () => {
  const report = assessBackendHealth(
    payload({ 'NY.GDP.MKTP.KD.ZG': bucket(3.1, '2026-08-08T00:00:00.000Z') }),
    { now: hoursAfter(2) },
  );

  assert.equal(report.status, 'degraded');
  // Degraded still counts as ok: last-good data is being served.
  assert.equal(report.ok, true);
  assert.match(report.reason, /indicators failing/);
});

test('a state older than two missed cron runs is stale, not merely old', () => {
  // One missed daily run is routine; this is past two.
  const report = assessBackendHealth(payload(allIndicators()), { now: hoursAfter(60) });

  assert.equal(report.status, 'stale');
  assert.equal(report.ok, false);
  assert.equal(report.stateAgeHours, 60);
  assert.match(report.reason, /cron may not be firing/);
});

test('one missed refresh does not trip the stale threshold', () => {
  const report = assessBackendHealth(payload(allIndicators()), { now: hoursAfter(30) });
  assert.equal(report.status, 'healthy');
});

test('an unbound KV namespace reports unconfigured, not empty', () => {
  const report = assessBackendHealth(payload(allIndicators()), { now: hoursAfter(1), kvBound: false });

  // A deployment problem must not be disguised as "no refresh yet".
  assert.equal(report.status, 'unconfigured');
  assert.equal(report.ok, false);
  assert.match(report.reason, /not bound/);
});

test('a never-refreshed state reports empty with a null age', () => {
  const never: LiveStatePayload = {
    ...payload({}),
    refreshedAt: null,
    diagnostics: {
      totalIndicators: WB_INDICATORS.length,
      succeededIndicators: 0,
      failedIndicators: WB_INDICATORS.length,
      failedCodes: [],
    },
  };
  const report = assessBackendHealth(never, { now: hoursAfter(5) });

  assert.equal(report.status, 'empty');
  assert.equal(report.stateAgeHours, null);
  assert.match(report.reason, /falls back to a direct API fetch/);
});

test('the health endpoint serves the assessment and flags a missing binding', async () => {
  const healthy = await handleApiRequest(
    new Request('https://example.com/api/health'),
    apiEnv(payload(allIndicators())),
  );
  assert.equal(healthy?.status, 200);
  const body = (await healthy?.json()) as { status: string; kvBound: boolean; reason: string };
  assert.equal(body.kvBound, true);
  assert.ok(['healthy', 'stale'].includes(body.status));

  const unbound = await handleApiRequest(
    new Request('https://example.com/api/health'),
    { LIVE_STATE: undefined } as unknown as Pick<Env, 'LIVE_STATE'>,
  );
  const unboundBody = (await unbound?.json()) as { status: string; kvBound: boolean };
  assert.equal(unboundBody.status, 'unconfigured');
  assert.equal(unboundBody.kvBound, false);
});
