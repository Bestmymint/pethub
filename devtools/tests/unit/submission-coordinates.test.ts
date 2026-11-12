import { describe, expect, it } from 'vitest';

import {
  clampCoordinate,
  clampPoint,
  formatCoordinate,
  isSamePoint,
  latitudeRange,
  longitudeRange,
  parseCoordinate,
} from '@/features/submissions/coordinates';

describe('parseCoordinate', () => {
  it('accepts in-range values from strings and numbers', () => {
    expect(parseCoordinate('13.7563', 'latitude')).toBe(13.7563);
    expect(parseCoordinate(100.5018, 'longitude')).toBe(100.5018);
    expect(parseCoordinate(String(latitudeRange.min), 'latitude')).toBe(latitudeRange.min);
    expect(parseCoordinate(String(longitudeRange.max), 'longitude')).toBe(longitudeRange.max);
  });

  it('rejects empty, non-numeric and out-of-range values', () => {
    expect(parseCoordinate('', 'latitude')).toBeUndefined();
    expect(parseCoordinate(undefined, 'latitude')).toBeUndefined();
    expect(parseCoordinate('abc', 'latitude')).toBeUndefined();
    expect(parseCoordinate('4.9', 'latitude')).toBeUndefined();
    expect(parseCoordinate('21.1', 'latitude')).toBeUndefined();
    expect(parseCoordinate('96.9', 'longitude')).toBeUndefined();
    expect(parseCoordinate('106.1', 'longitude')).toBeUndefined();
  });

  it('keeps the same bounds as the submission schema', () => {
    expect(latitudeRange).toEqual({ min: 5, max: 21 });
    expect(longitudeRange).toEqual({ min: 97, max: 106 });
  });
});

describe('clampCoordinate', () => {
  it('keeps in-range values and pulls the rest to the border', () => {
    expect(clampCoordinate(13.75, 'latitude')).toBe(13.75);
    expect(clampCoordinate(60, 'latitude')).toBe(latitudeRange.max);
    expect(clampCoordinate(-40, 'latitude')).toBe(latitudeRange.min);
    expect(clampCoordinate(151.2, 'longitude')).toBe(longitudeRange.max);
    expect(clampCoordinate(0, 'longitude')).toBe(longitudeRange.min);
  });
});

describe('clampPoint', () => {
  it('clamps both axes of a map pick', () => {
    expect(clampPoint({ latitude: 13.7563, longitude: 100.5018 })).toEqual({
      latitude: 13.7563,
      longitude: 100.5018,
    });
    expect(clampPoint({ latitude: 51.5, longitude: -0.12 })).toEqual({
      latitude: latitudeRange.max,
      longitude: longitudeRange.min,
    });
  });
});

describe('formatCoordinate / isSamePoint', () => {
  it('rounds to six decimals for the inputs', () => {
    expect(formatCoordinate(13.75630000001)).toBe('13.756300');
    expect(formatCoordinate(100.5018123)).toBe('100.501812');
  });

  it('treats sub-metre differences as the same pin', () => {
    expect(
      isSamePoint(
        { latitude: 13.7563, longitude: 100.5018 },
        { latitude: 13.7563001, longitude: 100.5018 },
      ),
    ).toBe(true);
    expect(
      isSamePoint(
        { latitude: 13.7563, longitude: 100.5018 },
        { latitude: 13.7573, longitude: 100.5018 },
      ),
    ).toBe(false);
  });
});
