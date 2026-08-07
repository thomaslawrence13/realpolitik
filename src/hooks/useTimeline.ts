import { useState, useCallback, useEffect } from 'react';
import { clampTimelineIndex } from '../lib/timeline';
import { UI_TIMING } from '../lib/constants';

interface UseTimelineOptions {
  totalPeriods: number;
  initialIndex?: number;
  /** Auto-play step interval in ms. Defaults to UI_TIMING.autoPlayIntervalMs. */
  intervalMs?: number;
}

interface UseTimelineReturn {
  timelineIndex: number;
  isPlaying: boolean;
  setTimelineIndex: (index: number) => void;
  handleTimelineChange: (index: number) => void;
  handleTogglePlay: () => void;
}

/**
 * Local timeline index + auto-play. Prefer map-store year state when the app
 * already owns timeline in Zustand; this hook is for standalone / tests.
 * Does not register keyboard shortcuts — leave those to the shell.
 */
export function useTimeline({
  totalPeriods,
  initialIndex = 0,
  intervalMs = UI_TIMING.autoPlayIntervalMs,
}: UseTimelineOptions): UseTimelineReturn {
  const [timelineIndex, setTimelineIndexState] = useState(() =>
    clampTimelineIndex(initialIndex, totalPeriods),
  );
  const [isPlaying, setIsPlaying] = useState(false);

  const setTimelineIndex = useCallback(
    (index: number) => {
      setTimelineIndexState(clampTimelineIndex(index, totalPeriods));
    },
    [totalPeriods],
  );

  const handleTimelineChange = useCallback(
    (index: number) => {
      setIsPlaying(false);
      setTimelineIndex(index);
    },
    [setTimelineIndex],
  );

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && timelineIndex >= totalPeriods - 1) {
        setTimelineIndexState(0);
      }
      return !prev;
    });
  }, [timelineIndex, totalPeriods]);

  useEffect(() => {
    if (!isPlaying) return;

    const id = window.setInterval(() => {
      setTimelineIndexState((current) => {
        if (current >= totalPeriods - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [isPlaying, totalPeriods, intervalMs]);

  return {
    timelineIndex,
    isPlaying,
    setTimelineIndex,
    handleTimelineChange,
    handleTogglePlay,
  };
}
