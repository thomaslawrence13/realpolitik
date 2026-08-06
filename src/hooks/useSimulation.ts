import { useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import {
  defaultScenarioInputs,
  getSimulationWeightSet,
  simulateCountry,
} from '../simulation';
import type {
  Alignment,
  CountryProfile,
  ScenarioInputs,
  SimulatedCountry,
  WeightSetKey,
} from '../types';
import type { EventTemplate } from '../types';
import type { SparklineSeries } from '../components/RightInspector';

export function useSimulation(
  activeProfiles: CountryProfile[],
  activeEvents: EventTemplate[],
  deferredScenarioInputs: ScenarioInputs,
  deferredWeightSetKey: WeightSetKey,
  selectedCountry: string,
  timelineIndex: number,
  scenarioTimeline: string[],
  alignmentColor: Record<Alignment, string>,
  alignmentLabel: Record<Alignment, string>,
): {
  simulated: SimulatedCountry[];
  baselineSimulated: SimulatedCountry[];
  selected: SimulatedCountry | null;
  baselineSelected: SimulatedCountry | null;
  selectedRiskDelta: number;
  selectedConfidenceDelta: number;
  sparkline: SparklineSeries | null;
} {
  const simulationSnapshot = useMapStore(
    (state) => state.simulationSnapshot,
  );
  const setSimulationPayload = useMapStore(
    (state) => state.setSimulationPayload,
  );

  const activeWeightSet = useMemo(
    () => getSimulationWeightSet(deferredWeightSetKey),
    [deferredWeightSetKey],
  );

  useMemo(() => {
    setSimulationPayload({
      profiles: activeProfiles,
      scenarioInputs: deferredScenarioInputs,
      activeEvents,
      weightSetKey: deferredWeightSetKey,
    });
  }, [activeEvents, activeProfiles, deferredScenarioInputs, deferredWeightSetKey, setSimulationPayload]);

  const simulated = simulationSnapshot?.simulated ?? [];
  const baselineSimulated = simulationSnapshot?.baselineSimulated ?? [];
  const byName = useMemo(
    () => new Map(simulated.map((entry) => [entry.profile.mapName, entry])),
    [simulated],
  );
  const baselineByName = useMemo(
    () => new Map(baselineSimulated.map((entry) => [entry.profile.mapName, entry])),
    [baselineSimulated],
  );

  const selectedProfile = useMemo(
    () =>
      activeProfiles.find((profile) => profile.mapName === selectedCountry) ??
      activeProfiles[0] ??
      null,
    [activeProfiles, selectedCountry],
  );

  const selected = useMemo<SimulatedCountry | null>(() => {
    const snapshotSelected = byName.get(selectedCountry) ?? null;
    if (snapshotSelected) return snapshotSelected;
    if (!selectedProfile) return null;
    return simulateCountry(selectedProfile, timelineIndex, {
      scenarioInputs: deferredScenarioInputs,
      activeEvents,
      weightSet: activeWeightSet,
      includeExplanation: true,
    });
  }, [
    activeEvents,
    activeWeightSet,
    byName,
    deferredScenarioInputs,
    selectedCountry,
    selectedProfile,
    simulated,
    timelineIndex,
  ]);

  const baselineSelected = useMemo<SimulatedCountry | null>(() => {
    const snapshotSelected = baselineByName.get(selectedCountry) ?? null;
    if (snapshotSelected) return snapshotSelected;
    if (!selectedProfile) return null;
    return simulateCountry(selectedProfile, timelineIndex, {
      scenarioInputs: defaultScenarioInputs,
      weightSet: getSimulationWeightSet('baseline'),
      includeExplanation: false,
    });
  }, [
    baselineByName,
    baselineSimulated,
    selectedCountry,
    selectedProfile,
    timelineIndex,
  ]);

  const selectedRiskDelta =
    selected && baselineSelected
      ? Math.round(selected.risk - baselineSelected.risk)
      : 0;
  const selectedConfidenceDelta =
    selected && baselineSelected
      ? Math.round(selected.confidence - baselineSelected.confidence)
      : 0;

  const sparklineProfile = useMemo(
    () => selectedProfile,
    [selectedProfile],
  );

  const sparklineBaselineRisks = useMemo<number[]>(() => {
    if (!sparklineProfile) return [];
    return scenarioTimeline.map((_, index) =>
      Math.round(
        simulateCountry(sparklineProfile, index, {
          scenarioInputs: defaultScenarioInputs,
          weightSet: getSimulationWeightSet('baseline'),
          includeHistory: false,
        }).risk,
      ),
    );
  }, [scenarioTimeline, sparklineProfile]);

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
  }, [activeEvents, activeWeightSet, deferredScenarioInputs, scenarioTimeline, sparklineProfile]);

  const sparkline: SparklineSeries | null = useMemo(
    () => {
      if (!sparklineProfile) return null;
      return {
        labels: scenarioTimeline.slice(),
        active: sparklineActiveRisks,
        baseline: sparklineBaselineRisks,
        currentIndex: timelineIndex,
      };
    },
    [
      sparklineActiveRisks,
      sparklineBaselineRisks,
      sparklineProfile,
      timelineIndex,
    ],
  );

  return {
    simulated,
    baselineSimulated,
    selected,
    baselineSelected,
    selectedRiskDelta,
    selectedConfidenceDelta,
    sparkline,
  };
}