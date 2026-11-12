/**
 * Decides how a reverse-geocode answer changes the province/district dropdowns.
 *
 * Pure so it can be tested: the form passes the values that are current when
 * the answer arrives (read from refs), never the values captured when the
 * request started.
 */

export interface ReverseAreaResult {
  province: { code: string } | null;
  district: { code: string } | null;
}

export type AreaUpdate =
  /** No province matched: leave both dropdowns alone. */
  | { kind: 'none' }
  /**
   * The province is already selected. Its district list is never cleared;
   * `districtCode` selects a district now, `pendingDistrict` selects it once the
   * list (still loading) arrives, and neither means "keep the current choice".
   */
  | { kind: 'same-province'; districtCode?: string; pendingDistrict?: string }
  /** Switch province; the district is applied after its list loads. */
  | { kind: 'new-province'; provinceCode: string; pendingDistrict?: string };

export function planAreaUpdate(
  currentProvinceCode: string,
  loadedDistrictCodes: readonly string[],
  result: ReverseAreaResult,
): AreaUpdate {
  if (!result.province) return { kind: 'none' };
  const districtCode = result.district?.code;
  if (result.province.code !== currentProvinceCode)
    return {
      kind: 'new-province',
      provinceCode: result.province.code,
      pendingDistrict: districtCode,
    };
  if (!districtCode) return { kind: 'same-province' };
  if (loadedDistrictCodes.length === 0)
    return { kind: 'same-province', pendingDistrict: districtCode };
  return loadedDistrictCodes.includes(districtCode)
    ? { kind: 'same-province', districtCode }
    : { kind: 'same-province' };
}
