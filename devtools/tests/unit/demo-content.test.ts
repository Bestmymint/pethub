import { describe, expect, it } from 'vitest';

import { buildDemoContent, type DemoRefs } from '@/features/demo/demo-content';
import { MEMBER_PETS } from '@/features/demo/demo-pets';
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
  demoUser2Id: 'real-demo-user-2',
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

  it('gives each sign-in user notifications, the first one of several types', () => {
    const forUser = content.notifications.filter((n) => n.userId === 'real-demo-user');
    expect(new Set(forUser.map((n) => n.type)).size).toBeGreaterThanOrEqual(4);
    expect(
      content.notifications.filter((n) => n.userId === 'real-demo-user-2').length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      content.notifications.every((n) => ['real-demo-user', 'real-demo-user-2'].includes(n.userId)),
    ).toBe(true);
  });

  it('puts the two sign-in users together in Meetups where they can really talk', () => {
    const membersOf = (meetupId: string) =>
      new Set(content.members.filter((m) => m.meetupId === meetupId).map((m) => m.userId));
    const together = content.meetups.filter((meetup) => {
      const members = membersOf(meetup.id as string);
      return members.has('real-demo-user') && members.has('real-demo-user-2');
    });
    expect(together.length).toBeGreaterThanOrEqual(3);
    // At least one open Meetup is hosted by each of them, with the other as a member.
    const hostedBy = (userId: string) =>
      content.meetups.filter(
        (m) => m.hostId === userId && m.status === 'OPEN' && (m.startsAt as Date) > now,
      );
    expect(hostedBy('real-demo-user').length).toBeGreaterThanOrEqual(1);
    expect(hostedBy('real-demo-user-2').length).toBeGreaterThanOrEqual(1);
    for (const meetup of hostedBy('real-demo-user'))
      expect(membersOf(meetup.id as string).has('real-demo-user-2')).toBe(true);
    for (const meetup of hostedBy('real-demo-user-2'))
      expect(membersOf(meetup.id as string).has('real-demo-user')).toBe(true);
  });

  it('keeps one membership per person and Meetup', () => {
    const pairs = content.members.map((m) => `${m.meetupId}:${m.userId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('gives every made-up member their pets, owned by that member and marked as demo data', () => {
    expect(content.pets).toHaveLength(MEMBER_PETS.flat().length);
    const owners = new Set(content.pets.map((pet) => pet.ownerId));
    expect(owners).toEqual(new Set(content.users.map((user) => user.id)));
    expect(content.pets.every((pet) => pet.id!.startsWith('demo_pet_'))).toBe(true);
    expect(new Set(content.pets.map((pet) => pet.id)).size).toBe(content.pets.length);
  });
});

describe('buildDemoContent edge cases', () => {
  it('leaves out the second user’s rows and its hosted Meetup until that account is seeded', () => {
    const content = buildDemoContent(refs({ demoUser2Id: null }));
    const everyUserId = [
      ...content.members.map((m) => m.userId),
      ...content.reviews.map((r) => r.userId),
      ...content.notifications.map((n) => n.userId),
      ...content.meetups.map((m) => m.hostId),
      ...content.messages.map((m) => m.authorId),
    ];
    expect(everyUserId).not.toContain('real-demo-user-2');
    expect(content.meetups.map((m) => m.id)).not.toContain('demo_meetup_6');
    expect(content.meetups.map((m) => m.id)).toContain('demo_meetup_5');
  });

  it('never replies to a message that was left out', () => {
    for (const refsCase of [
      refs({ demoUser2Id: null }),
      refs({ demoUserId: null }),
      refs({ demoUserId: null, demoUser2Id: null }),
    ]) {
      const content = buildDemoContent(refsCase);
      const ids = new Set(content.messages.map((message) => message.id));
      for (const message of content.messages)
        if (message.replyToId) expect(ids.has(message.replyToId), String(message.id)).toBe(true);
    }
  });

  it('gives every row the same id whether or not the second user exists yet, so a later run only adds', () => {
    const before = buildDemoContent(refs({ demoUser2Id: null }));
    const after = buildDemoContent(refs());
    const sameRows = <T extends { id?: string | null }>(a: T[], b: T[]) => {
      const byId = new Map(b.map((row) => [row.id, row]));
      for (const row of a) expect(byId.get(row.id), String(row.id)).toEqual(row);
    };
    sameRows(before.meetups, after.meetups);
    sameRows(before.members, after.members);
    // A reply to a message that was left out has no reply link; a later run does not add it (insert-if-missing).
    const withoutReplyLink = (rows: typeof before.messages) =>
      rows.map(({ replyToId, ...rest }) => (void replyToId, rest));
    sameRows(withoutReplyLink(before.messages), withoutReplyLink(after.messages));
    sameRows(before.reviews, after.reviews);
    sameRows(before.notifications, after.notifications);
    expect(after.members.length).toBeGreaterThan(before.members.length);
  });

  it('skips a Meetup whose host account is missing but keeps numbering stable', () => {
    const without = buildDemoContent(refs({ demoUserId: null, demoUser2Id: null }));
    expect(without.meetups.map((m) => m.id)).not.toContain('demo_meetup_5');
    expect(without.meetups.map((m) => m.id)).not.toContain('demo_meetup_6');
    expect(without.meetups).toHaveLength(4);
  });

  it('still works without the demo user account, leaving out its rows', () => {
    const content = buildDemoContent(refs({ demoUserId: null, demoUser2Id: null }));
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
