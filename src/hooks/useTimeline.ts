import { useState, useCallback, useEffect, useRef } from 'react';
import { clampTimelineIndex } from '../lib/timeline';

interface UseTimelineOptions {
  totalPeriods: number;
  initialIndex?: number;
}

interface UseTimelineReturn {
  timelineIndex: number;
  isPlaying: boolean;
  handleTimelineChange: (index: number) => void;
  handleTogglePlay: () => void;
}

export function useTimeline({
  totalPeriods,
  initialIndex = 0,
}: UseTimelineOptions): UseTimelineReturn {
  const [timelineIndex, setTimelineIndex] = useState(() => 
    clampTimelineIndex(initialIndex, totalPeriods)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const handleTogglePlayRef = useRef<() => void>(() => {});

  const handleTimelineChange = useCallback((index: number) => {
    setIsPlaying(false);
    setTimelineIndex(clampTimelineIndex(index, totalPeriods));
  }, [totalPeriods]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && timelineIndex >= totalPeriods - 1) {
        // Restart from the beginning when pressing play at the last period
        setTimelineIndex(0);
      }
      return !prev;
    });
  }, [timelineIndex, totalPeriods]);

  // Keep ref updated for keyboard shortcut access
  handleTogglePlayRef.current = handleTogglePlay;

  useEffect(() => {
    if (!isPlaying) return;
    
    const id = setInterval(() => {
      setTimelineIndex((current) => {
        if (current >= totalPeriods - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1000); // Default 1 second interval
    
    return () => clearInterval(id);
  }, [isPlaying, totalPeriods]);

  // Expose toggle via ref for external keyboard handlers
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        handleTogglePlayRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return {
    timelineIndex,
    isPlaying,
    handleTimelineChange,
    handleTogglePlay,
  };
}
