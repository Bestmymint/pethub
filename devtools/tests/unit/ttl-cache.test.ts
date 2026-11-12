import { describe, expect, it } from 'vitest';

import { TtlCache } from '@/lib/ttl-cache';

describe('TtlCache', () => {
  it('returns a value until it expires, then forgets it', () => {
    const cache = new TtlCache<string>(10, 1_000);
    cache.set('a', 'one', 0);
    expect(cache.get('a', 999)).toBe('one');
    expect(cache.get('a', 1_000)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('never holds more than maxEntries values and evicts the oldest first', () => {
    const cache = new TtlCache<number>(3, 60_000);
    for (let index = 0; index < 50; index += 1) cache.set(`k${index}`, index, index);
    expect(cache.size).toBe(3);
    expect(cache.get('k46', 50)).toBeUndefined();
    expect([47, 48, 49].map((index) => cache.get(`k${index}`, 50))).toEqual([47, 48, 49]);
  });

  it('sweeps expired entries on insert, so they never take up room', () => {
    const cache = new TtlCache<string>(3, 100);
    cache.set('a', 'x', 0);
    cache.set('b', 'y', 10);
    cache.set('c', 'z', 500);
    expect(cache.size).toBe(1);
    expect(cache.get('c', 500)).toBe('z');
  });

  it('refreshes a key that is set again', () => {
    const cache = new TtlCache<string>(2, 1_000);
    cache.set('a', '1', 0);
    cache.set('b', '2', 0);
    cache.set('a', '3', 0);
    cache.set('c', '4', 0);
    expect(cache.get('b', 0)).toBeUndefined();
    expect(cache.get('a', 0)).toBe('3');
  });

  it('rejects a non-positive size', () => {
    expect(() => new TtlCache(0, 1_000)).toThrow();
  });
});
