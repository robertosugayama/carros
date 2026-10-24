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

// Legacy projects and AI estimates may contain different wheel sizes.
// Use their mean until an explicit common diameter is selected; keep centers intact.
export function equalizeWheels<T extends { diameter: number }>(
  wheels: T[],
  diameter?: number,
): T[] {
  if (!wheels.length) return wheels;
  const shared = clampDiameter(
    diameter ?? wheels.reduce((sum, w) => sum + w.diameter, 0) / wheels.length,
  );
  return wheels.map((w) => ({ ...w, diameter: shared }));
}
