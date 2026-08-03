# Feature Enhancement Roadmap

## Executive Summary

This document outlines proposed feature enhancements for the realpolitik geopolitical simulation platform, organized by impact and implementation complexity.

**Current Status:** Phase 1 - Foundation improvements in progress

## Recently Implemented

### Map Legend Component ✓
- **File:** `src/components/MapLegend.tsx`
- **Status:** Component created, ready for integration
- **Features:**
  - Toggle button to show/hide legend
  - Dynamic content based on current map fill mode
  - Color keys for alignment, risk, confidence, and shift modes
  - Metric-specific legends for economic/demographic visualizations
  - Current mode indicator

## Priority 1: High Impact, Low Complexity

### 1.1 Export/Import Scenarios as JSON
**Status:** Partially implemented (persistence.ts has export/import functions)
**Enhancement:** Add UI buttons in TopBar or BottomDrawer to easily export current scenario state and import previously saved scenarios.

**Benefits:**
- Easy sharing of scenario configurations
- Backup and restore capability
- Collaborative analysis workflows

### 1.2 Keyboard Shortcuts Reference
**Status:** Implemented (ShortcutsHelp.tsx exists)
**Enhancement:** Add a visible "?" button in the UI chrome to access the shortcuts modal.

### 1.3 Map Legend / Color Key ✓
**Status:** Component created (`MapLegend.tsx`)
**Next Step:** Integrate into App.tsx and add CSS styles

## Priority 2: High Impact, Medium Complexity

### 2.1 Country Comparison View
**Enhancement:** Side-by-side comparison of 2-3 countries showing:
- Key metrics table
- Alignment probabilities comparison chart
- Relationship graph between selected countries
- Driver breakdown comparison

**Benefits:**
- Direct comparative analysis
- Better understanding of relative positioning
- Educational value

### 2.2 Timeline Bookmarks / Milestones
**Enhancement:** Allow users to mark specific timeline years with notes:
- "Event X triggered"
- "Threshold crossed"
- Custom annotations

**Benefits:**
- Track narrative arcs through scenarios
- Document critical inflection points
- Share annotated timelines

### 2.3 Sensitivity Analysis Dashboard
**Enhancement:** Visual display showing how changing each weight affects outcomes:
- Tornado chart of weight sensitivities
- One-click "stress test" presets
- Monte Carlo-style uncertainty visualization

**Benefits:**
- Better understanding of model drivers
- Transparency about assumptions
- Robustness testing

## Priority 3: High Impact, High Complexity

### 3.1 Event Chain / Cascading Effects
**Enhancement:** Model secondary and tertiary effects of events:
- Event A triggers Event B after N months
- Regional spillover effects
- Economic sanction cascades through trade partners

**Benefits:**
- More realistic scenario modeling
- Capture complex interdependencies
- Better strategic planning tool

### 3.2 Multi-User Collaboration
**Enhancement:** Real-time or async collaboration features:
- Shared scenario workspaces
- Comment threads on countries/events
- Version history and diff view
- Role-based permissions

**Benefits:**
- Team-based analysis
- Institutional knowledge capture
- Peer review workflow

### 3.3 Advanced Visualization Modes
**Enhancement:** Additional map visualization options:
- Flow maps for trade relationships
- Heat maps for risk clusters
- Animated transitions between states
- 3D globe view (using Three.js or similar)

**Benefits:**
- Richer analytical perspectives
- Better pattern recognition
- More engaging presentation mode

## Priority 4: Medium Impact Enhancements

### 4.1 Search & Filter Improvements
- Advanced search with boolean operators
- Save custom filter presets
- Filter by multiple criteria simultaneously
- Search within relationship notes

### 4.2 Data Provenance Deep-Dive
- Click-through from indicators to source documents
- Methodology footnotes per indicator
- Confidence interval visualization
- Temporal data quality trends

### 4.3 Notification System
- Alert when risk crosses threshold
- Notify when alignment shifts
- Track changes between scenario versions

### 4.4 Mobile Responsiveness
- Touch-optimized map interactions
- Collapsible panels for small screens
- Gesture support (pinch zoom, swipe)

## Technical Debt & Infrastructure

### 5.1 Performance Optimizations
- Code splitting for large components (MapCanvas: 816KB)
- Virtual scrolling for country lists
- Web Worker offloading for heavy simulations
- Memoization improvements

### 5.2 Testing Coverage
- Component unit tests (React Testing Library)
- Integration tests for user workflows
- E2E tests (Playwright or Cypress)
- Accessibility tests (axe-core)

### 5.3 Accessibility (a11y)
- ARIA labels throughout UI
- Keyboard navigation improvements
- Screen reader optimization
- Color contrast compliance (WCAG 2.1 AA)

### 5.4 Documentation
- API documentation (TypeDoc)
- User guide / tutorial mode
- Developer onboarding guide
- Architecture decision records (ADRs)

## Metrics for Success

### User Engagement
- Time spent per session
- Number of scenarios created/saved
- Feature adoption rates
- Return visitor rate

### Data Quality
- Information score trends over time
- Coverage expansion metrics
- Staleness reduction rate
- Source diversity index

### Technical Health
- Build time (< 5s target)
- Bundle size (< 1MB JS target)
- Test coverage (> 80% target)
- Lighthouse scores (> 90 target)

## Implementation Phasing

### Phase 1 (Q1): Foundation
- Export/Import UI
- Map legend
- Keyboard shortcut button
- Basic performance optimizations

### Phase 2 (Q2): Analytics
- Country comparison view
- Timeline bookmarks
- Sensitivity dashboard
- Enhanced search/filter

### Phase 3 (Q3): Collaboration
- Multi-user features
- Comment system
- Version history
- Notification system

### Phase 4 (Q4): Polish
- Mobile responsiveness
- Accessibility audit & fixes
- Advanced visualizations
- Documentation complete

## Open Questions

1. Should we integrate with external data providers for real-time updates?
2. What's the strategy for handling conflicting source data?
3. How do we balance model complexity with interpretability?
4. Should we offer an API for programmatic access?
5. What's the monetization strategy (if any)?

---

*Last updated: 2024*
*Version: 1.0*
