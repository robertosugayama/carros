export const MIN_DIAMETER = 0.03;
export const MAX_DIAMETER = 0.65;
export const clampDiameter = (value: number) =>
  Math.max(MIN_DIAMETER, Math.min(MAX_DIAMETER, value));
// Distances and scene width use the same rendered coordinates, including zoom.
export function resizeDiameter(
  start: number,
  from: number,
  to: number,
  sceneWidth: number,
) {
  if (![start, from, to, sceneWidth].every(Number.isFinite) || sceneWidth <= 0)
    return start;
  return clampDiameter(start + ((to - from) * Math.SQRT2) / sceneWidth);
}
