import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import {
  allianceNetworks,
  countryProfiles,
  datasetVersion,
  ingestTelemetry,
  informationQualityTelemetry,
  methodologyNotes,
  scenarioTimeline,
} from './data/countryData';
import {
  defaultScenarioInputs,
  getRiskTier,
  getActiveEventsForProfile,
  getScenarioInputsForProfile,
  getSimulationWeightSet,
  simulateCountry,
  simulationWeightSets,
} from './simulation';
import type {
  Alignment,
  Filters,
  MapFillMode,
  OverlayMode,
  SavedScenario,
  ScenarioInputs,
  SimulatedCountry,
  WeightSetKey,
} from './types';
import { fetchLiveData } from './data/worldBankClient';
import { enrichProfiles } from './data/liveEnrichment';
import { eventLibrary, eventById } from './data/eventLibrary';
import {
  downloadScenariosFile,
  loadPersistedState,
  parseScenariosFile,
  savePersistedState,
} from './lib/persistence';
import {
  buildShareableUrl,
  clearHash,
  decodeStateFromHash,
} from './lib/urlState';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { RightInspector } from './components/RightInspector';
import type { InspectorTab, SparklineSeries } from './components/RightInspector';
import { BottomDrawer } from './components/BottomDrawer';
import type { DrawerTab, EventFeedItem } from './components/BottomDrawer';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { UndoToast } from './components/UndoToast';
import { WelcomeGuide } from './components/WelcomeGuide';

// Lazy-load MapCanvas so the world-atlas TopoJSON ships in its own async chunk.
const MapCanvas = lazy(() => import('./components/MapCanvas').then((m) => ({ default: m.MapCanvas })));

const defaultFilters: Filters = {
  allianceNetwork: 'all',
  tradeExposure: 'all',
  militaryTreatyLevel: 'all',
  conflictPressure: 'all',
  sanctionsExposure: 'all',
  regimeType: 'all',
  riskLevel: 'all',
};

const baselineWeightSet = getSimulationWeightSet('baseline');
const weightSetOptions = Object.values(simulationWeightSets);
const TIMELINE_AUTO_PLAY_INTERVAL_MS = 1200;
const MIN_DRAWER_HEIGHT = 180;
const MAX_DRAWER_HEIGHT_RATIO = 0.65;
const WELCOME_DISMISSED_KEY = 'realpolitik:welcome-dismissed';
const INTERACTIVE_SHORTCUT_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);
const INTERACTIVE_SHORTCUT_ROLES = new Set(['button', 'textbox', 'link']);

const maxDrawerHeight = () => Math.floor(window.innerHeight * MAX_DRAWER_HEIGHT_RATIO);

const isInteractiveShortcutTarget = (target: EventTarget | null): target is HTMLElement => {
  if (!(target instanceof HTMLElement)) return false;
  if (INTERACTIVE_SHORTCUT_TAGS.has(target.tagName)) return true;
  const role = target.getAttribute('role');
  if (role && INTERACTIVE_SHORTCUT_ROLES.has(role)) return true;
  return target.isContentEditable;
};

/** Ordered list of all `ScenarioInputs` keys — single source of truth for iteration. */
export const scenarioInputKeys: (keyof ScenarioInputs)[] = [
  'sanctionShock',
  'treatyShift',
  'electionVolatility',
  'invasionPressure',
  'coupRisk',
];

const alignmentLabel: Record<Alignment, string> = {
  blocA: 'Bloc A',
  blocB: 'Bloc B',
  nonAligned: 'Non-aligned',
  unstable: 'Contested',
};

const alignmentColor: Record<Alignment, string> = {
  blocA: '#5ea3ff',
  blocB: '#ff6b6b',
  nonAligned: '#ffd166',
  unstable: '#c77dff',
};

