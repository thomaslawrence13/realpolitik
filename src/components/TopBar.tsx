import { memo, useState } from 'react';
import { IconButton, SvgIcon } from './ui';
import { formatHudAge, formatHudClock } from '../lib/globalStats';

export type LiveDataStatus = 'loading' | 'live' | 'partial' | 'error';

type Props = {
  /** Newest observed data date across all sources (dataset-driven). */
  asOfLabel: string;
  datasetVersion: string;
  countryCount: number;
  /** Countries currently at elevated risk (≥55). */
  elevatedRiskCount: number;
  /** Median risk across all assessed countries. */
  medianRisk: number;
  /** Mean per-country fresh coverage (0–100). */
  meanCoverage: number;
  /** Live World Bank indicator success ratio as 0–100, or null while unknown. */
  liveIndicatorCoveragePct: number | null;
  /** ISO timestamp of last successful live fetch (partial counts). */
  liveFetchedAt: string | null;
  liveDataStatus: LiveDataStatus;
  liveDataDiagnostics: {
    totalIndicators: number;
    succeededIndicators: number;
    failedIndicators: number;
    failedCodes: string[];
    latestObservedYear?: string | null;
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
  shareUrl: string;
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
  liveFetchedAt: string | null,
): string => {
  const age = formatHudAge(liveFetchedAt);
  if (status === 'live') {
    const observed = diagnostics?.latestObservedYear ? ` · latest published ${diagnostics.latestObservedYear}` : '';
    return `World Bank API synced${observed} · fetched ${age}`;
  }
  if (status === 'partial') {
    const failed = diagnostics?.failedIndicators ?? 0;
    const observed = diagnostics?.latestObservedYear ? ` · latest published ${diagnostics.latestObservedYear}` : '';
    return `${failed} indicator${failed === 1 ? '' : 's'} failed${observed} · fetched ${age} · click to retry`;
  }
  if (status === 'error') return 'Live data unavailable · using static + ingest · click to retry';
  return 'Fetching World Bank indicators…';
};

export const TopBar = memo(function TopBar({
  asOfLabel,
  datasetVersion,
  countryCount,
  elevatedRiskCount,
  medianRisk,
  meanCoverage,
  liveIndicatorCoveragePct,
  liveFetchedAt,
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
  shareUrl,
}: Props) {
  const [shareStatus, setShareStatus] = useState<'idle' | 'done' | 'failed'>('idle');
  const liveLabel = liveStatusCopy(liveDataStatus, liveDataDiagnostics);
  const liveDetail = liveStatusDetail(liveDataStatus, liveDataDiagnostics, liveFetchedAt);
  const canRetry = liveDataStatus === 'error' || liveDataStatus === 'partial';
  const liveCovLabel =
    liveIndicatorCoveragePct == null ? '—' : `${liveIndicatorCoveragePct}%`;
  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      if ('share' in navigator && typeof navigator.share === 'function') {
        await navigator.share({ title: 'Realpolitik snapshot', url: shareUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = shareUrl;
        input.setAttribute('readonly', 'true');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Clipboard unavailable');
      }
      setShareStatus('done');
    } catch {
      setShareStatus('failed');
    }
    window.setTimeout(() => setShareStatus('idle'), 1800);
  };

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

          <div className="live-stat" title="Newest observed data point across all country profiles and sources">
            <span className="live-stat-label">As of</span>
            <strong className="live-stat-value">{asOfLabel}</strong>
          </div>

          <div className="live-stat" title="Median risk across all states">
            <span className="live-stat-label">Med risk</span>
            <strong className="live-stat-value">{medianRisk}%</strong>
          </div>

          <div
            className={`live-stat ${elevatedRiskCount > 0 ? 'live-stat-risk' : ''}`}
            title="States with risk ≥ 55 in the current snapshot"
          >
            <span className="live-stat-label">Elevated</span>
            <strong className="live-stat-value">{elevatedRiskCount}</strong>
          </div>

          <div
            className="live-stat"
            title={`Mean fresh source coverage ${meanCoverage}% · live WB series ${liveCovLabel}`}
          >
            <span className="live-stat-label">Data</span>
            <strong className="live-stat-value">
              {meanCoverage}
              <span className="live-stat-suffix">%</span>
            </strong>
          </div>

          <div
            className="live-stat live-stat-clock"
            title={liveFetchedAt ? `Last live fetch ${formatHudAge(liveFetchedAt)}` : 'Live fetch pending'}
          >
            <span className="live-stat-label">Synced</span>
            <strong className="live-stat-value">{formatHudClock(liveFetchedAt)}</strong>
          </div>
        </div>
      </div>

      <div className="topbar-section topbar-right">
        <div className="topbar-actions">
          <IconButton
            label={shareStatus === 'done' ? 'Share link copied' : shareStatus === 'failed' ? 'Share failed' : 'Copy share link'}
            onClick={handleShare}
          >
            <SvgIcon.Share />
          </IconButton>
          <IconButton label="Toggle drawers panel (\)" active={drawerOpen} onClick={onToggleDrawer}>
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
