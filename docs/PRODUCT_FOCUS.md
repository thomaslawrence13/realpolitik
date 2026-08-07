# Realpolitik — product focus & refactor review

_As of 2026-08-07. Direction: drop the scrubbable timeline; become a **live tracker of global statistics** on the existing map foundation._

## What the product is now

A dense prototype that mixes three products in one shell:

1. **Alignment simulator** — bloc probabilities, risk, confidence per country  
2. **Scenario lab** — shocks, events, weight sets, saved scenarios, share URLs  
3. **Live data layer** — World Bank enrichment of static profiles  

The map + country model + live fetch + inspector stats are the durable foundation.  
The **draggable timeline / autoplay** is not: it only walks a three-label array (`2022`–`2024`) and multiplies a synthetic “year offset” into risk. It does not deliver real historical series or a credible forecast path.

## Architecture snapshot

| Area | Location | Notes |
|------|----------|--------|
| App shell / wiring | `src/App.tsx` (~900 lines) | Still the god component: persistence, scenarios, panels, live data, shortcuts |
| Map store + worker | `src/store/useMapStore.ts`, `src/workers/` | Good isolation of heavy sim; still keyed by `timelineIndex` |
| Simulation | `src/simulation.ts` | Pure logic; timeline used as a momentum offset, not calendar truth |
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
- [x] Demote scenario lab (events/weights/save) to a clearly secondary “what-if” mode  

### P1 — Structure
- [x] Extract `CountryLayers` into `components/map/` (continue MapCanvas split)  
- [x] Deduplicate `MapLegendControls` + drop MapCanvas color/legend clones  
- [x] Split `App.tsx` into shell + `useAppChrome` / `useScenarios` / `useLiveSession`  
- [ ] One ownership model for UI state (map store **or** React state — not both for the same fields)  
- [x] Delete dead inspector panels (Overview/Stats/Relationships) after Snapshot amalgamation  
- [ ] Delete or quarantine residual timeline helpers once present-only is fully stable  
- [ ] Extract map pan/zoom interaction into `useMapInteraction`  

### P2 — Live tracker product
- [x] Global dashboard strip: median risk, elevated count, mean coverage, last fetch time  
- [x] Country inspector: lead with **observed** econ/mil KPIs; sim scores secondary  
- [x] Explicit “as of” timestamps on coverage / profile data  
- [x] Ranked tables — live series movers (static → enriched) lead; scenario deltas secondary  
- [x] Offline/static fallback copy that never pretends to be live (status chip + retry)  
- [x] Data coverage density (ingest MRV, curated fallbacks, pipeline bootstrap)  

### P3 — Scenario lab (keep, narrow)
- [x] Keep shocks/events/weights as an optional analysis drawer  
- [x] Drop fake multi-year scrubbing; scenarios apply to **current** snapshot only  
- [ ] Share URLs encode scenario shocks, not timeline index (index still persisted for compat)  

## Non-goals (for now)

- Multi-user collaboration  
- Cascading event chains  
- Claiming predictive accuracy  
- Building a full time-series historical player (unless real series land first)

## Success criteria

1. A first-time user can open the app and understand **today’s** global picture without touching a year slider.  
2. Live World Bank status is first-class (loading / partial / live / error + retry).  
3. Scenario tools remain available but do not dominate the default chrome.  
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
