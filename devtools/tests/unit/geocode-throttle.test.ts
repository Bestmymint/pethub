import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/geocode/route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const request = (q: string) => new NextRequest(`http://localhost:3000/api/geocode?q=${q}`);

describe('geocode throttle', () => {
  it('keeps the 1 request/second throttle even when RATE_LIMIT_DISABLED=true', async () => {
    vi.stubEnv('RATE_LIMIT_DISABLED', 'true');
    vi.stubEnv('NOMINATIM_CONTACT_EMAIL', 'test@example.com');
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal('fetch', fetchMock);

    const first = await GET(request('siam-square'));
    const second = await GET(request('chiang-mai-old-town'));

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
