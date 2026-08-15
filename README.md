# Realpolitik

Realpolitik is a browser-based interactive platform and global tracker for 2D geopolitical analysis and simulation. Moving beyond simple deterministic prediction, the platform offers a **live tracker of global statistics** and a **what-if geopolitical scenario lab** built on a transparent country indicators and relationship-graph model.

It aggregates authoritative macro and developmental statistics, tracks live data-coverage metrics, integrates in-browser World Bank and IMF economic indicators, and models diplomatic/military dependencies.

---

## 🌟 Core Features

### 1. Live Global Tracker Dashboard
*   **Global KPI HUD Banner:** Real-time visibility into median risk levels, count of countries with elevated risk, mean data coverage, and World Bank API live-connection diagnostics.
*   **Live observed KPIs:** Explorable country-level profiles displaying primary indicators (GDP Growth, Inflation, Trade Openness, Regime Type, Military Burden, etc.) from World Bank and IMF sources.
*   **Movers Ranking:** Watchlist featuring the most significant positive or negative risk and economic trajectory shifts dynamically computed across states.

### 2. Interactive Geopolitical Map Canvas
*   **Responsive 2D Visualizer:** Interlocking state boundaries with glass-morphic HUD, interactive hover cards, selection rings, and map legend overlays.
*   **Multi-mode Heatmaps:** Toggle overlays to view alignment states, escalating risks, confidence tiers, or direct demographic/economic dimensions.
*   **Visualizing Edges:** Interactive overlays reflecting complex country-to-country linkages, including military alliances (such as NATO), trade, deterrence networks, and derived bloc-probability anchors.

### 3. What-If Scenario Lab
*   **Scenario Overrides:** Edit specific state shocks (e.g., sanctions, treaty alignment shifts, election volatility, invasion pressure, and coup risk) in real time.
*   **Simulation Weight Sets:** Dynamically alter the mathematical weights of different dimensions (such as prioritizing diplomatic networks, economic exposure, or military strength) with quick preset configurations.
*   **Saved Scenarios & Comparisons:** Pin, name, and compare historical/alternative scenarios side-by-side inside the inspector panel to visualize alignment deltas or structural shifts. Export and import scenarios securely as lightweight `.json` files.

### 4. Robust Data Layer & Pipeline
*   **V15 Data Enrichment:** Dense country metrics populated for ~150 parameterized states, covering 6 core analytical dimensions:
    *   `Cyber`: Capabilities tier, internet freedom, data localization.
    *   `Fiscal`: Sovereign rating, external debt % of GDP, FX reserves cushion.
    *   `Food/Water`: Import dependency, water stress indices, arable land per capita.
    *   `Diplomatic`: UN voting alignment, defense pacts, IGO memberships.
    *   `Critical Minerals`: Producer vs. consumer dominance (rare earth/cobalt).
    *   `Soft Power`: Student mobility, cultural/language reach.
*   **Off-Main-Thread Pipeline:** Standardized ingest tools normalize data, precompute observation dates, audit dataset completeness, and generate regression budgets.

### 5. Information Quality & Transparency
*   **Information Quality Score (IQ Score v2.0.0):** Every state profile includes a computed score (0-100) combining source coverage, dimensional completeness across the v10/v11/v15 expansions, and recency penalties.
*   **Remediation Dashboard Cards:** Surfaced via the methodology panel to highlight low-quality, stale, or incomplete datasets for prioritized data-refresh pipelines.

---

## ⌨️ Keyboard Shortcuts

Access these anytime directly from the interface:
*   `[` : Toggle Left Rail Panel
*   `]` : Toggle Right Inspector Panel
*   `\` : Toggle Bottom Drawer (Scenario Lab & Fact Book)
*   `/` : Focus Search
*   `Space` : Play/Pause Timeline Playback (where active)
*   `?` : Open Keyboard Shortcuts Modal

---

## 🛠️ Developer Guide

### Prerequisites
*   Node.js (v18+)
*   npm (v9+)

### Installation
```bash
npm install
```

### Local Development Server
Launch the local Vite server with hot-reloading:
```bash
npm run dev
```

### Build & Compilation
Compile TypeScript and bundle code optimized for production (uses Rolldown code-splitting):
```bash
npm run build
```

---

## 🧪 Testing, Quality & Pipeline Scripts

### 1. Test Suite
Run unit tests across the simulation engine, persistence logic, and helper libraries, followed by a compilation dry-run:
```bash
npm test
```
*To run only unit tests:*
```bash
npm run test:unit
```

### 2. Data Ingest Pipeline
Ingest normalized IMF World Economic Outlook and World Bank indicators locally to populate precomputed observation maps:
```bash
npm run ingest
```

### 3. Backtesting & Calibration
Evaluate the simulation engine's historical alignments accuracy and calibrate deterministic risk/confidence weightings:
```bash
npm run backtest
```
*To regenerate the deterministic historical fixture used by backtesting:*
```bash
npm run backtest:fixture
```

### 4. Dataset Integrity & Quality Reporting
Perform deep validation checks (geography, timeline, relationship graph edges) and output KPI targets into a machine-readable report:
```bash
npm run validate:dataset
```
*To output only the quality report (`src/data/datasets/quality_report.json`):*
```bash
npm run quality:report
```
*To print the operational artifact register — what was retrieved, when, against which refresh budget, and what each artifact does not evidence:*
```bash
npm run artifacts:status
```

---

## 🏛️ Codebase Architecture & Hygiene

*   **Vite & Rolldown Splitting:** Configured with specific `codeSplitting.groups` in `vite.config.ts`. Splitting decouples the hefty `dataset` chunk (~1.15MB) and the React vendor dependencies from the core client program, preventing heavy initial bundle loads.
*   **Modular Component Splitting:** Large frontend components are divided cleanly under `src/components/inspector/` (e.g. `EconomicStatsSection.tsx`, `AnalysisPanel.tsx`) and `src/components/drawer/` (e.g. `IndexPanel.tsx`, `ScenarioPanel.tsx`).
*   **Centralized Constants:** Critical math rules, risk ranges, default weights, and zoom parameters are consolidated in `src/lib/constants.ts` and verified with dedicated test suites.
