/**
 * Small in-memory cache with a per-entry expiry and a hard size limit.
 *
 * Expired entries are dropped on read and swept on every insert; when the cache
 * is still full, the oldest inserted entry is evicted (a `Map` keeps insertion
 * order). Memory therefore never grows past `maxEntries` values.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { expiresAt: number; value: V }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1)
      throw new Error('maxEntries must be a positive integer');
  }

  get size() {
    return this.entries.size;
  }

  get(key: string, now = Date.now()): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V, now = Date.now()) {
    // Re-inserting moves the key to the newest position.
    this.entries.delete(key);
    for (const [entryKey, entry] of this.entries)
      if (entry.expiresAt <= now) this.entries.delete(entryKey);
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
    this.entries.set(key, { expiresAt: now + this.ttlMs, value });
  }
}
