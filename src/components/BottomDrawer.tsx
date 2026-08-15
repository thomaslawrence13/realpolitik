import { memo } from 'react';
import type {
  CountryAssessment,
  CountryProfile,
  EnhancementReleaseTelemetry,
  IngestTelemetry,
  InformationQualityContract,
  InformationQualityTelemetry,
} from '../types';
import { SvgIcon, Tabs } from './ui';
import { MoversPanel } from './MoversPanel';
import type { DrawerTab } from './drawer/types';
import { IndexPanel } from './drawer/IndexPanel';
import { MethodologyPanel } from './drawer/MethodologyPanel';
import type { LiveDataStatus } from './TopBar';

export type { DrawerTab };

type Props = {
  open: boolean;
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  methodologyNotes: string[];
  informationQuality: InformationQualityTelemetry;
  baselineInformationQuality: InformationQualityTelemetry;
  informationQualityContract: InformationQualityContract;
  ingestTelemetry: IngestTelemetry;
  enhancementReleaseTelemetry: EnhancementReleaseTelemetry;
  liveDataDiagnostics: {
    totalIndicators: number;
    succeededIndicators: number;
    failedIndicators: number;
    failedCodes: string[];
    latestObservedYear?: string | null;
    source?: 'backend' | 'direct';
    refreshedAt?: string | null;
  } | null;
  onResizeStart: (startClientY: number) => void;
  onResizeStep: (delta: number) => void;
  onResizeTo: (edge: 'min' | 'max') => void;
  movers: {
    onSelectCountry: (mapName: string) => void;
    staticProfiles?: CountryProfile[];
    liveProfiles?: CountryProfile[];
    liveDataStatus?: LiveDataStatus;
  };
  indexCountries: CountryAssessment[];
};

export const BottomDrawer = memo(function BottomDrawer({
  open,
  tab,
  onTabChange,
  onClose,
  methodologyNotes,
  informationQuality,
  baselineInformationQuality,
  informationQualityContract,
  ingestTelemetry,
  enhancementReleaseTelemetry,
  liveDataDiagnostics,
  onResizeStart,
  onResizeStep,
  onResizeTo,
  movers,
  indexCountries,
}: Props) {
  return (
    <section
      className={`drawer ${open ? 'drawer-open' : 'drawer-closed'}`}
      aria-hidden={!open}
      {...(!open && { inert: true })}
    >
      {/* Drag handle — lets the user resize the drawer by dragging its top edge.
          Keyboard: ↑ expands, ↓ shrinks (20 px per step). */}
      <div
        className="drawer-resize-handle"
        role="separator"
        aria-label="Resize panel"
        aria-orientation="horizontal"
        tabIndex={0}
        onMouseDown={(e) => { e.preventDefault(); onResizeStart(e.clientY); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); onResizeStep(20); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onResizeStep(-20); }
          if (e.key === 'Home') { e.preventDefault(); onResizeTo('min'); }
          if (e.key === 'End') { e.preventDefault(); onResizeTo('max'); }
        }}
      />
      <header className="drawer-header">
        <Tabs<DrawerTab>
          value={tab}
          onChange={onTabChange}
          options={[
            { value: 'index', label: 'Index' },
            { value: 'movers', label: 'Movers' },
            { value: 'methodology', label: 'Methodology' },
          ]}
        />
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close drawer">
          <SvgIcon.X />
        </button>
      </header>

      <div className="drawer-body">
        {tab === 'movers' && (
          <MoversPanel
            onSelectCountry={movers.onSelectCountry}
            staticProfiles={movers.staticProfiles}
            liveProfiles={movers.liveProfiles}
            liveDataStatus={movers.liveDataStatus}
          />
        )}

        {tab === 'index' && <IndexPanel countries={indexCountries} onSelectCountry={movers.onSelectCountry} />}

        {tab === 'methodology' && (
          <MethodologyPanel
            notes={methodologyNotes}
            informationQuality={informationQuality}
            baselineInformationQuality={baselineInformationQuality}
            informationQualityContract={informationQualityContract}
            ingestTelemetry={ingestTelemetry}
            enhancementReleaseTelemetry={enhancementReleaseTelemetry}
            liveDataDiagnostics={liveDataDiagnostics}
          />
        )}
      </div>
    </section>
  );
});
