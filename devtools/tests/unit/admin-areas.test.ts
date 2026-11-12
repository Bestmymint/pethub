import { readFileSync } from 'node:fs';

import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  districtCandidates,
  matchAreaName,
  normalizeAreaName,
  provinceCandidates,
  provinceCodeFromIso,
} from '@/lib/admin-areas';
import { GET } from '@/app/api/geocode/route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('normalizeAreaName', () => {
  it('strips Thai administrative prefixes', () => {
    expect(normalizeAreaName('จังหวัดเชียงใหม่')).toBe('เชียงใหม่');
    expect(normalizeAreaName('อำเภอเมืองเชียงใหม่')).toBe('เมืองเชียงใหม่');
    expect(normalizeAreaName('เขตพระนคร')).toBe('พระนคร');
    expect(normalizeAreaName('แขวงบางรัก')).toBe('บางรัก');
    expect(normalizeAreaName('ตำบลพระสิงห์')).toBe('พระสิงห์');
    expect(normalizeAreaName('กิ่งอำเภอบ้านไร่')).toBe('บ้านไร่');
  });

  it('strips English prefixes/suffixes, spaces and case', () => {
    expect(normalizeAreaName('Mueang Chiang Mai District')).toBe('mueangchiangmai');
    expect(normalizeAreaName('Chiang Mai Province')).toBe('chiangmai');
    expect(normalizeAreaName('  Bangkok  ')).toBe('bangkok');
  });

  it('keeps names that would become empty untouched', () => {
    expect(normalizeAreaName('เขต')).toBe('เขต');
  });
});

describe('matchAreaName', () => {
  const provinces = [
    { code: '10', nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' },
    { code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' },
  ];
  const districts = [
    { code: '1001', nameTh: 'พระนคร', nameEn: 'Phra Nakhon' },
    { code: '1004', nameTh: 'บางรัก', nameEn: 'Bang Rak' },
    { code: '5001', nameTh: 'เมืองเชียงใหม่', nameEn: 'Mueang Chiang Mai' },
    { code: '5004', nameTh: 'ป่าแดด', nameEn: 'Pa Daet' },
  ];

  it('matches Thai and English candidates by name', () => {
    expect(
      matchAreaName(provinceCandidates({ province: 'จังหวัดเชียงใหม่' }), provinces)?.code,
    ).toBe('50');
    expect(matchAreaName(provinceCandidates({ city: 'กรุงเทพมหานคร' }), provinces)?.code).toBe(
      '10',
    );
    expect(matchAreaName(provinceCandidates({ province: 'Chiang Mai' }), provinces)?.code).toBe(
      '50',
    );
  });

  it('resolves Bangkok from its short form', () => {
    expect(matchAreaName(['กรุงเทพ'], provinces)?.code).toBe('10');
  });

  it('prefers the county field over a subdistrict that shares a district name', () => {
    const address = {
      city_district: 'ตำบลพระสิงห์',
      municipality: 'ป่าแดด',
      county: 'อำเภอเมืองเชียงใหม่',
    };
    expect(matchAreaName(districtCandidates(address), districts)?.code).toBe('5001');
    expect(matchAreaName(districtCandidates({ suburb: 'เขตบางรัก' }), districts)?.code).toBe(
      '1004',
    );
  });

  it('returns undefined instead of guessing', () => {
    expect(
      matchAreaName(districtCandidates({ suburb: 'แขวงบวรนิเวศ' }), districts),
    ).toBeUndefined();
    expect(matchAreaName([], districts)).toBeUndefined();
    expect(matchAreaName(['เทศบาลนครเชียงใหม่'], districts)).toBeUndefined();
  });
});

describe('matchAreaName with the seeded boundary data', () => {
  const features = (name: string) =>
    JSON.parse(readFileSync(`public/data/boundaries/${name}.geojson`, 'utf8')).features as Array<{
      properties: { code: string; provinceCode: string; nameTh: string; nameEn: string };
    }>;
  const provinces = features('provinces').map((feature) => ({
    id: feature.properties.code,
    code: feature.properties.code,
    nameTh: feature.properties.nameTh,
    nameEn: feature.properties.nameEn,
  }));
  const districts = features('districts').map((feature) => ({
    id: feature.properties.code,
    provinceId: feature.properties.provinceCode,
    code: feature.properties.code,
    nameTh: feature.properties.nameTh,
    nameEn: feature.properties.nameEn,
  }));

  it('resolves a Bangkok address from Nominatim', () => {
    // Captured from /reverse?lat=13.7563&lon=100.5018&accept-language=th
    const address = {
      quarter: 'แขวงบวรนิเวศ',
      suburb: 'เขตพระนคร',
      city: 'กรุงเทพมหานคร',
      'ISO3166-2-lvl4': 'TH-10',
    };
    const province =
      provinces.find((item) => item.code === provinceCodeFromIso(address['ISO3166-2-lvl4'])) ??
      matchAreaName(provinceCandidates(address), provinces);
    expect(province?.nameTh).toBe('กรุงเทพมหานคร');
    expect(matchAreaName(districtCandidates(address), districts)?.nameTh).toBe('พระนคร');
  });

  it('resolves a Chiang Mai address from Nominatim', () => {
    // Captured from /reverse?lat=18.7883&lon=98.9853&accept-language=th
    const address = {
      city_district: 'ตำบลพระสิงห์',
      city: 'เทศบาลนครเชียงใหม่',
      municipality: 'ป่าแดด',
      county: 'อำเภอเมืองเชียงใหม่',
      province: 'จังหวัดเชียงใหม่',
      'ISO3166-2-lvl4': 'TH-50',
    };
    const province =
      provinces.find((item) => item.code === provinceCodeFromIso(address['ISO3166-2-lvl4'])) ??
      matchAreaName(provinceCandidates(address), provinces);
    expect(province?.nameTh).toBe('เชียงใหม่');
    expect(matchAreaName(districtCandidates(address), districts)?.nameTh).toBe('เมืองเชียงใหม่');
  });
});

describe('provinceCodeFromIso', () => {
  it('reads the two digit province code', () => {
    expect(provinceCodeFromIso('TH-10')).toBe('10');
    expect(provinceCodeFromIso('TH-50')).toBe('50');
    expect(provinceCodeFromIso('th-50')).toBe('50');
    expect(provinceCodeFromIso('TH-5')).toBeUndefined();
    expect(provinceCodeFromIso(undefined)).toBeUndefined();
  });
});

describe('reverse geocode route', () => {
  const request = (query: string) => new NextRequest(`http://localhost:3000/api/geocode?${query}`);

  it('answers outside-Thailand points without calling the provider', async () => {
    vi.stubEnv('NOMINATIM_CONTACT_EMAIL', 'test@example.com');
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(request('reverse=1&lat=51.5&lng=-0.12'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      matched: 'outside-thailand',
      province: null,
      district: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unparseable coordinate', async () => {
    const response = await GET(request('reverse=1&lat=abc&lng=100'));
    expect(response.status).toBe(400);
  });
});
