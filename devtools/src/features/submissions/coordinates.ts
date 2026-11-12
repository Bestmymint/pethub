/**
 * Latitude/longitude rules for the submission map picker.
 *
 * The map can be clicked or dragged anywhere on Earth, but a place submission is
 * limited to Thailand, so picks are clamped to the same range the number inputs
 * already enforce. Keep these values in sync with `submissionSchema`.
 */

export type CoordinateAxis = 'latitude' | 'longitude';

export const latitudeRange = { min: 5, max: 21 } as const;
export const longitudeRange = { min: 97, max: 106 } as const;

export interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

export function rangeFor(axis: CoordinateAxis) {
  return axis === 'latitude' ? latitudeRange : longitudeRange;
}

/** Parses a typed coordinate; undefined means "not a number or outside Thailand". */
export function parseCoordinate(
  value: string | number | undefined,
  axis: CoordinateAxis,
): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const { min, max } = rangeFor(axis);
  return parsed >= min && parsed <= max ? parsed : undefined;
}

/** Forces a value into the allowed range, e.g. after a map click outside Thailand. */
export function clampCoordinate(value: number, axis: CoordinateAxis): number {
  const { min, max } = rangeFor(axis);
  return Math.min(max, Math.max(min, value));
}

/** Six decimals is about 11 cm, enough for a pin and short enough for the inputs. */
export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export function clampPoint(point: CoordinatePoint): CoordinatePoint {
  return {
    latitude: clampCoordinate(point.latitude, 'latitude'),
    longitude: clampCoordinate(point.longitude, 'longitude'),
  };
}

export function isSamePoint(a: CoordinatePoint, b: CoordinatePoint): boolean {
  return Math.abs(a.latitude - b.latitude) < 1e-6 && Math.abs(a.longitude - b.longitude) < 1e-6;
}
