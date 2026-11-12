import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  districtCandidates,
  matchAreaName,
  provinceCandidates,
  provinceCodeFromIso,
} from '@/lib/admin-areas';
import { latitudeRange, longitudeRange } from '@/features/submissions/coordinates';
import { prisma } from '@/lib/prisma';
import { requiredEnvironment } from '@/lib/server-config';
import { TtlCache } from '@/lib/ttl-cache';

const schema = z.object({ q: z.string().trim().min(3).max(160) });
/** A missing or blank value is rejected before coercion, so it never becomes 0. */
const coordinate = (min: number, max: number) =>
  z.string().trim().min(1).pipe(z.coerce.number<string>().min(min).max(max));
const reverseSchema = z.object({
  lat: coordinate(-90, 90),
  lng: coordinate(-180, 180),
});

/** Bounded so a stream of distinct queries or pins cannot grow memory without limit. */
const CACHE_MAX_ENTRIES = 500;
const CACHE_TTL_MS = 86_400_000;
const searchCache = new TtlCache<unknown>(CACHE_MAX_ENTRIES, CACHE_TTL_MS);
/**
 * Reverse results are keyed by a ~110 m cell and hold only the resolved areas.
 * Coordinates are never stored, so one user's exact pin is never returned to
 * another user who asks about a point in the same cell.
 */
interface ReverseAreas {
  province: { code: string; nameTh: string; nameEn: string } | null;
  district: { code: string; nameTh: string; nameEn: string } | null;
  matched: 'province+district' | 'province' | 'none';
}
const reverseCache = new TtlCache<ReverseAreas>(CACHE_MAX_ENTRIES, CACHE_TTL_MS);
let lastRequestAt = 0;

/** Nominatim caps clients at one request per second; the search and reverse share it. */
const throttleMs = 1_000;

export const dynamic = 'force-dynamic';

interface NominatimAddress {
  province?: string;
  state?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
  district?: string;
  suburb?: string;
  city_district?: string;
  'ISO3166-2-lvl4'?: string;
}

function nominatimBaseUrl() {
  const baseUrl = process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org';
  const url = new URL(baseUrl);
  // Only the approved public provider may be contacted, whatever the env says.
  if (url.hostname !== 'nominatim.openstreetmap.org') return undefined;
  return url;
}

async function nominatim(url: URL) {
  lastRequestAt = Date.now();
  return fetch(url, {
    headers: {
      'User-Agent': `PetHub-Thailand/1.0 (${requiredEnvironment('NOMINATIM_CONTACT_EMAIL')})`,
    },
    cache: 'no-store',
  });
}

function throttled() {
  // Not affected by RATE_LIMIT_DISABLED: this protects the Nominatim usage policy.
  return Date.now() - lastRequestAt < throttleMs;
}

const districtCache = new Map<string, Array<{ code: string; nameTh: string; nameEn: string }>>();

async function districtsOf(provinceId: string) {
  const cached = districtCache.get(provinceId);
  if (cached) return cached;
  const districts = await prisma.district.findMany({
    where: { provinceId },
    select: { code: true, nameTh: true, nameEn: true },
  });
  districtCache.set(provinceId, districts);
  return districts;
}

/** Best-effort province/district for a point; nulls mean "let the user choose". */
async function resolveAreas(address: NominatimAddress) {
  const provinces = await prisma.province.findMany({
    select: { id: true, code: true, nameTh: true, nameEn: true },
  });
  const isoCode = provinceCodeFromIso(address['ISO3166-2-lvl4']);
  const province =
    provinces.find((item) => item.code === isoCode) ??
    matchAreaName(provinceCandidates(address as Record<string, string | undefined>), provinces);
  if (!province) return { province: null, district: null };
  const district = matchAreaName(
    districtCandidates(address as Record<string, string | undefined>),
    await districtsOf(province.id),
  );
  return {
    province: { code: province.code, nameTh: province.nameTh, nameEn: province.nameEn },
    district: district
      ? { code: district.code, nameTh: district.nameTh, nameEn: district.nameEn }
      : null,
  };
}

