import { memo } from 'react';
import type {
  Alignment,
  EnhancementReleaseTelemetry,
  EventTemplate,
  IngestTelemetry,
  InformationQualityContract,
  InformationQualityTelemetry,
  SavedScenario,
  ScenarioInputs,
  SimulatedCountry,
  SimulationWeightSet,
  WeightSetKey,
} from '../types';
import { SvgIcon, Tabs } from './ui';
import { MoversPanel } from './MoversPanel';
import type { DrawerTab, EventFeedItem } from './drawer/types';
import { ScenarioPanel } from './drawer/ScenarioPanel';
import { EventsPanel } from './drawer/EventsPanel';
import { IndexPanel } from './drawer/IndexPanel';
import { HistoryPanel } from './drawer/HistoryPanel';
import { MethodologyPanel } from './drawer/MethodologyPanel';

export type { DrawerTab, EventFeedItem };

type Props = {
  open: boolean;
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  scenarioName: string;
  onScenarioNameChange: (value: string) => void;
  scenarioInputs: ScenarioInputs;
  onScenarioInputChange: <K extends keyof ScenarioInputs>(key: K, value: number) => void;
  activeWeightSet: SimulationWeightSet;
  weightSetKey: WeightSetKey;
  onWeightSetChange: (key: WeightSetKey) => void;
  weightSets: SimulationWeightSet[];
  savedScenarios: SavedScenario[];
  onSaveScenario: () => void;
  onResetScenario: () => void;
  onShareScenario: () => void;
  shareStatus: 'idle' | 'copied' | 'error';
  onLoadScenario: (scenario: SavedScenario) => void;
  onDeleteScenario: (id: string) => void;
  onRenameScenario: (id: string, nextName: string) => void;
  onExportScenarios: (id?: string) => void;
  onImportScenarios: () => void;
  importError: string | null;
  comparisonScenarioId: string | null;
  onToggleComparison: (id: string) => void;
  eventFeed: EventFeedItem[];
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
  } | null;
  scenarioTimeline: string[];
  events: EventTemplate[];
  activeEventIds: string[];
  onApplyEvent: (id: string) => void;
  onRemoveEvent: (id: string) => void;
  onApplyEvents: (ids: string[]) => void;
  onClearAllEvents: () => void;
  onResizeStart: (startClientY: number) => void;
  onResizeStep: (delta: number) => void;
  onResizeTo: (edge: 'min' | 'max') => void;
  movers: {
    active: SimulatedCountry[];
    baselineByName: Map<string, SimulatedCountry>;
    comparisonByName: Map<string, SimulatedCountry> | null;
    comparisonScenarioName: string | null;
    onSelectCountry: (mapName: string) => void;
    alignmentColor: Record<Alignment, string>;
    alignmentLabel: Record<Alignment, string>;
  };
  indexCountries: SimulatedCountry[];
};

export const BottomDrawer = memo(function BottomDrawer({
  open,
  tab,
  onTabChange,
  onClose,
  scenarioName,
  onScenarioNameChange,
  scenarioInputs,
  onScenarioInputChange,
  activeWeightSet,
  weightSetKey,
  onWeightSetChange,
  weightSets,
  savedScenarios,
  onSaveScenario,
  onResetScenario,
  onShareScenario,
  shareStatus,
  onLoadScenario,
  onDeleteScenario,
  onRenameScenario,
  onExportScenarios,
  onImportScenarios,
  importError,
  comparisonScenarioId,
  onToggleComparison,
  eventFeed,
  methodologyNotes,
  informationQuality,
  baselineInformationQuality,
  informationQualityContract,
  ingestTelemetry,
  enhancementReleaseTelemetry,
  liveDataDiagnostics,
  scenarioTimeline,
  events,
  activeEventIds,
  onApplyEvent,
  onRemoveEvent,
  onApplyEvents,
  onClearAllEvents,
  onResizeStart,
  onResizeStep,
  onResizeTo,
  movers,
  indexCountries,
}: Props) {
  return (
    <section className={`drawer ${open ? 'drawer-open' : 'drawer-closed'}`} aria-hidden={!open}>
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
            { value: 'analysis', label: 'Analysis' },
            { value: 'events', label: 'Events', count: activeEventIds.length > 0 ? activeEventIds.length : undefined },
            { value: 'history', label: 'History', count: savedScenarios.length },
          ]}
        />
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close drawer">
          <SvgIcon.X />
        </button>
      </header>

      <div className="drawer-body">
        {tab === 'analysis' && (
          <ScenarioPanel
            scenarioName={scenarioName}
            onScenarioNameChange={onScenarioNameChange}
            scenarioInputs={scenarioInputs}
            onScenarioInputChange={onScenarioInputChange}
            activeWeightSet={activeWeightSet}
            weightSetKey={weightSetKey}
            onWeightSetChange={onWeightSetChange}
            weightSets={weightSets}
            onSaveScenario={onSaveScenario}
            onResetScenario={onResetScenario}
            onShareScenario={onShareScenario}
            shareStatus={shareStatus}
          />
        )}

        {tab === 'events' && (
          <EventsPanel
            events={events}
            activeEventIds={activeEventIds}
            onApply={onApplyEvent}
            onRemove={onRemoveEvent}
            onApplyMany={onApplyEvents}
            onClearAll={onClearAllEvents}
            scenarioFeed={eventFeed}
          />
        )}

        {tab === 'movers' && (
          <MoversPanel
            active={movers.active}
            baselineByName={movers.baselineByName}
            comparisonByName={movers.comparisonByName}
            comparisonScenarioName={movers.comparisonScenarioName}
            onSelectCountry={movers.onSelectCountry}
            alignmentColor={movers.alignmentColor}
            alignmentLabel={movers.alignmentLabel}
          />
        )}

        {tab === 'index' && <IndexPanel countries={indexCountries} onSelectCountry={movers.onSelectCountry} />}

        {tab === 'history' && (
          <HistoryPanel
            scenarios={savedScenarios}
            timeline={scenarioTimeline}
            weightSets={weightSets}
            onLoad={onLoadScenario}
            onDelete={onDeleteScenario}
            onRename={onRenameScenario}
            onExport={onExportScenarios}
            onImport={onImportScenarios}
            importError={importError}
            comparisonScenarioId={comparisonScenarioId}
            onToggleCompare={onToggleComparison}
          />
        )}

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
