# Realpolitik — product focus & refactor review

_As of 2026-08-08. Direction: operate Realpolitik as a **live tracker of global statistics** on the existing map foundation._

## What the product is now

A dense tracker shell with three coherent surfaces:

1. **Observed country posture** — deterministic alignment, stress, confidence, and provenance
2. **Current-snapshot analysis** — optional filters, relationship overlays, and shareable map reading state
3. **Live data layer** — World Bank enrichment of static profiles plus refreshed political registries

The map + country model + live fetch + inspector stats are the durable foundation. The old draggable timeline/autoplay was removed. Historical economic series are rendered only where real observations exist; the product still makes no forecast claim.

## Architecture snapshot

| Area | Location | Notes |
|------|----------|--------|
| App shell / wiring | `src/App.tsx` | Shell state is in `useAppChrome`; map state is in `useMapStore`; live state is in `useLiveSession` |
| Map store + interaction | `src/store/useMapStore.ts`, `src/hooks/useMapInteraction.ts` | One owner for map controls and viewport input |
| Assessment | `src/assessment.ts` | Observed-state stress and information-quality scoring; no time offset or forecast |
| Live WB data | `src/data/worldBankClient.ts`, `liveEnrichment.ts` | Real product differentiator; first-class in chrome |
| Dataset | `src/data/datasets/*`, `countryData.ts` | Pipeline bootstrap + denser ingest (v15 coverage) |
| Map UI | `MapCanvas.tsx` + `components/map/*` | CountryLayers extracted; still large canvas shell |
| Panels | LeftRail, RightInspector, BottomDrawer | Snapshot inspector default; what-if demoted |

## Refactor backlog (engineering)

### P0 — Focus (this direction)
- [x] Remove timeline scrubber / play controls from the top bar
- [x] Pin simulation to the present period (latest index)
- [x] Replace scenario-first chrome with **global live summary** (aggregates, as-of, coverage)
- [x] Promote economic/military/stats fill modes as the default map reading (default **risk**)
- [x] Remove obsolete scenario lab controls from the live-tracker shell

### P1 — Structure
- [x] Extract `CountryLayers` into `components/map/` (continue MapCanvas split)
- [x] Deduplicate `MapLegendControls` + drop MapCanvas color/legend clones
- [x] Split `App.tsx` into shell + `useAppChrome` / `useScenarios` / `useLiveSession`
- [x] One ownership model for UI state (map store for map controls; React hook for viewport interaction)
- [x] Delete dead inspector panels (Overview/Stats/Relationships) after Snapshot amalgamation
- [x] Delete or quarantine residual timeline helpers once present-only is fully stable
- [x] Extract map pan/zoom interaction into `useMapInteraction`

### P2 — Live tracker product
- [x] Global dashboard strip: median risk, elevated count, mean coverage, last fetch time
- [x] Country inspector: lead with **observed** econ/mil KPIs; sim scores secondary
- [x] Explicit “as of” timestamps on coverage / profile data
- [x] Ranked tables — live series movers (static → enriched) lead; scenario deltas secondary
- [x] Offline/static fallback copy that never pretends to be live (status chip + retry)
- [x] Data coverage density (ingest MRV, curated fallbacks, pipeline bootstrap)

### P3 — Shareable current snapshots
- [x] Keep methodology and factual-index analysis in the optional bottom drawer
- [x] Drop fake multi-year scrubbing; all displayed scores describe the **current** snapshot
- [x] Share URLs encode the selected country and current map reading modes; no timeline index is persisted

## Non-goals (for now)

- Multi-user collaboration
- Cascading event chains
- Claiming predictive accuracy
- Inventing a historical relationship player without an upstream edge time series

## Success criteria

1. A first-time user can open the app and understand **today’s** global picture without touching a year slider.
2. Live World Bank status is first-class (loading / partial / live / error + retry).
3. Methodology, comparison, and export tools remain available without dominating the default chrome.
4. Build/test stay green; MapCanvas and App continue to shrink over subsequent PRs.

## Phase log

| Phase | Outcome |
|-------|---------|
| Live tracker pivot | Timeline scrubber removed; present pin; what-if label |
| Dense sidebars | Snapshot inspector + compact left rail |
| Perf / bugs | Hooks order, single sim owner, worker bulk flags |
| HUD + map aesthetics | Glass chrome, ocean layers, selection rings |
| Data coverage (v15) | Dense ingest, curated fallbacks, 100% indicator coverage |
| Live summary phase | Global aggregates strip, risk-default map, observed-first KPIs, CountryLayers extract |
| **Structure phase (this)** | App hooks split, MapCanvas legend dedupe, live-series movers ranking |
| Tracker hardening | Backend partial-refresh retention, unified map state, interaction hook, exports, share links, mobile transitions, relationship evidence lens |

## Data registries & pipelines

- **v15 dataset** (bootstrapped baseline): 134 covered countries, 171 bilateral relationships, curated
  fallbacks so every covered country has every indicator. `src/data/countryData.ts` overlays artifacts
  only while fresh (window gate by nominal cadence).
- **Field-level provenance (v11Enhancements)**: every auto-derived field records `provenance` (source,
  composite, GA-resolved, inferred ribow), `sourceTitle`, `sourceUrl`, `retrievedAt` and carries the
  honesty flag `unverified: true` when not manually benchmarked at factor level. A missing-population
  ribow edge in the aggregation DAG is detected by `scripts/validateDataset.ts` and fails the build;
  the process never silently substitutes a transmitted value.
- **Official UN voting**: `npm run refresh:unvotes` ingests the UN Digital Library GA voting CSV
  (record 4060887, ~467k recorded-vote rows through 31 Dec 2025) rebuilt as per-country agreement
  with bloc anchors into `un_ga_votes.json` (`src/lib/unVotesOfficial.ts`; the exact seat-name
  resolver is `buildSeatToIso` in `src/lib/unVotes.ts`). Coverage ~190 members; anchors excluded by
  design.
- **US SDN registry**: `npm run refresh:ofac` retains the full Treasury SDN list
  (`ofac_sanctions_registry.json`); only countries in the above coverage map surface it.
- **Conflict feed**: `npm run refresh:ucdp` pulls the UCDP Country-Year Dataset on Organized
  Violence v26.1 into `ucdp_conflict.json` (134 countries by death-level and type per year).
- `scripts/validateDataset.ts` guards shape, freshness window and cross-references for the static
  dataset and every live artifact; `freshness:check` guards the blocks on CI.
- **Operational artifact register**: `src/data/artifactRegistry.ts` is the single description of what
  this build has actually retrieved — UNGA votes, OFAC SDN, UCDP organized violence and the World
  Bank history artifact — with per-artifact refresh budgets, boundaries and refresh commands. The
  runtime overlay gate (`countryData.ts`), the CI freshness gate (`freshness:check`), the release view
  in the methodology panel and `npm run artifacts:status` all read the same rows, so the age a reader
  sees is the age CI enforces. It is deliberately separate from `sourceRegistry.ts`: descriptors count
  publishers, the register counts retrievals, and conflating them is how a 21-descriptor registry gets
  misread as 21 wired feeds. The history artifact is dated through a committed sidecar
  (`historical_series_meta.json`) so the register never pulls the ~677 KB payload into the eager bundle;
  `validateDataset` checks the sidecar against the full artifact.
- **Provenance gate**: World Bank governance series are fetched from API catalogue source 3 and must be
  credited to WGI, not WDI. `validateProvenanceRegistryParity` enforces that tagging mechanically, and
  also enforces parity between the static dataset registry (`v1.ts`) and the runtime `SOURCE_REGISTRY`.
