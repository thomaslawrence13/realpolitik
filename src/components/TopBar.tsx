import { IconButton, SvgIcon } from './ui';

type Props = {
  timelineIndex: number;
  timeline: string[];
  onTimelineChange: (index: number) => void;
  scenarioName: string;
  datasetVersion: string;
  countryCount: number;
  liveDataStatus: 'loading' | 'live' | 'error';
  leftOpen: boolean;
  rightOpen: boolean;
  drawerOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleDrawer: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
};

export function TopBar({
  timelineIndex,
  timeline,
  onTimelineChange,
  scenarioName,
  datasetVersion,
  countryCount,
  liveDataStatus,
  leftOpen,
  rightOpen,
  drawerOpen,
  onToggleLeft,
  onToggleRight,
  onToggleDrawer,
  isPlaying,
  onTogglePlay,
}: Props) {
  const lastIndex = timeline.length - 1;
  const pct = lastIndex === 0 ? 0 : (timelineIndex / lastIndex) * 100;

  return (
    <header className="topbar">
      <div className="topbar-section topbar-left">
        <IconButton label="Toggle countries panel" active={leftOpen} onClick={onToggleLeft}>
          <SvgIcon.PanelLeft />
        </IconButton>
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <strong className="brand-name">Realpolitik</strong>
          <span className="brand-meta">
            <span className="brand-pill">{datasetVersion}</span>
            <span className="brand-sep">·</span>
            <span>{countryCount} parameterized</span>
            <span className="brand-sep">·</span>
            <span
              className={`live-status live-status-${liveDataStatus}`}
              title={{
                loading: 'Fetching live World Bank indicators…',
                live: 'Indicators enriched with live World Bank data',
                error: 'Live data unavailable — using static dataset',
              }[liveDataStatus]}
            >
              {liveDataStatus === 'live' ? 'live data' : liveDataStatus === 'error' ? 'static data' : 'updating…'}
            </span>
          </span>
        </div>
      </div>

      <div className="topbar-section topbar-center">
        <div className="timeline">
          <button
            type="button"
            className="timeline-step"
            onClick={() => onTimelineChange(Math.max(0, timelineIndex - 1))}
            disabled={timelineIndex === 0}
            aria-label="Previous year"
          >
            <SvgIcon.Chevron dir="left" />
          </button>
          <div className="timeline-track-wrap">
            <strong className="timeline-year">{timeline[timelineIndex]}</strong>
            <input
              type="range"
              min={0}
              max={lastIndex}
              value={timelineIndex}
              onChange={(event) => onTimelineChange(Number(event.target.value))}
              className="timeline-input"
              style={{ ['--track-pct' as string]: `${pct}%` }}
              aria-label="Scenario year"
            />
          </div>
          <button
            type="button"
            className="timeline-step"
            onClick={() => onTimelineChange(Math.min(lastIndex, timelineIndex + 1))}
            disabled={timelineIndex === lastIndex}
            aria-label="Next year"
          >
            <SvgIcon.Chevron dir="right" />
          </button>
          <button
            type="button"
            className={`timeline-play ${isPlaying ? 'timeline-play-active' : ''}`}
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
            title={isPlaying ? 'Pause (auto-stepping years)' : 'Play (auto-step through years)'}
          >
            {isPlaying ? <SvgIcon.Pause /> : <SvgIcon.Play />}
          </button>
        </div>
      </div>

      <div className="topbar-section topbar-right">
        <button
          type="button"
          className={`scenario-chip ${drawerOpen ? 'scenario-chip-active' : ''}`}
          onClick={onToggleDrawer}
        >
          <span className="scenario-chip-label">Scenario</span>
          <em className="scenario-chip-name">{scenarioName}</em>
          <span className="scenario-chip-indicator" aria-hidden />
        </button>
        <IconButton label="Toggle drawer" active={drawerOpen} onClick={onToggleDrawer}>
          <SvgIcon.PanelBottom />
        </IconButton>
        <IconButton label="Toggle inspector" active={rightOpen} onClick={onToggleRight}>
          <SvgIcon.PanelRight />
        </IconButton>
      </div>
    </header>
  );
}
