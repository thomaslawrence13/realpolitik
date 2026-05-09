# realpolitik

Realpolitik is a browser-based prototype for an interactive 2D geopolitical map. The current build focuses on showing estimated alignment likelihoods, escalation risk, and transparent assumptions rather than claiming deterministic predictions.

## Current prototype

- Interactive 2D world map rendered in the browser
- Clickable seeded countries with a detail panel
- Scenario year slider with simple probability-based simulation updates
- Filters for alliance network, trade exposure, military treaties, conflicts, sanctions, regime type, and risk level
- Event feed and methodology panel to show why the model is making each estimate

## Important framing

This project should not claim to be a 100% accurate predictor of future wars. The prototype uses illustrative weights and seeded country profiles to demonstrate the product direction:

- outputs are **estimated alignment likelihoods**
- confidence is shown explicitly
- assumptions are visible in the UI
- source coverage and last-updated timestamps are surfaced
- unseeded countries remain visible on the map but neutral until a fuller data pipeline exists

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Next steps

- Replace seeded country profiles with versioned source datasets
- Add historical backtesting and calibration
- Add scenario editing for sanctions, elections, invasions, and treaty changes
- Separate data ingestion from the simulation UI
