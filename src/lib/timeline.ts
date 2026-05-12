export const clampTimelineIndex = (index: number, totalPeriods: number) => {
  if (!Number.isFinite(index)) return 0;
  if (totalPeriods <= 0) return 0;
  return Math.max(0, Math.min(totalPeriods - 1, Math.round(index)));
};
