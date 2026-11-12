import { describe, expect, it } from 'vitest';

import { buildDemoContent, type DemoRefs } from '@/features/demo/demo-content';
import { isDemoId } from '@/features/demo/demo-config';
import { MAX_PINNED_MESSAGES } from '@/features/meetups/chat-pins';

const now = new Date('2026-11-12T10:00:00Z');
const places = Array.from({ length: 8 }, (_, index) => ({
  id: `place-${index}`,
  nameTh: `สถานที่ ${index}`,
}));
const refs = (overrides: Partial<DemoRefs> = {}): DemoRefs => ({
  now,
  places,
  provinceId: 'province-1',
  categoryId: 'category-1',
  demoUserId: 'real-demo-user',
  ...overrides,
});

describe('buildDemoContent', () => {
  const content = buildDemoContent(refs());

  it('gives every row an id with the demo_ marker, and no id twice', () => {
    const groups = [
      content.users,
      content.meetups,
      content.members,
      content.messages,
      content.reviews,
      content.submissions,
      content.notifications,
      content.meetupReports,
      content.placeReports,
    ];
    for (const rows of groups) {
      const ids = rows.map((row) => String(row.id));
      expect(ids.every(isDemoId)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('creates members that can never log in or receive mail', () => {
    expect(content.users).toHaveLength(6);
    expect(content.users.every((user) => user.email.endsWith('.invalid'))).toBe(true);
    expect(content.users.every((user) => user.role === undefined)).toBe(true);
  });

  it('plans Meetups in the next days plus one that has finished', () => {
    const upcoming = content.meetups.filter((m) => m.status === 'OPEN');
    expect(upcoming.length).toBeGreaterThanOrEqual(3);
    for (const meetup of upcoming) {
      expect((meetup.startsAt as Date).getTime()).toBeGreaterThan(now.getTime());
      expect((meetup.startsAt as Date).getTime()).toBeLessThan(now.getTime() + 8 * 86_400_000);
      expect((meetup.endsAt as Date).getTime()).toBeGreaterThan(
        (meetup.startsAt as Date).getTime(),
      );
    }
    const finished = content.meetups.find((m) => m.status === 'COMPLETED');
    expect((finished?.endsAt as Date).getTime()).toBeLessThan(now.getTime());
  });

  it('seats every host as a member and never overfills a Meetup', () => {
    for (const meetup of content.meetups) {
      const seated = content.members.filter((member) => member.meetupId === meetup.id);
      expect(seated.map((m) => m.userId)).toContain(meetup.hostId);
      expect(seated.length).toBeLessThanOrEqual(meetup.maxMembers);
    }
  });

  it('writes chat in the past, with pins within the limit and replies that point at earlier messages', () => {
    expect(content.messages.every((m) => (m.createdAt as Date) <= now)).toBe(true);
    const pinned = content.messages.filter((m) => m.pinnedAt);
    expect(pinned.length).toBeGreaterThanOrEqual(2);
    for (const meetup of content.meetups) {
      const count = pinned.filter((m) => m.meetupId === meetup.id).length;
      expect(count).toBeLessThanOrEqual(MAX_PINNED_MESSAGES);
    }
    const byId = new Map(content.messages.map((m) => [m.id, m]));
    for (const reply of content.messages.filter((m) => m.replyToId)) {
      const target = byId.get(reply.replyToId!);
      expect(target?.meetupId).toBe(reply.meetupId);
      expect((target!.createdAt as Date) <= (reply.createdAt as Date)).toBe(true);
    }
  });

  it('stores a photo for each photo message and for each image report', () => {
    const keys = content.images.map((image) => image.key);
    expect(keys).toHaveLength(2);
    const messageKeys = content.messages.flatMap((m) => (m.objectKey ? [m.objectKey] : []));
    expect(messageKeys.sort()).toEqual([...keys].sort());
    const imageReports = content.meetupReports.filter((r) => r.target === 'IMAGE');
    expect(imageReports.map((r) => r.targetId).sort()).toEqual([...keys].sort());
  });

  it('reviews with valid ratings and text, in the past, once per member and place', () => {
    expect(content.reviews.length).toBeGreaterThanOrEqual(10);
    const pairs = new Set<string>();
    for (const review of content.reviews) {
      for (const value of [
        review.rating,
        review.cleanlinessRating,
        review.convenienceRating,
        review.petFriendlinessRating,
      ]) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(5);
      }
      expect(review.content.length).toBeGreaterThanOrEqual(10);
      expect((review.createdAt as Date) <= now).toBe(true);
      pairs.add(`${review.userId}:${review.placeId}`);
    }
    expect(pairs.size).toBe(content.reviews.length);
  });

  it('covers several submission statuses with an admin message where one is needed', () => {
    const statuses = new Set(content.submissions.map((s) => s.status));
    for (const status of ['DRAFT', 'PENDING', 'NEEDS_REVISION', 'REJECTED'] as const)
      expect(statuses.has(status)).toBe(true);
    for (const s of content.submissions.filter(
      (x) => x.status === 'NEEDS_REVISION' || x.status === 'REJECTED',
    ))
      expect(s.adminMessage).toBeTruthy();
  });

  it('has open reports of every Meetup report target, at least two of each, that point at real rows', () => {
    const messageIds = new Set(content.messages.map((m) => m.id));
    const userIds = new Set(content.users.map((u) => u.id));
    const meetupIds = new Set(content.meetups.map((m) => m.id));
    for (const target of ['MEETUP', 'USER', 'MESSAGE', 'IMAGE'] as const)
      expect(
        content.meetupReports.filter((r) => r.target === target).length,
      ).toBeGreaterThanOrEqual(2);
    for (const report of content.meetupReports) {
      expect(report.status).toBeUndefined(); // database default: OPEN
      if (report.target === 'MESSAGE') expect(messageIds.has(report.targetId)).toBe(true);
      if (report.target === 'USER') expect(userIds.has(report.targetId)).toBe(true);
      if (report.target === 'MEETUP') expect(meetupIds.has(report.targetId)).toBe(true);
    }
    expect(content.placeReports.length).toBeGreaterThanOrEqual(2);
  });

  it('gives the demo user notifications of several types', () => {
    expect(content.notifications.every((n) => n.userId === 'real-demo-user')).toBe(true);
    expect(new Set(content.notifications.map((n) => n.type)).size).toBeGreaterThanOrEqual(4);
  });
});

describe('buildDemoContent edge cases', () => {
  it('still works without the demo user account, leaving out its rows', () => {
    const content = buildDemoContent(refs({ demoUserId: null }));
    expect(content.notifications).toHaveLength(0);
    expect(content.members.every((m) => m.userId.startsWith('demo_user_'))).toBe(true);
    expect(content.reviews.every((r) => r.userId.startsWith('demo_user_'))).toBe(true);
    expect(content.messages.every((m) => !m.authorId || m.authorId.startsWith('demo_user_'))).toBe(
      true,
    );
  });

  it('works with a single place', () => {
    const content = buildDemoContent(refs({ places: [places[0]!] }));
    expect(content.meetups.every((m) => m.placeId === 'place-0')).toBe(true);
  });

  it('refuses to build without any place', () => {
    expect(() => buildDemoContent(refs({ places: [] }))).toThrow('DEMO_NO_PLACES');
  });

  it('is deterministic for the same moment, which is what makes a second run a no-op', () => {
    expect(buildDemoContent(refs())).toEqual(buildDemoContent(refs()));
  });
});
