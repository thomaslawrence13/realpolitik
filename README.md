# realpolitik

Realpolitik is a browser-based prototype for an interactive 2D geopolitical map. The current build focuses on showing estimated alignment likelihoods, escalation risk, transparent assumptions, inspectable country-to-country relationships, and editable scenario shocks rather than claiming deterministic predictions.

## Current prototype

- Interactive 2D world map rendered in the browser
- Clickable parameterized countries with a detail panel
- Risk, confidence, and alignment likelihoods shown as whole percentages (likelihoods sum to 100%)
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

## Next steps

- Replace the illustrative dataset snapshot with ingestion outputs from maintained external sources
- Add historical backtesting and calibration of the weighting model
- Persist user-defined scenarios or export them as structured files
- Compare saved scenarios side-by-side across regions instead of only in a single active run
