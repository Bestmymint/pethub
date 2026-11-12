import { describe, expect, it } from 'vitest';

import { planAreaUpdate } from '@/features/submissions/area-lookup';

const answer = (province: string | null, district: string | null = null) => ({
  province: province ? { code: province } : null,
  district: district ? { code: district } : null,
});

describe('planAreaUpdate', () => {
  it('leaves the dropdowns alone when no province matched', () => {
    expect(planAreaUpdate('10', ['1001'], answer(null))).toEqual({ kind: 'none' });
  });

  it('switches province and defers the district until its list loads', () => {
    expect(planAreaUpdate('10', ['1001'], answer('50', '5001'))).toEqual({
      kind: 'new-province',
      provinceCode: '50',
      pendingDistrict: '5001',
    });
    expect(planAreaUpdate('', [], answer('50'))).toEqual({
      kind: 'new-province',
      provinceCode: '50',
      pendingDistrict: undefined,
    });
  });

  it('selects the district directly when the province is already chosen and loaded', () => {
    expect(planAreaUpdate('10', ['1001', '1002'], answer('10', '1002'))).toEqual({
      kind: 'same-province',
      districtCode: '1002',
    });
  });

  it('never clears the list or the chosen district for the already-selected province', () => {
    // No district in the answer, or one that is not in the loaded list: keep the user's choice.
    expect(planAreaUpdate('10', ['1001'], answer('10'))).toEqual({ kind: 'same-province' });
    expect(planAreaUpdate('10', ['1001'], answer('10', '9999'))).toEqual({
      kind: 'same-province',
    });
  });

  it('waits for a district list that is still loading instead of dropping the match', () => {
    // The user picked this province by hand while the lookup was in flight.
    expect(planAreaUpdate('50', [], answer('50', '5001'))).toEqual({
      kind: 'same-province',
      pendingDistrict: '5001',
    });
  });

  it('decides from the values passed at answer time, not when the lookup started', () => {
    // Started with no province; by the time the answer arrives the user chose 50.
    const atStart = planAreaUpdate('', [], answer('50', '5001'));
    const atAnswer = planAreaUpdate('50', ['5001'], answer('50', '5001'));
    expect(atStart.kind).toBe('new-province');
    expect(atAnswer).toEqual({ kind: 'same-province', districtCode: '5001' });
  });
});
