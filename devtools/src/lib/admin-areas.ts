/**
 * Name matching for turning a Nominatim address into a seeded province/district.
 *
 * Nominatim returns Thai administrative prefixes and suffixes ("จังหวัด…",
 * "อำเภอ…", "เขต…", "แขวง…", "Tambon… District") while the seeded names in
 * `provinces`/`districts` do not carry them, so both sides are normalized before
 * an exact comparison. Matching is best effort: an unknown name returns
 * `undefined` and the caller leaves the dropdowns for the user to fill in.
 */

const thaiPrefixes = ['กิ่งอำเภอ', 'จังหวัด', 'อำเภอ', 'ตำบล', 'แขวง', 'เขต'];
const englishPrefixes = [
  'king amphoe',
  'changwat',
  'province',
  'amphoe',
  'district',
  'khwaeng',
  'tambon',
  'khet',
];
const englishSuffixes = ['district', 'province', 'amphoe'];

/** Strips admin wording, spaces and case so "อำเภอเมืองเชียงใหม่" = "เมืองเชียงใหม่". */
export function normalizeAreaName(value: string): string {
  let name = value
    .normalize('NFC')
    .toLocaleLowerCase('th')
    .replace(/[\s\u00a0.\-–—]+/gu, '')
    .trim();
  for (let pass = 0; pass < 3; pass += 1) {
    const before = name;
    for (const prefix of thaiPrefixes)
      if (name.startsWith(prefix) && name.length > prefix.length) name = name.slice(prefix.length);
    for (const prefix of englishPrefixes)
      if (name.startsWith(prefix) && name.length > prefix.length) name = name.slice(prefix.length);
    for (const suffix of englishSuffixes)
      if (name.endsWith(suffix) && name.length > suffix.length)
        name = name.slice(0, -suffix.length);
    if (before === name) break;
  }
  return name;
}

/** Common short forms that map onto a seeded name. */
const aliases: Record<string, string> = {
  กรุงเทพ: 'กรุงเทพมหานคร',
  bangkokmetropolis: 'bangkok',
};

/** Normalized comparison key, including the alias table above. */
export function areaKey(value: string): string {
  const normalized = normalizeAreaName(value);
  return aliases[normalized] ?? normalized;
}

export interface AreaNames {
  nameTh: string;
  nameEn: string;
}

/** First area whose Thai or English name matches any candidate, in candidate order. */
export function matchAreaName<T extends AreaNames>(
  candidates: Array<string | undefined | null>,
  areas: readonly T[],
): T | undefined {
  const normalizedAreas = areas
    .map((area) => ({ area, th: areaKey(area.nameTh), en: areaKey(area.nameEn) }))
    .filter((entry) => entry.th.length > 0 || entry.en.length > 0);
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = areaKey(candidate);
    if (!normalized) continue;
    const found = normalizedAreas.find(
      (entry) => entry.th === normalized || entry.en === normalized,
    );
    if (found) return found.area;
  }
  return undefined;
}

/**
 * Reads the province code out of a Nominatim `ISO3166-2-lvl4` value such as
 * "TH-10". Thai province codes in the seed are the same two digit numbers.
 */
export function provinceCodeFromIso(value: string | undefined | null): string | undefined {
  const match = /^TH-(\d{2})$/iu.exec(value?.trim() ?? '');
  return match?.[1];
}

/** Address fields that can hold the province, most reliable first. */
export function provinceCandidates(address: Record<string, string | undefined>) {
  return [address.province, address.state, address.city, address.town, address.municipality];
}

/** Address fields that can hold an amphoe/khet, most reliable first. */
export function districtCandidates(address: Record<string, string | undefined>) {
  return [
    address.county,
    address.district,
    address.suburb,
    address.city_district,
    address.municipality,
    address.town,
  ];
}
