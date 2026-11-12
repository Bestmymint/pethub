import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { rateLimitBucket: { upsert } } }));

import { consumeRateLimit } from '@/lib/rate-limit';
import { rateLimitDisabled } from '@/lib/server-config';

const args = { key: 'user-1', action: 'review', limit: 2, windowMs: 60_000 };

beforeEach(() => upsert.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe('RATE_LIMIT_DISABLED switch', () => {
  it('only the exact string "true" disables limits', () => {
    for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes', ' true']) {
      expect(rateLimitDisabled({ RATE_LIMIT_DISABLED: value })).toBe(false);
    }
    expect(rateLimitDisabled({ RATE_LIMIT_DISABLED: 'true' })).toBe(true);
  });

  it('still enforces limits when the switch is unset', async () => {
    vi.stubEnv('RATE_LIMIT_DISABLED', '');
    upsert.mockResolvedValue({ count: 3 });
    const result = await consumeRateLimit(args);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(result.allowed).toBe(false);
    upsert.mockResolvedValue({ count: 2 });
    expect((await consumeRateLimit(args)).allowed).toBe(true);
  });

  it('still enforces limits for a value other than "true"', async () => {
    vi.stubEnv('RATE_LIMIT_DISABLED', 'false');
    upsert.mockResolvedValue({ count: 99 });
    expect((await consumeRateLimit(args)).allowed).toBe(false);
  });

  it('bypasses limits and skips the database when set to "true"', async () => {
    vi.stubEnv('RATE_LIMIT_DISABLED', 'true');
    upsert.mockResolvedValue({ count: 99 });
    const result = await consumeRateLimit(args);
    expect(result.allowed).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });
});
