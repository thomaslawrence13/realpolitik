import { memo } from 'react';
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

export const TopBar = memo(function TopBar({
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
          <strong
            className="brand-name"
            title={`${datasetVersion} · ${countryCount} parameterized · ${
              liveDataStatus === 'live'
                ? 'Live data ready'
                : liveDataStatus === 'partial'
                  ? `${liveDataDiagnostics?.succeededIndicators ?? 0}/${liveDataDiagnostics?.totalIndicators ?? 0} live indicators`
                  : liveDataStatus === 'error'
                    ? 'Live data unavailable (using static dataset)'
                    : 'Fetching live data…'
            }`}
          >
            Realpolitik
          </strong>
          <button
            type="button"
            className={`live-status-dot live-status-${liveDataStatus}`}
            title={liveDataStatus === 'error' || liveDataStatus === 'partial' ? 'Retry live data fetch' : 'Live data status'}
            onClick={() => {
              if (liveDataStatus === 'error' || liveDataStatus === 'partial') onRetryLiveData();
            }}
            aria-label="Live data status"
          />
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
          <em className="scenario-chip-name">
            Analysis · {scenarioName}
            {activeEventCount > 0 ? ` · ${activeEventCount}` : ''}
          </em>
          <SvgIcon.Chevron dir="down" />
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
});