const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${value}%`;
const resolveEventIds = (eventIds: string[]) =>
  eventIds.flatMap((id) => {
    const event = eventById.get(id);
    return event ? [event] : [];
  });

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 1080;
const isWelcomeDismissed = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(WELCOME_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

const markWelcomeDismissed = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
  } catch {
    // ignore
  }
};

const persisted = loadPersistedState();
// URL hash beats persistence so shared links always reflect the link payload.
const fromHash = decodeStateFromHash();
if (fromHash) clearHash();

export default function App() {
  const [timelineIndex, setTimelineIndex] = useState(
    fromHash?.timelineIndex ?? persisted?.timelineIndex ?? 0,
  );
  const [filters, setFilters] = useState<Filters>(persisted?.filters ?? defaultFilters);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>(
    fromHash?.selectedCountry ?? persisted?.selectedCountry ?? 'United States of America',
  );
  const [overlayMode, setOverlayMode] = useState<OverlayMode>(persisted?.overlayMode ?? 'cooperation');
  const [mapFillMode, setMapFillMode] = useState<MapFillMode>(persisted?.mapFillMode ?? 'alignment');
  const [scenarioName, setScenarioName] = useState(
    fromHash?.scenarioName ?? persisted?.scenarioName ?? 'Baseline+',
  );
  const [scenarioInputs, setScenarioInputs] = useState<ScenarioInputs>(
    fromHash?.scenarioInputs ?? persisted?.scenarioInputs ?? { ...defaultScenarioInputs },
  );
  const [weightSetKey, setWeightSetKey] = useState<WeightSetKey>(
    fromHash?.weightSetKey ?? persisted?.weightSetKey ?? 'baseline',
  );
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(persisted?.savedScenarios ?? []);
  const [activeEventIds, setActiveEventIds] = useState<string[]>(
    fromHash?.activeEventIds ?? persisted?.activeEventIds ?? [],
  );
  const [comparisonScenarioId, setComparisonScenarioId] = useState<string | null>(
    persisted?.comparisonScenarioId ?? null,
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() => !isWelcomeDismissed());
  const [importError, setImportError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [pendingDelete, setPendingDelete] = useState<SavedScenario | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shareResetRef = useRef<number | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);
  const persistDebounceRef = useRef<number | null>(null);

  // Live World Bank data enrichment — starts with static profiles and upgrades
  // in the background. Failures fall back silently to the static dataset.
  const [activeProfiles, setActiveProfiles] = useState(countryProfiles);
  const [liveDataStatus, setLiveDataStatus] = useState<'loading' | 'live' | 'error'>('loading');
  const liveFetchRef = useRef<AbortController | null>(null);

  const loadLiveData = useCallback(() => {
    liveFetchRef.current?.abort();
    const controller = new AbortController();
    liveFetchRef.current = controller;
    setLiveDataStatus('loading');
    fetchLiveData(controller.signal)
      .then((live) => {
        // countryProfiles is a stable module-level constant — no dep needed.
        setActiveProfiles(enrichProfiles(countryProfiles, live));
        setLiveDataStatus('live');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLiveDataStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLiveData();
    return () => liveFetchRef.current?.abort();
  }, [loadLiveData]);

  // Defer heavy simulation re-runs so UI (sliders, timeline) stays responsive while
  // the map catches up asynchronously via React's concurrent scheduler.
  const deferredScenarioInputs = useDeferredValue(scenarioInputs);
  const deferredWeightSetKey = useDeferredValue(weightSetKey);
  const deferredActiveEventIds = useDeferredValue(activeEventIds);

  // Merge manual slider values with the accumulated deltas from active events.
  const activeEvents = useMemo(() => resolveEventIds(deferredActiveEventIds), [deferredActiveEventIds]);

  const [leftOpen, setLeftOpen] = useState<boolean>(() => !isMobile());
  const [rightOpen, setRightOpen] = useState<boolean>(() => !isMobile());
  const [drawerOpen, setDrawerOpen] = useState<boolean>(persisted?.drawerOpen ?? false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(persisted?.drawerTab ?? 'scenario');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>(persisted?.inspectorTab ?? 'overview');

  // Resizable bottom drawer — height is applied as a CSS custom property on the shell.
  const [drawerHeight, setDrawerHeight] = useState(persisted?.drawerHeight ?? 320);

  // Timeline auto-play — steps through scenario years at a fixed interval.
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const lastIndex = scenarioTimeline.length - 1;
    const id = setInterval(() => {
      setTimelineIndex((current) => {
        if (current >= lastIndex) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, TIMELINE_AUTO_PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, scenarioTimeline.length]);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => {
      if (!prev && timelineIndex >= scenarioTimeline.length - 1) {
        // Restart from the beginning when pressing play at the last year.
        setTimelineIndex(0);
      }
      return !prev;
    });
  };

  // Dragging the top edge of the bottom drawer resizes it.
  const handleDrawerResizeStart = (startClientY: number) => {
    const startH = drawerHeight;
    const onMove = (event: MouseEvent) => {
      const delta = startClientY - event.clientY;
      setDrawerHeight(Math.max(MIN_DRAWER_HEIGHT, Math.min(maxDrawerHeight(), startH + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleDrawerResizeStep = (delta: number) => {
    setDrawerHeight((h) => Math.max(MIN_DRAWER_HEIGHT, Math.min(maxDrawerHeight(), h + delta)));
  };

  const handleDrawerResizeTo = (edge: 'min' | 'max') => {
    setDrawerHeight(edge === 'min' ? MIN_DRAWER_HEIGHT : maxDrawerHeight());
  };

  // Keep a ref so the keydown handler always closes over the latest toggle function
  // without needing to be re-registered on every render.
  const handleTogglePlayRef = useRef(handleTogglePlay);
  handleTogglePlayRef.current = handleTogglePlay;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isInteractiveShortcutTarget(event.target)) {
        return;
      }
      if (event.key === '[') setLeftOpen((value) => !value);
      if (event.key === ']') setRightOpen((value) => !value);
      if (event.key === '\\') setDrawerOpen((value) => !value);
      if (event.key === ' ') {
        event.preventDefault();
        handleTogglePlayRef.current();
      }
      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (event.key === '?') {
        event.preventDefault();
        setHelpOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeWeightSet = useMemo(() => getSimulationWeightSet(deferredWeightSetKey), [deferredWeightSetKey]);

  const baselineSimulated = useMemo(() => {
    return activeProfiles.map((profile) =>
      simulateCountry(profile, timelineIndex, {
        scenarioInputs: defaultScenarioInputs,
        weightSet: baselineWeightSet,
      }),
    );
  }, [activeProfiles, timelineIndex]);

  const simulated = useMemo(() => {
    return activeProfiles.map((profile) =>
      simulateCountry(profile, timelineIndex, {
        scenarioInputs: deferredScenarioInputs,
        activeEvents,
        weightSet: activeWeightSet,
      }),
    );
  }, [activeEvents, activeProfiles, activeWeightSet, deferredScenarioInputs, timelineIndex]);

  const baselineByName = useMemo(
    () => new Map(baselineSimulated.map((entry) => [entry.profile.mapName, entry])),
    [baselineSimulated],
  );

  const byName = useMemo(
    () => new Map(simulated.map((entry) => [entry.profile.mapName, entry])),
    [simulated],
  );

  const filtered = useMemo(() => {
    return simulated.filter((entry) => {
      const riskTier = getRiskTier(entry.risk);
      return (
        (filters.allianceNetwork === 'all' || entry.profile.allianceNetwork === filters.allianceNetwork) &&
        (filters.tradeExposure === 'all' || entry.profile.indicators.tradeExposure === filters.tradeExposure) &&
        (filters.militaryTreatyLevel === 'all' ||
          entry.profile.indicators.militaryTreatyLevel === filters.militaryTreatyLevel) &&
        (filters.conflictPressure === 'all' ||
          entry.profile.indicators.conflictPressure === filters.conflictPressure) &&
        (filters.sanctionsExposure === 'all' ||
          entry.profile.indicators.sanctionsExposure === filters.sanctionsExposure) &&
        (filters.regimeType === 'all' || entry.profile.regimeType === filters.regimeType) &&
        (filters.riskLevel === 'all' || riskTier === filters.riskLevel)
      );
    });
  }, [filters, simulated]);

  const visibleNames = useMemo(
    () => new Set(filtered.map((entry) => entry.profile.mapName)),
    [filtered],
  );

  const railCountries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return filtered;
    return filtered.filter((entry) => {
      const profile = entry.profile;
      return (
        profile.displayName.toLowerCase().includes(query) ||
        profile.region.toLowerCase().includes(query) ||
        profile.subregion.toLowerCase().includes(query) ||
        profile.mapName.toLowerCase().includes(query)
      );
    });
  }, [filtered, search]);

  const selected = byName.get(selectedCountry) ?? simulated[0];
  const baselineSelected = baselineByName.get(selectedCountry) ?? baselineSimulated[0];
  const selectedRiskDelta = Math.round(selected.risk - baselineSelected.risk);
  const selectedConfidenceDelta = Math.round(selected.confidence - baselineSelected.confidence);

  // Re-simulate the selected country with explanation enabled for the inspector panels.
  // This is a single country (cheap) and the only call that actually needs ContributionLine arrays.
  const selectedWithExplanation = useMemo(
    () =>
      simulateCountry(selected.profile, timelineIndex, {
        scenarioInputs: deferredScenarioInputs,
        activeEvents,
        weightSet: activeWeightSet,
        includeHistory: false,
        includeExplanation: true,
      }),
    [activeEvents, activeWeightSet, deferredScenarioInputs, selected.profile, timelineIndex],
  );
  const selectedActiveEvents = useMemo(
    () => getActiveEventsForProfile(selected.profile, activeEvents),
    [activeEvents, selected.profile],
  );
  const selectedScenarioInputs = useMemo(
    () => getScenarioInputsForProfile(deferredScenarioInputs, activeEvents, selected.profile),
    [activeEvents, deferredScenarioInputs, selected.profile],
  );

  const eventFeed = useMemo<EventFeedItem[]>(() => {
    return filtered
      .slice()
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 5)
      .map((entry) => {
        // Find the highest-tension partner rather than using the first relationship.
        const topPressure = entry.profile.relationships.reduce<
          typeof entry.profile.relationships[number] | null
        >(
          (best, rel) => (!best || rel.tension > best.tension ? rel : best),
          null,
        );
        const baselineEntry = baselineByName.get(entry.profile.mapName);
        const riskDelta = baselineEntry ? Math.round(entry.risk - baselineEntry.risk) : 0;
        const tone = getRiskTier(entry.risk);
        return {
          title: `${scenarioTimeline[timelineIndex]} · ${entry.profile.displayName}`,
          detail: `${alignmentLabel[entry.alignment]} at ${entry.confidence}% confidence and ${entry.risk}% modeled escalation risk (${formatSignedPercent(
            riskDelta,
          )} vs baseline)${topPressure ? `. Top pressure: ${topPressure.displayName}.` : '.'}`,
          tone,
        };
      });
  }, [baselineByName, filtered, timelineIndex]);

  // Optional comparison track.
  const comparisonScenario = useMemo(
    () => savedScenarios.find((scenario) => scenario.id === comparisonScenarioId) ?? null,
    [comparisonScenarioId, savedScenarios],
  );

  // Cheap single-country comparison for the inspector — avoids simulating all 134 countries
  // just to display the selected country's delta in the inspector panels.
  const comparisonSelected = useMemo<SimulatedCountry | null>(() => {
    if (!comparisonScenario) return null;
    const profile = byName.get(selectedCountry)?.profile;
    if (!profile) return null;
    const comparisonEvents = resolveEventIds(comparisonScenario.activeEventIds ?? []);
    const compWeights = getSimulationWeightSet(comparisonScenario.weightSetKey);
    return simulateCountry(profile, comparisonScenario.timelineIndex, {
      scenarioInputs: comparisonScenario.inputs,
      activeEvents: comparisonEvents,
      weightSet: compWeights,
    });
  }, [byName, comparisonScenario, selectedCountry]);

  // Full comparison map — only built when the movers tab is visible and a comparison
  // scenario is active. Simulating all 134 countries is deferred until actually needed.
  const comparisonSimulated = useMemo<SimulatedCountry[]>(() => {
    if (!comparisonScenario || drawerTab !== 'movers') return [];
    const comparisonEvents = resolveEventIds(comparisonScenario.activeEventIds ?? []);
    const compWeights = getSimulationWeightSet(comparisonScenario.weightSetKey);
    return activeProfiles.map((profile) =>
      simulateCountry(profile, comparisonScenario.timelineIndex, {
        scenarioInputs: comparisonScenario.inputs,
        activeEvents: comparisonEvents,
        weightSet: compWeights,
      }),
    );
  }, [activeProfiles, comparisonScenario, drawerTab]);

  const comparisonByName = useMemo(() => {
    if (comparisonSimulated.length === 0) return null;
    return new Map(comparisonSimulated.map((entry) => [entry.profile.mapName, entry]));
  }, [comparisonSimulated]);

  // Inspector sparkline — baseline profile resolved from the already-built byName
  // map (O(1)) instead of a linear scan over activeProfiles.
  const sparklineProfile = useMemo(
    () => byName.get(selectedCountry)?.profile ?? null,
    [byName, selectedCountry],
  );

  const sparklineBaselineRisks = useMemo<number[]>(() => {
    if (!sparklineProfile) return [];
    return scenarioTimeline.map((_, index) =>
      Math.round(
        simulateCountry(sparklineProfile, index, {
          scenarioInputs: defaultScenarioInputs,
          weightSet: baselineWeightSet,
          includeHistory: false,
        }).risk,
      ),
    );
  }, [sparklineProfile]);

  const sparklineActiveRisks = useMemo<number[]>(() => {
    if (!sparklineProfile) return [];
    return scenarioTimeline.map((_, index) =>
      Math.round(
        simulateCountry(sparklineProfile, index, {
          scenarioInputs: deferredScenarioInputs,
          activeEvents,
          weightSet: activeWeightSet,
          includeHistory: false,
        }).risk,
      ),
    );
  }, [activeEvents, activeWeightSet, deferredScenarioInputs, sparklineProfile]);

  const selectedSparkline = useMemo<SparklineSeries | null>(() => {
    if (!sparklineProfile) return null;
    return {
      labels: scenarioTimeline.slice(),
      active: sparklineActiveRisks,
      baseline: sparklineBaselineRisks,
      currentIndex: timelineIndex,
    };
  }, [sparklineActiveRisks, sparklineBaselineRisks, sparklineProfile, timelineIndex]);

  const handleScenarioInputChange = <K extends keyof ScenarioInputs>(key: K, value: number) => {
    setScenarioInputs((current) => ({ ...current, [key]: value }));
  };

  const applyEvent = (id: string) => {
    setActiveEventIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const removeEvent = (id: string) => {
    setActiveEventIds((current) => current.filter((activeId) => activeId !== id));
  };

  const resetScenario = () => {
    setScenarioName('Baseline+');
    setScenarioInputs({ ...defaultScenarioInputs });
    setWeightSetKey('baseline');
    setActiveEventIds([]);
  };

  const saveScenario = () => {
    const name = scenarioName.trim() || `Scenario ${savedScenarios.length + 1}`;
    setSavedScenarios((current) =>
      [
        {
          id: `${Date.now()}`,
          name,
          timelineIndex,
          weightSetKey,
          inputs: { ...scenarioInputs },
          activeEventIds: [...activeEventIds],
          savedAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 12),
    );
  };

  const loadScenario = (scenario: SavedScenario) => {
    setScenarioName(scenario.name);
    setScenarioInputs({ ...scenario.inputs });
    setWeightSetKey(scenario.weightSetKey);
    setTimelineIndex(scenario.timelineIndex);
    setActiveEventIds(scenario.activeEventIds ?? []);
  };

  const deleteScenario = (id: string) => {
    setSavedScenarios((current) => {
      const target = current.find((scenario) => scenario.id === id);
      if (target) {
        if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current);
        // The undo toast itself dismisses after 6s and clears pendingDelete.
        setPendingDelete(target);
      }
      return current.filter((scenario) => scenario.id !== id);
    });
    setComparisonScenarioId((current) => (current === id ? null : current));
  };

  const restoreDeleted = useCallback(() => {
    setPendingDelete((current) => {
      if (!current) return null;
      setSavedScenarios((scenarios) =>
        scenarios.some((scenario) => scenario.id === current.id)
          ? scenarios
          : [current, ...scenarios].slice(0, 24),
      );
      return null;
    });
  }, []);

  const dismissPendingDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const renameScenario = (id: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    setSavedScenarios((current) =>
      current.map((scenario) => (scenario.id === id ? { ...scenario, name: trimmed } : scenario)),
    );
  };

  const exportScenarios = (id?: string) => {
    const target = id
      ? savedScenarios.filter((scenario) => scenario.id === id)
      : savedScenarios;
    if (target.length === 0) return;
    const filename = id
      ? `realpolitik-scenario-${target[0].name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'scenario'}.json`
      : undefined;
    downloadScenariosFile(target, datasetVersion, filename);
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const incoming = await parseScenariosFile(file);
      setSavedScenarios((current) => {
        const existingIds = new Set(current.map((scenario) => scenario.id));
        const reidentified = incoming.map((scenario) =>
          existingIds.has(scenario.id)
            ? { ...scenario, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
            : scenario,
        );
        return [...reidentified, ...current].slice(0, 24);
      });
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read file');
    }
  };

  const toggleComparison = (id: string) => {
    setComparisonScenarioId((current) => (current === id ? null : id));
  };

  const clearComparison = () => setComparisonScenarioId(null);

  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false);
    markWelcomeDismissed();
  }, []);

  const handleWelcomeFocusSearch = useCallback(() => {
    setLeftOpen(true);
    closeWelcome();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [closeWelcome]);

  const handleWelcomeOpenScenario = useCallback(() => {
    setDrawerOpen(true);
    setDrawerTab('scenario');
    closeWelcome();
  }, [closeWelcome]);

  const handleWelcomeOpenShortcuts = useCallback(() => {
    setHelpOpen(true);
    closeWelcome();
  }, [closeWelcome]);

  const shareCurrentScenario = useCallback(async () => {
    const url = buildShareableUrl({
      scenarioName,
      scenarioInputs,
      weightSetKey,
      activeEventIds,
      timelineIndex,
      selectedCountry,
    });
    if (shareResetRef.current) window.clearTimeout(shareResetRef.current);
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('copied');
    } catch {
      setShareStatus('error');
    }
    shareResetRef.current = window.setTimeout(() => setShareStatus('idle'), 1800);
  }, [activeEventIds, scenarioInputs, scenarioName, selectedCountry, timelineIndex, weightSetKey]);

  const handleSelectCountryFromMovers = useCallback(
    (mapName: string) => {
      if (byName.has(mapName)) setSelectedCountry(mapName);
    },
    [byName],
  );

  const handleSelectFromInspector = (mapName: string) => {
    if (byName.has(mapName)) setSelectedCountry(mapName);
  };

  /** Selecting a country from the map also ensures the right panel is open and shows the overview. */
  const handleSelectFromMap = useCallback(
    (mapName: string) => {
      setSelectedCountry(mapName);
      setRightOpen(true);
      setInspectorTab('overview');
    },
    [],
  );

  const totalCountries = activeProfiles.length;
  const shellStyle = { '--drawer-h': `${drawerHeight}px` } as CSSProperties;
  const handleTimelineChange = (index: number) => {
    setIsPlaying(false);
    setTimelineIndex(index);
  };

  // Persist UI + scenarios to localStorage with a 300 ms debounce so rapid
  // slider drags or typing do not hammer the storage layer on every frame.
  useEffect(() => {
    const snapshot = {
      selectedCountry,
      scenarioName,
      scenarioInputs,
      weightSetKey,
      activeEventIds,
      savedScenarios,
      filters,
      timelineIndex,
      overlayMode,
      mapFillMode,
      inspectorTab,
      drawerTab,
      drawerOpen,
      drawerHeight,
      comparisonScenarioId,
    };
    if (persistDebounceRef.current) window.clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = window.setTimeout(() => savePersistedState(snapshot), 300);
  }, [
    selectedCountry,
    scenarioName,
    scenarioInputs,
    weightSetKey,
    activeEventIds,
    savedScenarios,
    filters,
    timelineIndex,
    overlayMode,
    mapFillMode,
    inspectorTab,
    drawerTab,
    drawerOpen,
    drawerHeight,
    comparisonScenarioId,
  ]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (shareResetRef.current) window.clearTimeout(shareResetRef.current);
      if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current);
      if (persistDebounceRef.current) window.clearTimeout(persistDebounceRef.current);
    };
  }, []);

  return (
    <div
      className="shell"
      data-left-open={leftOpen}
      data-right-open={rightOpen}
      data-drawer-open={drawerOpen}
      style={shellStyle}
    >
      <TopBar
        timelineIndex={timelineIndex}
        timeline={scenarioTimeline}
        onTimelineChange={handleTimelineChange}
        scenarioName={scenarioName}
        datasetVersion={datasetVersion}
        countryCount={totalCountries}
        liveDataStatus={liveDataStatus}
        onRetryLiveData={loadLiveData}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        drawerOpen={drawerOpen}
        helpOpen={helpOpen}
        onToggleLeft={() => setLeftOpen((value) => !value)}
        onToggleRight={() => setRightOpen((value) => !value)}
        onToggleDrawer={() => setDrawerOpen((value) => !value)}
        onToggleHelp={() => setHelpOpen((value) => !value)}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        activeEventCount={activeEventIds.length}
      />

      <LeftRail
        open={leftOpen}
        search={search}
        onSearchChange={setSearch}
        countries={railCountries}
        totalCount={totalCountries}
        selectedName={selectedCountry}
        onSelect={setSelectedCountry}
        filters={filters}
        onFiltersChange={setFilters}
        onClearSearch={() => setSearch('')}
        onResetFilters={() => setFilters(defaultFilters)}
        alliances={allianceNetworks}
        alignmentColor={alignmentColor}
        alignmentLabel={alignmentLabel}
        searchInputRef={searchInputRef}
      />

      <Suspense fallback={<div className="map map-fallback" aria-busy>Loading map…</div>}>
        <MapCanvas
          byName={byName}
          baselineByName={baselineByName}
          visibleNames={visibleNames}
          selectedName={selectedCountry}
          onSelect={handleSelectFromMap}
          overlayMode={overlayMode}
          onOverlayModeChange={setOverlayMode}
          fillMode={mapFillMode}
          onFillModeChange={setMapFillMode}
          alignmentColor={alignmentColor}
          alignmentLabel={alignmentLabel}
        />
      </Suspense>

      <RightInspector
        open={rightOpen}
        selected={selectedWithExplanation}
        baselineSelected={baselineSelected}
        riskDelta={selectedRiskDelta}
        confidenceDelta={selectedConfidenceDelta}
        scenarioName={scenarioName}
        scenarioInputs={selectedScenarioInputs}
        activeWeightSet={activeWeightSet}
        activeEventNames={selectedActiveEvents.map((event) => event.name)}
        alignmentColor={alignmentColor}
        alignmentLabel={alignmentLabel}
        tab={inspectorTab}
        onTabChange={setInspectorTab}
        onSelectRelated={handleSelectFromInspector}
        comparisonSelected={comparisonSelected}
        comparisonScenarioName={comparisonScenario?.name ?? null}
        onClearComparison={clearComparison}
        sparkline={selectedSparkline}
      />

      <BottomDrawer
        open={drawerOpen}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
        scenarioName={scenarioName}
        onScenarioNameChange={setScenarioName}
        scenarioInputs={scenarioInputs}
        onScenarioInputChange={handleScenarioInputChange}
        activeWeightSet={activeWeightSet}
        weightSetKey={weightSetKey}
        onWeightSetChange={setWeightSetKey}
        weightSets={weightSetOptions}
        savedScenarios={savedScenarios}
        onSaveScenario={saveScenario}
        onResetScenario={resetScenario}
        onShareScenario={shareCurrentScenario}
        shareStatus={shareStatus}
        onLoadScenario={loadScenario}
        onDeleteScenario={deleteScenario}
        onRenameScenario={renameScenario}
        onExportScenarios={exportScenarios}
        onImportScenarios={handleImportClick}
        importError={importError}
        comparisonScenarioId={comparisonScenarioId}
        onToggleComparison={toggleComparison}
        eventFeed={eventFeed}
        methodologyNotes={methodologyNotes}
        informationQuality={informationQualityTelemetry}
        ingestTelemetry={ingestTelemetry}
        scenarioTimeline={scenarioTimeline}
        events={eventLibrary}
        activeEventIds={activeEventIds}
        onApplyEvent={applyEvent}
        onRemoveEvent={removeEvent}
        onResizeStart={handleDrawerResizeStart}
        onResizeStep={handleDrawerResizeStep}
        onResizeTo={handleDrawerResizeTo}
        movers={{
          active: simulated,
          baselineByName,
          comparisonByName,
          comparisonScenarioName: comparisonScenario?.name ?? null,
          onSelectCountry: handleSelectCountryFromMovers,
          alignmentColor,
          alignmentLabel,
        }}
        indexCountries={railCountries}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleImportChange}
      />

      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <WelcomeGuide
        open={welcomeOpen}
        onClose={closeWelcome}
        onFocusSearch={handleWelcomeFocusSearch}
        onOpenScenarioLab={handleWelcomeOpenScenario}
        onOpenShortcuts={handleWelcomeOpenShortcuts}
      />

      {pendingDelete && (
        <UndoToast
          message={`Deleted “${pendingDelete.name}”`}
          durationMs={6000}
          onUndo={restoreDeleted}
          onDismiss={dismissPendingDelete}
        />
      )}
    </div>
  );
}
