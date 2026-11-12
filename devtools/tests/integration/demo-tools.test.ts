import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const auth = vi.hoisted(() => ({ adminId: '', allowed: true }));
vi.mock('@/lib/auth-guards', () => ({
  requireAdmin: async () => {
    if (!auth.allowed) throw new Error('NEXT_REDIRECT: not an admin');
    return { user: { id: auth.adminId, role: 'ADMIN' } };
  },
}));
const storage = vi.hoisted(() => ({
  put: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
}));
vi.mock('@/lib/object-storage', () => ({ putObject: storage.put, deleteObject: storage.remove }));

import { createDemoDataAction, deleteDemoDataAction } from '@/features/admin/demo-actions';
import { DEMO_AUDIT, demoImageKey, demoIdPrefix } from '@/features/demo/demo-config';
import { createDemoData, deleteDemoData, type DemoDeps } from '@/features/demo/demo-service';
import { MAX_PINNED_MESSAGES } from '@/features/meetups/chat-pins';
import { prisma } from '@/lib/prisma';
import { recomputePlaceRating } from '@/lib/place-rating';
import { createPublicPlaceFixture } from '../helpers/place-fixture';

describe('Admin demo-data tools', () => {
  const prefix = `demo-tools-${randomUUID()}`;
  const ids = {
    admin: `${prefix}-admin`,
    demoUser: `${prefix}-demo-user`,
    realUser: `${prefix}-real`,
  };
  const demoUserEmail = `${ids.demoUser}@pawmap.local`;
  const placeIds: string[] = [];
  let realMeetupId = '';
  let realReviewId = '';
  let realNotificationId = '';
  const fixed = { rating: 4.2, count: 7 };

  const deps = (overrides: Partial<DemoDeps> = {}): DemoDeps => ({
    db: prisma,
    now: new Date(),
    actorId: ids.admin,
    storage: { put: storage.put, remove: storage.remove },
    renderImage: async () => new Uint8Array([137, 80, 78, 71]),
    demoUserEmail,
    ...overrides,
  });

  const demoRowCounts = async () => ({
    users: await prisma.user.count({ where: { id: { startsWith: demoIdPrefix('user') } } }),
    meetups: await prisma.meetup.count({ where: { id: { startsWith: demoIdPrefix('meetup') } } }),
    members: await prisma.meetupMember.count({
      where: { id: { startsWith: demoIdPrefix('member') } },
    }),
    messages: await prisma.meetupMessage.count({
      where: { id: { startsWith: demoIdPrefix('msg') } },
    }),
    reviews: await prisma.review.count({ where: { id: { startsWith: demoIdPrefix('review') } } }),
    submissions: await prisma.submission.count({
      where: { id: { startsWith: demoIdPrefix('sub') } },
    }),
    notifications: await prisma.notification.count({
      where: { id: { startsWith: demoIdPrefix('notif') } },
    }),
    meetupReports: await prisma.meetupReport.count({
      where: { id: { startsWith: demoIdPrefix('mreport') } },
    }),
    placeReports: await prisma.report.count({
      where: { id: { startsWith: demoIdPrefix('report') } },
    }),
  });
  const total = (counts: object) =>
    Object.values(counts).reduce((sum: number, value) => sum + Number(value), 0);

  /** What the real (non-demo) rows look like; must be identical before and after create + delete. */
  const realSnapshot = async () => ({
    users: await prisma.user.findMany({
      where: { id: { in: Object.values(ids) } },
      orderBy: { id: 'asc' },
    }),
    places: await prisma.place.findMany({
      where: { id: { in: placeIds } },
      select: { id: true, nameTh: true, deletedAt: true, isVisible: true },
      orderBy: { id: 'asc' },
    }),
    meetup: await prisma.meetup.findUnique({ where: { id: realMeetupId } }),
    review: await prisma.review.findUnique({ where: { id: realReviewId } }),
    notification: await prisma.notification.findUnique({ where: { id: realNotificationId } }),
  });

  beforeAll(async () => {
    for (let index = 0; index < 8; index += 1) {
      const place = await createPublicPlaceFixture(prisma, `${prefix}-p${index}`);
      placeIds.push(place.id);
    }
    await prisma.user.createMany({
      data: [
        {
          id: ids.admin,
          name: `${prefix} admin`,
          email: `${ids.admin}@pawmap.local`,
          role: 'ADMIN',
        },
        { id: ids.demoUser, name: `${prefix} demo user`, email: demoUserEmail },
        { id: ids.realUser, name: `${prefix} real user`, email: `${ids.realUser}@pawmap.local` },
      ],
    });
    // A real meetup, review and notification that the tools must never touch.
    realMeetupId = (
      await prisma.meetup.create({
        data: {
          title: `${prefix} real meetup`,
          description: 'A real meetup that is not demo data.',
          startsAt: new Date(Date.now() + 86_400_000),
          endsAt: new Date(Date.now() + 90_000_000),
          maxMembers: 5,
          hostId: ids.realUser,
          placeId: placeIds[7]!,
          members: { create: [{ userId: ids.realUser }] },
          messages: { create: [{ authorId: ids.realUser, kind: 'TEXT', text: 'real message' }] },
        },
      })
    ).id;
    realReviewId = (
      await prisma.review.create({
        data: {
          userId: ids.realUser,
          placeId: placeIds[0]!,
          rating: 2,
          cleanlinessRating: 2,
          convenienceRating: 2,
          petFriendlinessRating: 2,
          content: 'A real review that is not demo data.',
        },
      })
    ).id;
    await recomputePlaceRating(prisma, placeIds[0]!);
    realNotificationId = (
      await prisma.notification.create({
        data: {
          userId: ids.demoUser,
          type: 'SYSTEM',
          titleTh: 'จริง',
          titleEn: 'Real',
          bodyTh: 'ไม่ใช่ข้อมูลตัวอย่าง',
          bodyEn: 'Not demo data',
        },
      })
    ).id;
    // The eighth place has no demo review; its rating must stay exactly as it is.
    await prisma.place.update({
      where: { id: placeIds[7]! },
      data: { averageRating: fixed.rating, reviewCount: fixed.count },
    });
  });

  beforeEach(() => {
    storage.put.mockClear();
    storage.remove.mockClear();
    auth.allowed = true;
    auth.adminId = ids.admin;
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await deleteDemoData(deps());
    await prisma.auditLog.deleteMany({ where: { actorId: ids.admin } });
    await prisma.meetup.deleteMany({ where: { id: realMeetupId } });
    await prisma.review.deleteMany({ where: { userId: ids.realUser } });
    await prisma.notification.deleteMany({ where: { userId: ids.demoUser } });
    await prisma.place.deleteMany({ where: { id: { in: placeIds } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await prisma.$disconnect();
  });

  it('is safe to delete when nothing exists', async () => {
    const before = await realSnapshot();
    const counts = await deleteDemoData(deps());
    expect(total(counts)).toBe(0);
    expect(await realSnapshot()).toEqual(before);
  });

  it('creates realistic content across every feature, within the pin limit', async () => {
    const counts = await createDemoData(deps());
    // The two chat photos are stored under their fixed keys.
    const stored = storage.put.mock.calls.map((call) => (call as unknown as [string])[0]);
    expect(stored).toEqual([demoImageKey(1), demoImageKey(2)]);
    for (const [kind, count] of Object.entries(counts)) expect(count, kind).toBeGreaterThan(0);
    expect(await demoRowCounts()).toEqual(counts);

    const meetups = await prisma.meetup.findMany({
      where: { id: { startsWith: demoIdPrefix('meetup') } },
      select: {
        id: true,
        status: true,
        startsAt: true,
        _count: { select: { messages: { where: { pinnedAt: { not: null } } } } },
      },
    });
    expect(
      meetups.filter((m) => m.status === 'OPEN' && m.startsAt > new Date()).length,
    ).toBeGreaterThanOrEqual(3);
    expect(Math.max(...meetups.map((m) => m._count.messages))).toBeLessThanOrEqual(
      MAX_PINNED_MESSAGES,
    );
    expect(meetups.some((m) => m._count.messages > 0)).toBe(true);

    const reportTargets = await prisma.meetupReport.groupBy({
      by: ['target'],
      where: { id: { startsWith: demoIdPrefix('mreport') }, status: 'OPEN' },
      _count: true,
    });
    expect(reportTargets.map((t) => t.target).sort()).toEqual([
      'IMAGE',
      'MEETUP',
      'MESSAGE',
      'USER',
    ]);
    expect(reportTargets.every((t) => t._count >= 2)).toBe(true);

    // The demo user account gets to see its own content.
    expect(
      await prisma.meetupMember.count({
        where: { userId: ids.demoUser, id: { startsWith: 'demo_' } },
      }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.submission.count({
        where: { submitterId: ids.demoUser, id: { startsWith: 'demo_' } },
      }),
    ).toBeGreaterThan(0);
  });

  it('recomputes the rating and count of every place that got demo reviews', async () => {
    const reviewed = await prisma.place.findMany({
      where: { id: { in: placeIds.slice(0, 7) }, reviewCount: { gt: 0 } },
    });
    expect(reviewed.length).toBeGreaterThanOrEqual(5);
    for (const place of reviewed) {
      const aggregate = await prisma.review.aggregate({
        where: { placeId: place.id, isHidden: false, deletedAt: null },
        _avg: { rating: true },
        _count: true,
      });
      expect(place.reviewCount).toBe(aggregate._count);
      expect(place.averageRating).toBeCloseTo(aggregate._avg.rating ?? 0, 5);
    }
    // The real review is counted together with the demo ones on the first place.
    const first = await prisma.place.findUniqueOrThrow({ where: { id: placeIds[0]! } });
    expect(first.reviewCount).toBeGreaterThan(1);
    // A place without any demo review is left exactly as it was.
    const untouched = await prisma.place.findUniqueOrThrow({ where: { id: placeIds[7]! } });
    expect(untouched.averageRating).toBe(fixed.rating);
    expect(untouched.reviewCount).toBe(fixed.count);
  });

  it('is idempotent: running create again adds nothing', async () => {
    const before = await demoRowCounts();
    const second = await createDemoData(deps());
    expect(total(second)).toBe(0);
    expect(await demoRowCounts()).toEqual(before);
    expect(
      await prisma.auditLog.count({ where: { actorId: ids.admin, action: DEMO_AUDIT.create } }),
    ).toBe(2);
  });

  it('delete removes only marked rows and leaves everything real untouched', async () => {
    const real = await realSnapshot();
    const created = await demoRowCounts();
    const deleted = await deleteDemoData(deps());
    expect(deleted).toEqual(created);
    const removed = storage.remove.mock.calls.map((call) => (call as unknown as [string])[0]);
    expect(removed.sort()).toEqual([demoImageKey(1), demoImageKey(2)].sort());
    expect(total(await demoRowCounts())).toBe(0);

    // Real rows, the demo accounts and the places are exactly as before (users keep their updatedAt).
    expect(await realSnapshot()).toEqual(real);
    expect(await prisma.meetupMessage.count({ where: { meetupId: realMeetupId } })).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: ids.demoUser } })).not.toBeNull();
    expect(
      await prisma.user.count({ where: { email: { endsWith: '@demo.pawmap.invalid' } } }),
    ).toBe(0);
  });

  it('puts ratings back to what the remaining reviews say', async () => {
    const first = await prisma.place.findUniqueOrThrow({ where: { id: placeIds[0]! } });
    expect(first.reviewCount).toBe(1);
    expect(first.averageRating).toBe(2);
    const others = await prisma.place.findMany({ where: { id: { in: placeIds.slice(1, 7) } } });
    expect(others.every((place) => place.reviewCount === 0 && place.averageRating === 0)).toBe(
      true,
    );
    const untouched = await prisma.place.findUniqueOrThrow({ where: { id: placeIds[7]! } });
    expect([untouched.averageRating, untouched.reviewCount]).toEqual([fixed.rating, fixed.count]);
  });

  it('can create again after a delete, and records every run in the audit log', async () => {
    const counts = await createDemoData(deps());
    expect(total(counts)).toBeGreaterThan(0);
    await deleteDemoData(deps());
    expect(
      await prisma.auditLog.count({ where: { actorId: ids.admin, action: DEMO_AUDIT.create } }),
    ).toBe(3);
    expect(
      await prisma.auditLog.count({ where: { actorId: ids.admin, action: DEMO_AUDIT.delete } }),
    ).toBe(3);
    const last = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: ids.admin, action: DEMO_AUDIT.delete },
      orderBy: { createdAt: 'desc' },
    });
    expect(last).toMatchObject({ entityType: 'DemoData', entityId: 'demo' });
  });

  describe('server actions', () => {
    it('refuse when the flag is off, even for an admin, and change nothing', async () => {
      for (const value of [undefined, '', 'false', 'TRUE']) {
        if (value === undefined) vi.stubEnv('DEMO_TOOLS_ENABLED', '');
        else vi.stubEnv('DEMO_TOOLS_ENABLED', value);
        expect(await createDemoDataAction()).toMatchObject({ ok: false });
        expect(await deleteDemoDataAction()).toMatchObject({ ok: false });
      }
      expect(total(await demoRowCounts())).toBe(0);
    });

    it('refuse a user who is not an admin, even with the flag on', async () => {
      vi.stubEnv('DEMO_TOOLS_ENABLED', 'true');
      auth.allowed = false;
      await expect(createDemoDataAction()).rejects.toThrow('NEXT_REDIRECT');
      await expect(deleteDemoDataAction()).rejects.toThrow('NEXT_REDIRECT');
      expect(total(await demoRowCounts())).toBe(0);
    });

    it('work for an admin with the flag on, and report counts for the toast', async () => {
      vi.stubEnv('DEMO_TOOLS_ENABLED', 'true');
      vi.stubEnv('SEED_USER_EMAIL', demoUserEmail);
      const created = await createDemoDataAction();
      expect(created).toMatchObject({ ok: true });
      if (created.ok) {
        expect(created.data.message).toContain('สร้างข้อมูลตัวอย่างแล้ว');
        expect(created.data.counts.meetups).toBeGreaterThan(0);
      }
      const again = await createDemoDataAction();
      if (again.ok) expect(again.data.message).toContain('ครบอยู่แล้ว');
      const deleted = await deleteDemoDataAction();
      expect(deleted).toMatchObject({ ok: true });
      if (deleted.ok) expect(deleted.data.message).toContain('ลบข้อมูลตัวอย่างแล้ว');
      expect(total(await demoRowCounts())).toBe(0);
    });
  });
});
