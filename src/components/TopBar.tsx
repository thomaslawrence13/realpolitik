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
  if (status === 'live') return 'Live';
  if (status === 'partial') {
    const ok = diagnostics?.succeededIndicators ?? 0;
    const total = diagnostics?.totalIndicators ?? 0;
    return `Partial · ${ok}/${total}`;
  }
  if (status === 'error') return 'Offline';
  return 'Syncing…';
};

const liveStatusDetail = (
  status: LiveDataStatus,
  diagnostics: Props['liveDataDiagnostics'],
): string => {
  if (status === 'live') return 'World Bank indicators are up to date';
  if (status === 'partial') {
    const failed = diagnostics?.failedIndicators ?? 0;
    return `${failed} indicator${failed === 1 ? '' : 's'} failed · click to retry`;
  }
  if (status === 'error') return 'Live data unavailable · using static dataset · click to retry';
  return 'Fetching World Bank indicators…';
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
  const liveDetail = liveStatusDetail(liveDataStatus, liveDataDiagnostics);
  const canRetry = liveDataStatus === 'error' || liveDataStatus === 'partial';

  return (
    <header className="topbar">
      <div className="topbar-section topbar-left">
        <IconButton label="Toggle countries panel ([)" active={leftOpen} onClick={onToggleLeft}>
          <SvgIcon.PanelLeft />
        </IconButton>
        <div
          className="brand"
          title={`${datasetVersion} · ${countryCount} parameterized countries`}
        >
          <span className="brand-mark" aria-hidden />
          <div className="brand-text">
            <strong className="brand-name">Realpolitik</strong>
            <span className="brand-tagline">Live tracker</span>
          </div>
        </div>
      </div>

      <div className="topbar-section topbar-center">
        <div className="live-strip" role="status" aria-live="polite">
          <button
            type="button"
            className={`live-status-chip live-status-${liveDataStatus}`}
            title={liveDetail}
            onClick={() => {
              if (canRetry) onRetryLiveData();
            }}
            aria-label={liveDetail}
          >
            <span className={`live-status-dot live-status-${liveDataStatus}`} aria-hidden />
            <span className="live-status-text">{liveLabel}</span>
          </button>

          <span className="live-strip-divider" aria-hidden />

          <div className="live-stat" title="Present analysis period">
            <span className="live-stat-label">As of</span>
            <strong className="live-stat-value">{asOfLabel}</strong>
          </div>

          <div className="live-stat" title="Parameterized countries in the active dataset">
            <span className="live-stat-label">States</span>
            <strong className="live-stat-value">{countryCount}</strong>
          </div>

          <div
            className={`live-stat ${highRiskCount > 0 ? 'live-stat-risk' : ''}`}
            title="High or critical risk in the present snapshot"
          >
            <span className="live-stat-label">Elevated</span>
            <strong className="live-stat-value">{highRiskCount}</strong>
          </div>
        </div>
      </div>

      <div className="topbar-section topbar-right">
        <button
          type="button"
          className={`scenario-chip ${drawerOpen ? 'scenario-chip-active' : ''}`}
          onClick={onToggleDrawer}
          title="Open analysis tools (what-if shocks on the live snapshot)"
        >
          <span className="scenario-chip-kicker">What-if</span>
          <em className="scenario-chip-name">
            {scenarioName}
            {activeEventCount > 0 ? (
              <span className="scenario-chip-badge">{activeEventCount}</span>
            ) : null}
          </em>
          <SvgIcon.Chevron dir="down" />
        </button>
        <div className="topbar-actions">
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
      </div>
    </header>
  );
});
