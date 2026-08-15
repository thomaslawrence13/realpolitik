# realpolitik

Realpolitik is a browser-based geopolitical statistics dashboard. It tracks 134 states using a versioned, source-attributed dataset of economic, military, diplomatic, and demographic indicators — enriched at runtime with live World Bank series. The UI surfaces observed state (risk stress index, current diplomatic alignment, economic and military snapshots) with **data confidence** (source coverage, recency, evidence class) rather than probabilistic forecasts.

## What it is

- Interactive 2D world map rendered in the browser
- Clickable parameterized countries with a detail panel (economy, military, relationships, indicator telemetry)
- Versioned country dataset with source attribution, coverage, and last-updated metadata
- Relationship graph edges for cooperation, hostility, dependency, and deterrence
- Filters for alliance network, trade exposure, military treaties, conflict pressure, sanctions, regime type, and risk level
- Risk choropleth built from observed indicators, relationships, and structural vulnerabilities — no model layer
- Alignment classification read deterministically from current defense pacts, alliance networks, and UN voting records
- Confidence is the information-quality score (source coverage, completeness, recency, evidence class)
- Live World Bank enrichment (nominal GDP, GDP per capita, GDP growth, inflation, trade openness, military burden/spend, governance, and unemployment) with diagnostics and staleness surfacing
- Methodology panel: provenance, ingest telemetry, information-quality scoring, runtime diagnostics
- Movers panel: observed series deltas when live enrichment updates the static snapshot

## What it intentionally is not

- No probability forecasts, no prediction of future alignment or war, no timeline scrubbing
- No scenario/shock editors or "what-if" hypotheticals
- Alignment = observed current posture; confidence = evidence behind the numbers

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build   # tsc typecheck + vite build
```

## Data pipeline

- `src/data/datasets/v1.ts` (plus v10/v11 enhancements): versioned curated dataset
- `src/data/pipeline/*` — ingest reconciliation + runtime enrichment adapters
- `src/data/worldBankClient.ts` — browser-side World Bank client (used only as fallback)
- `src/lib/worldBankFetch.ts` — runtime-agnostic fetch/selection shared by browser, ingest, and worker
- `npm run ingest` — re-fetch World Bank artifacts from the public API
- `npm run validate:dataset` — dataset integrity and release-acceptance gates
- `npm run freshness:check` — staleness gate (curated layer, ingest manifest, country records)

Observed timestamps are real: API-backed metrics keep the source's selected observation year and
the separate retrieval timestamp. A 2024/2025 observation retrieved in 2026 is therefore shown as
2024/2025, not relabeled as current. Curated snapshot providers carry each country record's
`lastUpdated` stamp rather than re-stamping "today", so staleness telemetry ages honestly.

## Backend runtime (Cloudflare Worker)

A Worker serves the live World Bank state so browsers do not hammer the API directly:

- `GET /api/state` — gzip JSON payload of the latest indicator values (KV-backed), or an empty
  `refreshedAt: null` payload before the first cron run. The app falls back to a direct fetch then.
- `GET /api/health` — refresh timestamp + indicator coverage diagnostics.
- Cron `17 3 * * *` — refreshes all 10 World Bank indicators into KV; on total failure the previous
  state is kept untouched (never clobbered by empty data).

One-time setup before `npm run deploy`:

```bash
npx wrangler kv namespace create realpolitik-state
# paste the returned id into wrangler.jsonc → kv_namespaces[0].id
```

Local: `npm run worker:dev` (miniflare serves assets + API + local KV).
CI: `npm run worker:check` typechecks the worker against `@cloudflare/workers-types`.

## CI

- `.github/workflows/ci.yml` — tests, build, worker typecheck, dataset validation, and freshness gate on every push/PR
- `.github/workflows/data-refresh.yml` — nightly World Bank re-fetch; opens a refresh PR when artifacts change

## License

ISC
