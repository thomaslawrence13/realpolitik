# realpolitik

Realpolitik is a browser-based prototype for an interactive 2D geopolitical map. The current build focuses on showing estimated alignment likelihoods, escalation risk, transparent assumptions, inspectable country-to-country relationships, and editable scenario shocks rather than claiming deterministic predictions.

## Current prototype

- Interactive 2D world map rendered in the browser
- Clickable parameterized countries with a detail panel
- Versioned country dataset with source attribution, source coverage, and last-updated metadata
- Relationship graph edges for cooperation, hostility, dependency, and deterrence
- Scenario year slider with probability-based simulation updates driven by structured country indicators
- Scenario editor for sanctions, treaty changes, elections, invasions, and coups
- Baseline-vs-edited comparison with saved scenario history and weight-set presets
- Filters for alliance network, trade exposure, military treaties, conflicts, sanctions, regime type, and risk level
- Event feed and methodology panel to show why the model is making each estimate

## Important framing

This project should not claim to be a 100% accurate predictor of future wars. The prototype uses a versioned but still illustrative dataset to demonstrate the product direction:

- outputs are **estimated alignment likelihoods**
- confidence is shown explicitly
- assumptions and relationship inputs are visible in the UI
- source coverage and last-updated timestamps are surfaced
- saved scenarios keep alternative weight sets and shocks inspectable
- unparameterized countries remain visible on the map but neutral until a fuller data pipeline exists

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Data-backed prototype milestone

This phase freezes the Phase 1 UI contract while moving the internals to a more durable product structure:

- versioned dataset delivery under `src/data/datasets`
- country data/query layer under `src/data`
- simulation logic isolated from React in `src/simulation.ts`
- inspectable relationship overlays and source attribution in the UI
- scenario inputs and saved scenario history layered on top of the same structured data model

## v11 data enhancement

This release significantly expands the analytical surface of the model:

- **Coverage backfill** — demographics, energy posture, top trade partners and
  geographic centroids are now populated for the full set of ~150 parameterised
  states (previously ~45 G20-and-strategic actors).
- **Six new analytical dimensions** for ~50 major actors:
  - `cyber` — offensive/defensive capability tier, internet freedom, data-localization posture
  - `fiscal` — sovereign rating tier, external debt %GDP, FX reserves cushion
  - `foodWater` — food import dependence, water stress index, arable land per capita
  - `diplomatic` — UN voting alignment with bloc anchors, defense pacts, IGO memberships
  - `criticalMinerals` — per-mineral producer / processor / reserves roles with global share
  - `softPower` — composite reach score, inbound students, language reach
- **Relationship-graph derivation** — the ~170 hand-curated edges in v1 are
  augmented at load time with derived edges sourced from top-trade-partner
  shares, shared defense pacts, IGO memberships, and opposing-bloc anchors.
  Derived edges are tagged `sourceId="v11-derived"` and ranked below explicit
  edges in pipeline reconciliation.
- **Simulation overlays** — the simulation consumes the new dimensions as
  bounded modifiers: cyber offensive → deterrence; cyber defensive → sanctions
  damping; fiscal distress / FX cushion → cohesion; food/water stress → cohesion
  and sanctions exposure; UN voting alignment → bloc-probability tilt; defense
  pacts → military commitments and deterrence boost.
- **Seven new event templates** in `src/data/eventLibrary.ts`: systemic cyber
  attack, semiconductor supply shock, Hormuz/Suez closure, water-stress conflict,
  frontier-market default cascade, UN bloc-vote realignment, and a coordinated
  rare-earth/cobalt producer cartel.
- **Dataset version bumped to `0.11.0`** with telemetry exposed via
  `datasetTelemetry` for the methodology panel.

## v12 information quality enhancement

- **Information quality scoring for every country** — each record now receives an
  `informationScore` (0–100) composed of:
  - source-coverage contribution
  - dimensional completeness across macro/military + v10/v11 expansions
  - recency penalties based on `lastUpdated`
- **Actionable quality telemetry** — `informationQualityTelemetry` surfaces:
  - average score
  - stale-country count
  - high-quality/low-quality counts
  - top and weakest information cohorts for prioritised data-refresh work
- **UI integration** — the methodology drawer now renders this telemetry summary
  and highlights top priority refresh targets directly in-product.
- **Remediation dashboard cards** — weakest countries are shown with score,
  source coverage, completeness, staleness age, and top missing dimensions to
  support triage without leaving the app.
- **Per-country quality traces** — country profiles now include a computed
  `dataQuality` payload with per-indicator confidence, staleness flags, and
  explicit degraded reasons (missing enrichments, low coverage, stale updates).
- **Dataset version bumped to `0.12.0`**.

## Data Enhancement Pipeline

The project includes an off-main-thread data ingestion and backtesting pipeline to continuously refine the simulation weights based on real-world reference points.

### Ingestion

The ingestion workflow now executes locally and writes three auditable artifacts under `src/data/datasets`:

- `ingested_snapshot.json` — normalized World Bank indicator snapshot used by the pipeline
- `ingest_manifest.json` — coverage, missingness, and newest-observation metadata per indicator
- `raw/world_bank_latest.json` — raw provider payload preserved for audit/debugging

Current automated coverage is focused on World Bank series already used by the app: military expenditure, trade openness, GDP growth, inflation, political stability, rule of law, and unemployment.

```bash
npm run ingest
```

### Backtesting & Calibration

To measure the simulation engine's accuracy against known historical alignments and calibrate risk/confidence weightings, use the backtesting script:

```bash
npm run backtest
```

### Scenario State

Users can now pin side-by-side scenario comparisons within the right inspector panel to visually identify alignment deltas, risk spikes, and structural shifts caused by user-configured model overrides. Scenarios are exportable/importable securely as independent `.json` blobs to preserve historical snapshots.
