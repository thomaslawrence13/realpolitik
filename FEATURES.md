# Feature Roadmap

## Current Status

Live-stats product (post scenario-subsystem removal). Shipped in recent sessions:

## Shipped

### Scenario-prediction subsystem removal (2026-08)
- `simulation.ts` → `assessment.ts` (observed-state scoring only)
- Removed: event library, shocks/weight-set editors, scenario timeline, saved scenarios, backtests, and the obsolete simulation worker
- Confidence redefined as information quality; alignment redefined as deterministic current posture
- Risk: observed indicators + relationships + structural vulnerabilities, no year offsets

### Honest staleness (2026-08)
- Curated providers carry real `lastUpdated`/`accessedOn` stamps; reconcile ages out per SLA
- `npm run freshness:check` gate: curated layer ≤ 90d, ingest manifest ≤ 90d (warn 30d), country records ≤ 365d
- Operational artifact register (`src/data/artifactRegistry.ts`): UNGA ≤ 420d, OFAC ≤ 120d, UCDP ≤ 440d, WB history ≤ 120d — one set of budgets shared by the runtime overlay gate, CI and the release view
- `npm run artifacts:status` prints what was retrieved, when, against which budget, and what each artifact does not evidence

### Automated refresh
- `.github/workflows/ci.yml` — unit, build, validate, freshness on every push/PR
- `.github/workflows/data-refresh.yml` — nightly World Bank re-fetch; opens a PR when artifacts change

### Live data layer
- World Bank enrichment in-browser (10 indicators, 4h cache) with diagnostics and staleness surfacing
- Movers panel (static → enriched deltas), coverage/recency telemetry, methodology panel
- Cloudflare Worker runtime with daily KV refresh, gzip state delivery, health diagnostics, and partial-refresh retention
- One map-state owner for selected filters, fill mode, relationship overlay, and persistence; pan/zoom input lives in `useMapInteraction`

## Roadmap

### Phase 3 — backend runtime (shipped)
- Cloudflare Worker: daily cron refresh of all 10 World Bank indicators into KV
- `GET /api/state` (gzip JSON) + `GET /api/health`; browser prefers the backend and polls every 30m,
  falling back to a direct World Bank fetch only when the backend is unreachable
- Honest failure handling: a totally-failed refresh keeps the previous KV state untouched, while a partial refresh retains healthy indicator buckets

### Data depth (shipped)
- Political registry artifacts are refreshed through UCDP conflict, OFAC sanctions, and official UN GA vote pipelines and attached at runtime
- Historical series are rendered in the inspector with per-series source, frequency, retrieval, and quality metadata
- Economic and military fields expose metric-level provenance and country-level observation dates;
  nominal GDP, GDP per capita, and direct/derived nominal defence spend now use the live WDI series when available

### UX / product (shipped)
- Mobile drawer/rail transitions prevent overlapping full-screen panels
- Factual index exports the visible cohort as CSV or Markdown
- Share links preserve the selected country and map reading modes
- Relationship evidence lens shows the latest observed source timing for each edge dimension

### Deferred intentionally
- Multi-country map hover lasso requires a district/region ontology that is not present in the tracked-country dataset
- A true historical relationship-change player requires an upstream edge time-series artifact; the current lens does not invent one
