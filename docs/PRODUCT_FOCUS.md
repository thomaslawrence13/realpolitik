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
| Live WB data | `src/data/worldBankClient.ts`, `liveEnrichment.ts` | Real product differentiator; under-featured in the chrome |
| Dataset | `src/data/datasets/*`, `countryData.ts` | Strong v11 surface (cyber, fiscal, food/water, minerals…) |
| Map UI | `MapCanvas.tsx` (~1.8k lines) | Partially split under `components/map/`; still huge |
| Panels | LeftRail, RightInspector, BottomDrawer | Scenario-centric drawer tabs compete with “live stats” |

## Refactor backlog (engineering)

### P0 — Focus (this direction)
- [x] Remove timeline scrubber / play controls from the top bar  
- [x] Pin simulation to the present period (latest index)  
- [ ] Replace scenario-first chrome with **global live summary** (aggregates, as-of, coverage)  
- [ ] Promote economic/military/stats fill modes as the default map reading  
- [ ] Demote scenario lab (events/weights/save) to a clearly secondary “what-if” mode  

### P1 — Structure
- Finish splitting `MapCanvas.tsx` (layers, projection, interaction, legend already started)  
- Split `App.tsx` into shell + `useAppChrome` / `useScenarios` / `useLiveSession`  
- One ownership model for UI state (map store **or** React state — not both for the same fields)  
- Delete or quarantine dead timeline helpers once present-only is stable  

### P2 — Live tracker product
- Global dashboard strip: median risk, high-risk count, live indicator coverage, last fetch time  
- Country inspector: lead with **observed** WB series + static provenance; sim scores secondary  
- Ranked tables (movers by live delta when series exist, not scenario year deltas)  
- Explicit “as of” timestamps on every metric  
- Offline/static fallback copy that never pretends to be live  

### P3 — Scenario lab (keep, narrow)
- Keep shocks/events/weights as an optional analysis drawer  
- Drop fake multi-year scrubbing; scenarios apply to **current** snapshot only  
- Share URLs encode scenario shocks, not timeline index  

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
