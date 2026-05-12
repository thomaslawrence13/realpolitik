import { IconButton, SvgIcon } from './ui';

type Props = {
  timelineIndex: number;
  timeline: string[];
  onTimelineChange: (index: number) => void;
  scenarioName: string;
  datasetVersion: string;
  countryCount: number;
  liveDataStatus: 'loading' | 'live' | 'partial' | 'error';
  liveDataDiagnostics: {
    totalIndicators: number;
    succeededIndicators: number;
    failedIndicators: number;
    failedCodes: string[];
  } | null;
  onRetryLiveData: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
  drawerOpen: boolean;
  helpOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleDrawer: () => void;
  onToggleHelp: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  activeEventCount: number;
};

export function TopBar({
  timelineIndex,
  timeline,
  onTimelineChange,
  scenarioName,
  datasetVersion,
  countryCount,
  liveDataStatus,
  liveDataDiagnostics,
  onRetryLiveData,
  leftOpen,
  rightOpen,
  drawerOpen,
  helpOpen,
  onToggleLeft,
  onToggleRight,
  onToggleDrawer,
  onToggleHelp,
  isPlaying,
  onTogglePlay,
  activeEventCount,
}: Props) {
  const lastIndex = timeline.length - 1;
  const pct = lastIndex === 0 ? 0 : (timelineIndex / lastIndex) * 100;

  return (
    <header className="topbar">
      <div className="topbar-section topbar-left">
        <IconButton label="Toggle countries panel ([)" active={leftOpen} onClick={onToggleLeft}>
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
                  live: 'All live World Bank indicators loaded successfully',
                  partial: `Partially enriched: ${liveDataDiagnostics?.succeededIndicators ?? 0}/${liveDataDiagnostics?.totalIndicators ?? 0} indicators loaded`,
                  error: 'Live data unavailable — using static dataset',
                }[liveDataStatus]}
              >
                {liveDataStatus === 'live'
                  ? 'live data'
                  : liveDataStatus === 'partial'
                    ? `${liveDataDiagnostics?.succeededIndicators ?? 0}/${liveDataDiagnostics?.totalIndicators ?? 0} live`
                    : liveDataStatus === 'error'
                      ? 'static data'
                      : 'updating…'}
              </span>
            {(liveDataStatus === 'error' || liveDataStatus === 'partial') && (
              <button type="button" className="live-status-retry" onClick={onRetryLiveData}>
                Retry
              </button>
            )}
          </span>
        </div>
      </div>

      <div className="topbar-section topbar-center">
        <div className="timeline">
          <button
            type="button"
            className="timeline-step"
            onClick={() => onTimelineChange(0)}
            disabled={timelineIndex === 0}
            aria-label="Skip to first period"
            title="Skip to earliest period"
          >
            <SvgIcon.SkipBack />
          </button>
          <button
            type="button"
            className="timeline-step"
            onClick={() => onTimelineChange(Math.max(0, timelineIndex - 1))}
            disabled={timelineIndex === 0}
            aria-label="Previous period"
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
              aria-label="Historical period"
            />
          </div>
          <button
            type="button"
            className="timeline-step"
            onClick={() => onTimelineChange(Math.min(lastIndex, timelineIndex + 1))}
            disabled={timelineIndex === lastIndex}
            aria-label="Next period"
          >
            <SvgIcon.Chevron dir="right" />
          </button>
          <button
            type="button"
            className="timeline-step"
            onClick={() => onTimelineChange(lastIndex)}
            disabled={timelineIndex === lastIndex}
            aria-label="Skip to latest period"
            title="Skip to latest period"
          >
            <SvgIcon.SkipForward />
          </button>
          <button
            type="button"
            className={`timeline-play ${isPlaying ? 'timeline-play-active' : ''}`}
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
            title={isPlaying ? 'Pause (auto-stepping periods)' : 'Play (auto-step through periods)'}
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
          <span className="scenario-chip-label">Analysis</span>
          <em className="scenario-chip-name">{scenarioName}</em>
          {activeEventCount > 0 && (
            <em className="scenario-event-badge" title={`${activeEventCount} event${activeEventCount !== 1 ? 's' : ''} applied`}>
              {activeEventCount}
            </em>
          )}
          <span className="scenario-chip-indicator" aria-hidden />
        </button>
        <IconButton label="Toggle analysis drawer (\)" active={drawerOpen} onClick={onToggleDrawer}>
          <SvgIcon.PanelBottom />
        </IconButton>
        <IconButton label="Toggle inspector (])" active={rightOpen} onClick={onToggleRight}>
          <SvgIcon.PanelRight />
        </IconButton>
        <IconButton label="Keyboard shortcuts (?)" active={helpOpen} onClick={onToggleHelp}>
          <SvgIcon.Info />
        </IconButton>
      </div>
    </header>
  );
}
