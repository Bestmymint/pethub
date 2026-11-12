import { describe, expect, it } from 'vitest';

import {
  DEMO_EMAIL_DOMAIN,
  bangkokTime,
  demoId,
  demoIdPrefix,
  demoImageKey,
  demoToolsEnabled,
  emptyDemoCounts,
  formatDemoCounts,
  hoursAgo,
  isDemoId,
} from '@/features/demo/demo-config';

describe('demo ids', () => {
  it('marks every id with the demo_ prefix and keeps kinds apart', () => {
    expect(demoId('meetup', 3)).toBe('demo_meetup_3');
    expect(demoIdPrefix('msg')).toBe('demo_msg_');
    expect(isDemoId(demoId('review', 1))).toBe(true);
    expect(isDemoId('clx9a8b7c0000abcd')).toBe(false);
    expect(isDemoId('my_demo_review')).toBe(false);
  });

  it('builds photo keys the media route accepts, and different per photo', () => {
    const route = /^meetup_[a-f0-9-]+\.(jpg|png|webp)$/u;
    expect(demoImageKey(1)).toMatch(route);
    expect(demoImageKey(2)).toMatch(route);
    expect(demoImageKey(1)).not.toBe(demoImageKey(2));
  });

  it('uses a reserved e-mail domain that can never receive mail', () => {
    expect(DEMO_EMAIL_DOMAIN.endsWith('.invalid')).toBe(true);
  });
});

describe('demoToolsEnabled', () => {
  it('is on only for the exact string "true"', () => {
    expect(demoToolsEnabled({ DEMO_TOOLS_ENABLED: 'true' })).toBe(true);
    for (const value of [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', ' true'])
      expect(demoToolsEnabled({ DEMO_TOOLS_ENABLED: value })).toBe(false);
    expect(demoToolsEnabled({})).toBe(false);
  });
});

describe('formatDemoCounts', () => {
  it('lists only the kinds that changed', () => {
    const counts = { ...emptyDemoCounts(), meetups: 4, reviews: 12 };
    expect(formatDemoCounts(counts, 'created')).toBe(
      'สร้างข้อมูลตัวอย่างแล้ว: Meetup 4 · รีวิว 12',
    );
    expect(formatDemoCounts(counts, 'deleted')).toBe('ลบข้อมูลตัวอย่างแล้ว: Meetup 4 · รีวิว 12');
  });

  it('says so when there was nothing to do', () => {
    expect(formatDemoCounts(emptyDemoCounts(), 'created')).toContain('ครบอยู่แล้ว');
    expect(formatDemoCounts(emptyDemoCounts(), 'deleted')).toContain('ไม่มีข้อมูลตัวอย่างให้ลบ');
  });
});

describe('relative dates', () => {
  const now = new Date('2026-11-12T20:00:00Z'); // 03:00 on 13 November in Bangkok

  it('puts a time N days away at the given Bangkok hour', () => {
    expect(bangkokTime(now, 2, 8).toISOString()).toBe('2026-11-15T01:00:00.000Z');
    expect(bangkokTime(now, 0, 9).toISOString()).toBe('2026-11-13T02:00:00.000Z');
    expect(bangkokTime(now, -5, 9).toISOString()).toBe('2026-11-08T02:00:00.000Z');
  });

  it('counts back in hours', () => {
    expect(hoursAgo(now, 48).toISOString()).toBe('2026-11-10T20:00:00.000Z');
  });
});