async function reverseLookup(request: NextRequest) {
  const parsed = reverseSchema.safeParse({
    lat: request.nextUrl.searchParams.get('lat'),
    lng: request.nextUrl.searchParams.get('lng'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'พิกัดไม่ถูกต้อง' }, { status: 400 });
  }
  const { lat, lng } = parsed.data;
  // The coordinates in the answer always come from this request, never the cache.
  const point = { latitude: lat, longitude: lng };
  // Outside the country there is nothing to match, so do not spend a provider call.
  if (
    lat < latitudeRange.min ||
    lat > latitudeRange.max ||
    lng < longitudeRange.min ||
    lng > longitudeRange.max
  ) {
    return NextResponse.json({
      province: null,
      district: null,
      ...point,
      matched: 'outside-thailand',
    });
  }
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = reverseCache.get(key);
  if (cached) return NextResponse.json({ ...cached, ...point });
  if (throttled()) {
    return NextResponse.json(
      { error: 'กรุณารอสักครู่ก่อนตรวจหาพื้นที่ครั้งถัดไป' },
      { status: 429 },
    );
  }
  const baseUrl = nominatimBaseUrl();
  if (!baseUrl)
    return NextResponse.json({ error: 'Geocoding provider is not approved' }, { status: 503 });
  const url = new URL('/reverse', baseUrl);
  url.search = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '10',
    'accept-language': 'th',
  }).toString();
  try {
    const response = await nominatim(url);
    if (!response.ok) throw new Error('Provider unavailable');
    const raw = (await response.json()) as { address?: NominatimAddress };
    const areas = await resolveAreas(raw.address ?? {});
    const value: ReverseAreas = {
      ...areas,
      matched: areas.district ? 'province+district' : areas.province ? 'province' : 'none',
    };
    reverseCache.set(key, value);
    return NextResponse.json({ ...value, ...point });
  } catch {
    return NextResponse.json(
      { error: 'ตรวจหาพื้นที่จากพิกัดไม่ได้ในขณะนี้ กรุณาเลือกจังหวัดและอำเภอเอง' },
      { status: 503 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has('reverse')) return reverseLookup(request);
  const parsed = schema.safeParse({ q: request.nextUrl.searchParams.get('q') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'กรุณากรอกที่อยู่อย่างน้อย 3 ตัวอักษร' }, { status: 400 });
  }
  const query = parsed.data.q.toLocaleLowerCase('th');
  const cached = searchCache.get(query);
  if (cached) return NextResponse.json(cached);
  // Not affected by RATE_LIMIT_DISABLED: this protects the Nominatim usage policy (max 1 request/second).
  if (throttled()) {
    return NextResponse.json(
      { error: 'กรุณารอสักครู่ก่อนค้นหาที่อยู่ครั้งถัดไป' },
      { status: 429 },
    );
  }
  const baseUrl = nominatimBaseUrl();
  if (!baseUrl)
    return NextResponse.json({ error: 'Geocoding provider is not approved' }, { status: 503 });
  const url = new URL('/search', baseUrl);
  url.search = new URLSearchParams({
    q: parsed.data.q,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'th',
    limit: '5',
  }).toString();
  try {
    const response = await nominatim(url);
    if (!response.ok) throw new Error('Provider unavailable');
    const raw = (await response.json()) as Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
    }>;
    const value = {
      results: raw.map((item) => ({
        id: String(item.place_id),
        displayName: item.display_name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      })),
    };
    searchCache.set(query, value);
    return NextResponse.json(value);
  } catch {
    return NextResponse.json(
      { error: 'ค้นหาที่อยู่ไม่ได้ในขณะนี้ กรุณาปักหมุดด้วยตนเอง' },
      { status: 503 },
    );
  }
}
