import { useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import {
  defaultScenarioInputs,
  getSimulationWeightSet,
  simulateCountry,
} from '../simulation';
import type {
  CountryProfile,
  ScenarioInputs,
  SimulatedCountry,
  WeightSetKey,
} from '../types';
import type { EventTemplate } from '../types';
import type { SparklineSeries } from '../components/RightInspector';

const EMPTY_SIMULATED: SimulatedCountry[] = [];

/**
 * Reads the worker simulation snapshot and derives the selected-country view.
 * Payload dispatch lives in App (single owner) — this hook must not re-post.
 */
export function useSimulation(
  activeProfiles: CountryProfile[],
  activeEvents: EventTemplate[],
  deferredScenarioInputs: ScenarioInputs,
  deferredWeightSetKey: WeightSetKey,
  selectedCountry: string,
  timelineIndex: number,
  scenarioTimeline: string[],
): {
  simulated: SimulatedCountry[];
  baselineSimulated: SimulatedCountry[];
  selected: SimulatedCountry | null;
  baselineSelected: SimulatedCountry | null;
  selectedRiskDelta: number;
  selectedConfidenceDelta: number;
  sparkline: SparklineSeries | null;
} {
  const simulationSnapshot = useMapStore((state) => state.simulationSnapshot);

  const activeWeightSet = useMemo(
    () => getSimulationWeightSet(deferredWeightSetKey),
    [deferredWeightSetKey],
  );

  const simulated = simulationSnapshot?.simulated ?? EMPTY_SIMULATED;
  const baselineSimulated = simulationSnapshot?.baselineSimulated ?? EMPTY_SIMULATED;

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

  // Prefer the worker row for map-parity risk/alignment; re-sim with explanation
  // on the main thread so the inspector always has contribution breakdowns even
  // when the user selects a country the worker did not mark for explanation.
  const selected = useMemo<SimulatedCountry | null>(() => {
    if (!selectedProfile) return null;
    const snapshotSelected = byName.get(selectedCountry) ?? null;
    if (snapshotSelected?.explanation) return snapshotSelected;
    return simulateCountry(selectedProfile, timelineIndex, {
      scenarioInputs: deferredScenarioInputs,
      activeEvents,
      weightSet: activeWeightSet,
      includeExplanation: true,
      includeHistory: false,
    });
  }, [
    activeEvents,
    activeWeightSet,
    byName,
    deferredScenarioInputs,
    selectedCountry,
    selectedProfile,
    timelineIndex,
  ]);

  const baselineSelected = useMemo<SimulatedCountry | null>(() => {
    if (!selectedProfile) return null;
    const snapshotSelected = baselineByName.get(selectedCountry) ?? null;
    if (snapshotSelected) return snapshotSelected;
    return simulateCountry(selectedProfile, timelineIndex, {
      scenarioInputs: defaultScenarioInputs,
      weightSet: getSimulationWeightSet('baseline'),
      includeExplanation: false,
      includeHistory: false,
    });
  }, [baselineByName, selectedCountry, selectedProfile, timelineIndex]);

  const selectedRiskDelta =
    selected && baselineSelected
      ? Math.round(selected.risk - baselineSelected.risk)
      : 0;
  const selectedConfidenceDelta =
    selected && baselineSelected
      ? Math.round(selected.confidence - baselineSelected.confidence)
      : 0;

  const sparklineBaselineRisks = useMemo<number[]>(() => {
    if (!selectedProfile) return [];
    return scenarioTimeline.map((_, index) =>
      Math.round(
        simulateCountry(selectedProfile, index, {
          scenarioInputs: defaultScenarioInputs,
          weightSet: getSimulationWeightSet('baseline'),
          includeHistory: false,
        }).risk,
      ),
    );
  }, [scenarioTimeline, selectedProfile]);

  const sparklineActiveRisks = useMemo<number[]>(() => {
    if (!selectedProfile) return [];
    return scenarioTimeline.map((_, index) =>
      Math.round(
        simulateCountry(selectedProfile, index, {
          scenarioInputs: deferredScenarioInputs,
          activeEvents,
          weightSet: activeWeightSet,
          includeHistory: false,
        }).risk,
      ),
    );
  }, [activeEvents, activeWeightSet, deferredScenarioInputs, scenarioTimeline, selectedProfile]);

  const sparkline: SparklineSeries | null = useMemo(() => {
    if (!selectedProfile) return null;
    return {
      labels: scenarioTimeline.slice(),
      active: sparklineActiveRisks,
      baseline: sparklineBaselineRisks,
      currentIndex: timelineIndex,
    };
  }, [sparklineActiveRisks, sparklineBaselineRisks, selectedProfile, scenarioTimeline, timelineIndex]);

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