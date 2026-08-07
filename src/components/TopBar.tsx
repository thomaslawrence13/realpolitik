import { memo } from 'react';
import { IconButton, SvgIcon } from './ui';

export type LiveDataStatus = 'loading' | 'live' | 'partial' | 'error';

type Props = {
  /** Calendar-facing label for the frozen present period (e.g. "2024"). */
  asOfLabel: string;
  scenarioName: string;
  datasetVersion: string;
  countryCount: number;
  /** Countries currently at high / critical simulated risk (present snapshot). */
  highRiskCount: number;
  liveDataStatus: LiveDataStatus;
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
  activeEventCount: number;
};

const liveStatusCopy = (
  status: LiveDataStatus,
  diagnostics: Props['liveDataDiagnostics'],
): string => {
  if (status === 'live') return 'World Bank indicators live';
  if (status === 'partial') {
    const ok = diagnostics?.succeededIndicators ?? 0;
    const total = diagnostics?.totalIndicators ?? 0;
    return `Partial live data · ${ok}/${total} indicators`;
  }
  if (status === 'error') return 'Live data unavailable · using static dataset';
  return 'Fetching live indicators…';
};

export const TopBar = memo(function TopBar({
  asOfLabel,
  scenarioName,
  datasetVersion,
  countryCount,
  highRiskCount,
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
  activeEventCount,
}: Props) {
  const liveLabel = liveStatusCopy(liveDataStatus, liveDataDiagnostics);
  const canRetry = liveDataStatus === 'error' || liveDataStatus === 'partial';

  return (
    <header className="topbar">
      <div className="topbar-section topbar-left">
        <IconButton label="Toggle countries panel ([)" active={leftOpen} onClick={onToggleLeft}>
          <SvgIcon.PanelLeft />
        </IconButton>
        <div className="brand">
          <strong
            className="brand-name"
            title={`${datasetVersion} · ${countryCount} parameterized countries`}
          >
            Realpolitik
          </strong>
          <span className="brand-tagline">Live tracker</span>
        </div>
      </div>

      <div className="topbar-section topbar-center">
        <div className="live-strip" role="status" aria-live="polite">
          <button
            type="button"
            className={`live-status-chip live-status-${liveDataStatus}`}
            title={canRetry ? 'Retry live data fetch' : liveLabel}
            onClick={() => {
              if (canRetry) onRetryLiveData();
            }}
            aria-label={liveLabel}
          >
            <span className={`live-status-dot live-status-${liveDataStatus}`} aria-hidden />
            <span className="live-status-text">{liveLabel}</span>
          </button>
          <div className="live-stat" title="Present analysis period (not scrubbable)">
            <span className="live-stat-label">As of</span>
            <strong className="live-stat-value">{asOfLabel}</strong>
          </div>
          <div className="live-stat" title="Parameterized countries in the active dataset">
            <span className="live-stat-label">Countries</span>
            <strong className="live-stat-value">{countryCount}</strong>
          </div>
          <div className="live-stat" title="High or critical risk in the present snapshot">
            <span className="live-stat-label">Elevated risk</span>
            <strong className="live-stat-value">{highRiskCount}</strong>
          </div>
        </div>
      </div>

      <div className="topbar-section topbar-right">
        <button
          type="button"
          className={`scenario-chip ${drawerOpen ? 'scenario-chip-active' : ''}`}
          onClick={onToggleDrawer}
          title="Open analysis tools (scenarios are optional what-ifs on the live snapshot)"
        >
          <em className="scenario-chip-name">
            What-if · {scenarioName}
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
