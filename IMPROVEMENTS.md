# Code Quality Improvements

Log of improvements made to the realpolitik codebase.

## 2026-08 session: tracker hardening and product delivery

- Worker refreshes merge successful indicator buckets with the prior KV state, so a partial World Bank outage cannot erase healthy data; malformed KV payloads are normalized safely.
- World Bank live/ingest coverage expanded from 7 to 10 indicators: current-US-dollar GDP, GDP per capita, and SIPRI-backed current-USD military expenditure now update profile stats, map GDP-per-capita fills, historical series, and defence-spend derivations. Published observation year and retrieval time remain separate.
- Map fill/overlay state is owned by `useMapStore`, persisted with the shell snapshot, and pan/zoom/hover interaction is extracted to `useMapInteraction`.
- Historical series and political registry artifacts are visible in the inspector with source timing and field-level provenance.
- Factual index exports now support formula-safe CSV and Markdown; share links carry the selected country and map reading modes.
- Mobile resize/toggle behavior prevents side panels and the drawer from competing for the same viewport; relationship evidence exposes per-dimension observed timestamps.
- Regression coverage now includes worker merge behavior, export formatting, relationship evidence ordering, API catalog compatibility, and the full 91-test unit suite.

## 2026-08 session: backend runtime (Phase 3)

### Cloudflare Worker runtime
- `worker/index.ts`: `GET /api/state` (gzip, KV-backed), `GET /api/health`, `scheduled` cron refresh
  of all 10 World Bank indicators; a totally-failed refresh keeps the previous KV state untouched.
- `wrangler.jsonc`: `main` worker entry, `LIVE_STATE` KV namespace, cron trigger, `run_worker_first:
  ["/api/*"]`; security headers moved to `public/_headers` (Workers static assets convention).
- Security headers moved from the old Pages-style `headers` block to the `_headers` file in the
  asset directory — verified via wrangler's current schema.

### Shared fetch semantics
- New `src/lib/worldBankFetch.ts`: runtime-agnostic indicator catalog, ISO tables, "newest non-null
  year per country" selection, and 6-year recency floor — used identically by the browser client,
  `scripts/ingest.ts`, and the worker cron. No DOM/logger imports (typechecks under both libs).
- `src/lib/backendClient.ts`: `/api/state` poller with 8s timeout; `backendPayloadToLiveData`
  conversion — pure and unit-tested (cold-start null triggers fallback).

### Live session
- `useLiveSession` prefers the backend, falls back to direct World Bank fetch, polls every 30 min;
  diagnostics now include the active `source` (`backend`/`direct`) and server `refreshedAt`,
  surfaced in the methodology drawer.

### Config / tooling
- devDeps: `wrangler`, `@cloudflare/workers-types`; scripts `worker:check`, `worker:dev`, `deploy`;
  `ci.yml` gained the worker typecheck step.

## 2026-08 earlier session: scenario-subsystem removal + honest data layer

### Prediction subsystem removed (product pivot to live stats)
- `src/simulation.ts` replaced by `src/assessment.ts` — risk stress index, deterministic alignment
  (pacts + UN vote delta), data-quality confidence; no year offsets, momentum, or probability arrays.
- Deleted: `eventLibrary.ts`, `EventsPanel`, `ScenarioPanel`, `HistoryPanel`, `AnalysisPanel`,
  `ComparisonSection`, `UndoToast`, `MapLegend`, simulation worker, `useTimeline`/`useLiveData`/
  `usePersistedState`/`useSimulation`/`useScenarios`, backtest scripts and fixture generators.
- Type surface reduced: `ProbabilitySet`, `ScenarioInputs`, `SimulationWeightSet`, `WeightSetKey`,
  `SavedScenario`, `EventTemplate`, scenario timeline and probability fields removed from `types.ts`.
- Storage version bumped to 2 (v1 scenario payloads discarded cleanly); share links now carry only
  selected-country state.

### Honest staleness
- `src/data/pipeline/providers.ts` + `relationshipProviders.ts` no longer re-stamp `observedAt = today`;
  curated observations carry the record's real `lastUpdated` (derived edges: max of both sides).
- Staleness telemetry now ages countries out of their SLA instead of reaffirming them on every load.
- `scripts/checkFreshness.ts` gate with three budgets (curated 90d, ingest 90d/30d warn, records 365d).

### CI
- Added `.github/workflows/ci.yml` and `.github/workflows/data-refresh.yml` (nightly ingest + PR).
- Fixed stale hardcoded release version in `scripts/validateDataset.ts` (0.14.0 → 0.15.0).

## Earlier sessions

### Repository hygiene
- Removed committed build artifacts: 809 tracked files (`node_modules/` and `dist/`, ~818k lines)
  were untracked via `git rm --cached` — the repository now contains only source.
- Fixed `.gitignore` (stray code fence removed; now ignores `node_modules/`, `dist/`, logs, editor dirs, env).
- Dependency security: `npm audit fix` cleared 3 vulnerabilities; `npm audit` reports 0.

### Component splitting
- Split oversized components: `MapCanvas` → `CountryLayers`/`MapLegendControls`; inspector sections;
  drawer panels; shared `ui.tsx` primitives. TypeScript strict-mode compile clean, no `any` leaks.
- `useMapStore` refactored away from store-wire coupling: worker communication removed, selectors and
  `useFilteredCountries` thin, `useAppChrome` owns shell state; persistence via `lib/persistence.ts`.

### Testing
- Node `tsx --test` suite (48 tests) covering: assessment bounds/classification, URL state round-trip,
  persistence versioning, global stats summary, reconciliation provider stamps, information-quality
  telemetry, dataset validation scripts.
