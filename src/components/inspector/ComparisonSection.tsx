import type { Alignment, SimulatedCountry } from '../../types';

export function ComparisonSection({
  comparisonSelected,
  comparisonScenarioName,
  activeSelected,
  alignmentColor,
  alignmentLabel,
  onClearComparison,
}: {
  comparisonSelected: SimulatedCountry;
  comparisonScenarioName: string;
  activeSelected: SimulatedCountry;
  alignmentColor: Record<Alignment, string>;
  alignmentLabel: Record<Alignment, string>;
  onClearComparison: () => void;
}) {
  const riskGap = activeSelected.risk - comparisonSelected.risk;
  const confidenceGap = activeSelected.confidence - comparisonSelected.confidence;
  return (
    <div className="section comparison-section">
      <header className="comparison-header">
        <div>
          <h3 className="section-title">Comparison · {comparisonScenarioName}</h3>
          <p className="comparison-sub">
            How this country fares in the pinned saved analysis versus the active analysis.
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClearComparison}>
          Clear
        </button>
      </header>

      <div className="comparison-rows">
        <div className="comparison-row">
          <span className="comparison-row-label">Alignment</span>
          <span
            className="alignment-pill alignment-pill-sm"
            style={{
              color: alignmentColor[comparisonSelected.alignment],
              borderColor: `${alignmentColor[comparisonSelected.alignment]}55`,
              background: `${alignmentColor[comparisonSelected.alignment]}14`,
            }}
          >
            <i style={{ background: alignmentColor[comparisonSelected.alignment] }} aria-hidden />
            {alignmentLabel[comparisonSelected.alignment]}
          </span>
        </div>
        <div className="comparison-row">
          <span className="comparison-row-label">Pressure</span>
          <strong className="comparison-row-value">
            {comparisonSelected.risk}%
            <em className={`comparison-gap ${riskGap > 0 ? 'comparison-gap-up' : riskGap < 0 ? 'comparison-gap-down' : ''}`}>
              active {riskGap > 0 ? '+' : ''}{riskGap}
            </em>
          </strong>
        </div>
        <div className="comparison-row">
          <span className="comparison-row-label">Confidence</span>
          <strong className="comparison-row-value">
            {comparisonSelected.confidence}%
            <em className={`comparison-gap ${confidenceGap > 0 ? 'comparison-gap-up' : confidenceGap < 0 ? 'comparison-gap-down' : ''}`}>
              active {confidenceGap > 0 ? '+' : ''}{confidenceGap}
            </em>
          </strong>
        </div>
        {(['blocA', 'blocB', 'nonAligned'] as const).map((key) => (
          <div key={key} className="comparison-row">
            <span className="comparison-row-label">P({alignmentLabel[key as Alignment]})</span>
            <strong className="comparison-row-value">
              {comparisonSelected.probabilities[key]}%
              <em className="comparison-gap">
                active {activeSelected.probabilities[key] > comparisonSelected.probabilities[key] ? '+' : ''}
                {activeSelected.probabilities[key] - comparisonSelected.probabilities[key]}
              </em>
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
