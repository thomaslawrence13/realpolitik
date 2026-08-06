/** Utility functions for map interactions and animations */

/** Clamp a value between min and max bounds */
export const clamp = (value: number, min: number, max: number): number => 
  Math.min(max, Math.max(min, value));

/** Ease-in-out function for smooth animations */
export const easeInOut = (t: number): number => 
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

/** Capitalize the first letter of a string */
export const capitalize = (str: string): string => 
  str.charAt(0).toUpperCase() + str.slice(1);

/** Prevent the map from being dragged completely off-screen */
export const clampOffset = (
  offset: { x: number; y: number },
  zoom: number,
  MAP_WIDTH: number,
  MAP_HEIGHT: number,
  PAN_MARGIN: number
): { x: number; y: number } => ({
  x: clamp(offset.x, -(MAP_WIDTH * zoom - PAN_MARGIN), MAP_WIDTH - PAN_MARGIN),
  y: clamp(offset.y, -(MAP_HEIGHT * zoom - PAN_MARGIN), MAP_HEIGHT - PAN_MARGIN),
});
