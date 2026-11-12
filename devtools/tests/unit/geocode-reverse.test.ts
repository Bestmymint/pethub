import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  provinces: [
    { id: 'p10', code: '10', nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' },
    { id: 'p50', code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' },
  ],
  districts: [
    { id: 'd1001', code: '1001', provinceId: 'p10', nameTh: 'พระนคร', nameEn: 'Phra Nakhon' },
    {
      id: 'd5001',
      code: '5001',
      provinceId: 'p50',
      nameTh: 'เมืองเชียงใหม่',
      nameEn: 'Mueang Chiang Mai',
    },
  ],
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    province: { findMany: async () => fixture.provinces },
    district: {
      findMany: async ({ where }: { where: { provinceId: string } }) =>
        fixture.districts.filter((district) => district.provinceId === where.provinceId),
    },
  },
}));

/** The route keeps its throttle and cache in module state, so every test gets a fresh module. */
async function loadRoute() {
  vi.resetModules();
  const module = await import('@/app/api/geocode/route');
  return module.GET as (request: NextRequest) => Promise<Response>;
}

const bangkokPayload = {
  display_name: 'แขวงบวรนิเวศ, เขตพระนคร, กรุงเทพมหานคร, 10200, ประเทศไทย',
  address: {
    quarter: 'แขวงบวรนิเวศ',
    suburb: 'เขตพระนคร',
    city: 'กรุงเทพมหานคร',
    'ISO3166-2-lvl4': 'TH-10',
  },
};
const chiangMaiPayload = {
  display_name: 'ตำบลพระสิงห์, เทศบาลนครเชียงใหม่, ป่าแดด, อำเภอเมืองเชียงใหม่, จังหวัดเชียงใหม่',
  address: {
    city_district: 'ตำบลพระสิงห์',
    municipality: 'ป่าแดด',
    county: 'อำเภอเมืองเชียงใหม่',
    province: 'จังหวัดเชียงใหม่',
    'ISO3166-2-lvl4': 'TH-50',
  },
};

const request = (query: string) => new NextRequest(`http://localhost:3000/api/geocode?${query}`);

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
  vi.stubEnv('NOMINATIM_CONTACT_EMAIL', 'test@example.com');
  vi.stubEnv('DATABASE_URL', 'postgresql://local/only');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('reverse geocode route', () => {
  it('maps a Bangkok point to province 10 and district 1001', async () => {
    const GET = await loadRoute();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(bangkokPayload)),
    );
    const response = await GET(request('reverse=1&lat=13.7563&lng=100.5018'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      matched: 'province+district',
      province: { code: '10', nameTh: 'กรุงเทพมหานคร' },
      district: { code: '1001', nameTh: 'พระนคร' },
    });
  });

  it('maps a Chiang Mai point and asks the provider for Thai names', async () => {
    const GET = await loadRoute();
    const fetchMock = vi.fn(async () => Response.json(chiangMaiPayload));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(request('reverse=1&lat=18.7883&lng=98.9853'));
    expect(await response.json()).toMatchObject({
      matched: 'province+district',
      province: { code: '50' },
      district: { code: '5001' },
    });
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/reverse');
    expect(url.searchParams.get('accept-language')).toBe('th');
    expect(url.searchParams.get('addressdetails')).toBe('1');
  });

  it('serves a repeated point from cache, then throttles a different point', async () => {
    const GET = await loadRoute();
    const fetchMock = vi.fn(async () => Response.json(bangkokPayload));
    vi.stubGlobal('fetch', fetchMock);

    await GET(request('reverse=1&lat=13.7563&lng=100.5018'));
    const cached = await GET(request('reverse=1&lat=13.7563&lng=100.5018'));
    expect(cached.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const throttled = await GET(request('reverse=1&lat=13.8&lng=100.6'));
    expect(throttled.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-01-01T00:00:02Z'));
    const afterWait = await GET(request('reverse=1&lat=13.8&lng=100.6'));
    expect(afterWait.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the dropdowns unchanged when nothing matches', async () => {
    const GET = await loadRoute();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ address: { country: 'ประเทศไทย' } })),
    );
    const response = await GET(request('reverse=1&lat=12.5&lng=99.9'));
    expect(await response.json()).toMatchObject({
      matched: 'none',
      province: null,
      district: null,
    });
  });

  it('never hands one user the cached coordinates of another user in the same cell', async () => {
    const GET = await loadRoute();
    const fetchMock = vi.fn(async () => Response.json(bangkokPayload));
    vi.stubGlobal('fetch', fetchMock);

    const first = await GET(request('reverse=1&lat=13.75631&lng=100.50181'));
    expect(await first.json()).toMatchObject({ latitude: 13.75631, longitude: 100.50181 });
    // Same ~110 m cell, different exact point: served from cache with its own coordinates.
    const second = await GET(request('reverse=1&lat=13.75649&lng=100.50199'));
    const body = (await second.json()) as Record<string, unknown>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body).toMatchObject({
      latitude: 13.75649,
      longitude: 100.50199,
      matched: 'province+district',
      district: { code: '1001' },
    });
    expect(JSON.stringify(body)).not.toContain('13.75631');
    expect(body).not.toHaveProperty('displayName');
  });

  it('rejects missing or blank coordinates with 400 instead of treating them as 0', async () => {
    const GET = await loadRoute();
    const fetchMock = vi.fn(async () => Response.json(bangkokPayload));
    vi.stubGlobal('fetch', fetchMock);
    for (const query of [
      'reverse=1',
      'reverse=1&lat=13.75',
      'reverse=1&lng=100.5',
      'reverse=1&lat=&lng=',
      'reverse=1&lat=%20&lng=100.5',
      'reverse=1&lat=abc&lng=100.5',
      'reverse=1&lat=95&lng=100.5',
    ]) {
      const response = await GET(request(query));
      expect(response.status, query).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps serving fresh lookups after more distinct cells than the cache holds', async () => {
    const GET = await loadRoute();
    const fetchMock = vi.fn(async () => Response.json(bangkokPayload));
    vi.stubGlobal('fetch', fetchMock);
    let now = new Date('2026-01-01T00:00:00Z').getTime();
    // 600 distinct cells against a 500-entry cache.
    for (let index = 0; index < 600; index += 1) {
      now += 1_001;
      vi.setSystemTime(now);
      const lat = (13 + index / 1_000).toFixed(3);
      const response = await GET(request(`reverse=1&lat=${lat}&lng=100.5`));
      expect(response.status).toBe(200);
    }
    expect(fetchMock).toHaveBeenCalledTimes(600);
    // The first cell was evicted, so asking again calls the provider again.
    now += 1_001;
    vi.setSystemTime(now);
    await GET(request('reverse=1&lat=13.000&lng=100.5'));
    expect(fetchMock).toHaveBeenCalledTimes(601);
    // A recent cell is still cached.
    await GET(request('reverse=1&lat=13.599&lng=100.5'));
    expect(fetchMock).toHaveBeenCalledTimes(601);
  });

  it('reports a provider failure as 503', async () => {
    const GET = await loadRoute();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('denied', { status: 403 })),
    );
    const response = await GET(request('reverse=1&lat=12.5&lng=99.9'));
    expect(response.status).toBe(503);
  });
});
