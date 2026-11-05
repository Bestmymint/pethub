import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ userId: '' }));
vi.mock('@/lib/auth-guards', () => ({
  getCurrentSession: async () => ({ user: { id: session.userId, suspendedAt: null } }),
}));

import { GET as lookupPlaces } from '@/app/api/meetups/places/route';
import { GET as readMeetupMedia } from '@/app/api/meetups/media/[key]/route';
import {
  createMeetup,
  updateMeetup,
  joinMeetup,
  decideMeetupJoinRequest,
} from '@/features/meetups/actions';
import { getMeetupMemberProfile } from '@/features/meetups/member-profile';
import { searchMeetups, searchMeetupSchema } from '@/features/meetups/service';
import { findPublicMapPoints } from '@/lib/place-repository';
import { prisma } from '@/lib/prisma';
import { putObject, deleteObject } from '@/lib/object-storage';
import { createPublicPlaceFixture } from '../helpers/place-fixture';

const prefix = `members-places-${randomUUID()}`;
const users = {
  host: `${prefix}-host`,
  member: `${prefix}-member`,
  empty: `${prefix}-empty`,
  outsider: `${prefix}-outsider`,
  admin: `${prefix}-admin`,
};
const places = { stale: '', verified: '', hidden: '', pending: '', deleted: '' };
let meetupId = '';
const input = (placeId: string) => ({
  title: prefix,
  description: 'Temporary integration fixture for map places and member profiles.',
  placeId,
  startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  endsAt: new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString(),
  maxMembers: 8,
});

beforeAll(async () => {
  await prisma.user.createMany({
    data: Object.entries(users).map(([role, id]) => ({
      id,
      name: role,
      email: `${id}@example.invalid`,
      role: role === 'admin' ? 'ADMIN' : 'USER',
    })),
  });
  for (const kind of ['stale', 'verified', 'hidden', 'pending', 'deleted'] as const) {
    const place = await createPublicPlaceFixture(prisma, `${prefix}-${kind}`);
    places[kind] = place.id;
    await prisma.place.update({
      where: { id: place.id },
      data: {
        status: kind === 'pending' ? 'PENDING' : kind === 'verified' ? 'VERIFIED' : 'STALE',
        isVisible: kind !== 'hidden',
        deletedAt: kind === 'deleted' ? new Date() : null,
      },
    });
  }
  session.userId = users.host;
  const created = await createMeetup(input(places.stale));
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error(JSON.stringify(created));
  meetupId = created.data!.id;
  await prisma.meetupMember.createMany({
    data: (['member', 'empty'] as const).map((role) => ({ meetupId, userId: users[role] })),
  });
  await prisma.pet.create({
    data: {
      ownerId: users.member,
      name: 'Milo',
      species: 'dog',
      breed: 'Golden Retriever',
      sex: 'male',
      color: 'sage',
      notes: 'PRIVATE-PET-NOTE',
      weight: 9,
      birthday: new Date('2024-01-01'),
      records: {
        create: { category: 'note', title: 'PRIVATE-HEALTH', date: new Date('2025-01-01') },
      },
      careLogs: { create: { task: 'breakfast', date: new Date('2025-01-01') } },
    },
  });
  await prisma.pet.createMany({
    data: [
      { ownerId: users.member, name: 'Archived pet', species: 'cat', archivedAt: new Date() },
      { ownerId: users.outsider, name: 'Unrelated pet', species: 'cat' },
    ],
  });
});

afterAll(async () => {
  const ids = (
    await prisma.meetup.findMany({ where: { hostId: users.host }, select: { id: true } })
  ).map((m) => m.id);
  await prisma.auditLog.deleteMany({ where: { entityType: 'Meetup', entityId: { in: ids } } });
  await prisma.meetup.deleteMany({ where: { id: { in: ids } } });
  await prisma.place.deleteMany({ where: { id: { in: Object.values(places) } } });
  await prisma.rateLimitBucket.deleteMany({ where: { bucketKey: { in: Object.values(users) } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});

describe('places shared with the map', () => {
  it('serves a public cover at an imported map place and hides it when the place is hidden', async () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('PAWMAP_E2E_OBJECT_STORAGE', 'memory');
    const key = `meetup_${randomUUID()}.png`;
    const read = () =>
      readMeetupMedia(new Request('http://localhost/api/meetups/media/' + key), {
        params: Promise.resolve({ key }),
      });
    try {
      await putObject(key, new Uint8Array([137, 80, 78, 71]), 'image/png');
      await prisma.meetup.update({ where: { id: meetupId }, data: { coverObjectKey: key } });
      const visible = await read();
      expect(visible.status).toBe(200);
      expect(visible.headers.get('content-type')).toBe('image/png');
      await prisma.place.update({ where: { id: places.stale }, data: { isVisible: false } });
      expect((await read()).status).toBe(404);
    } finally {
      await prisma.place.update({ where: { id: places.stale }, data: { isVisible: true } });
      await prisma.meetup.update({ where: { id: meetupId }, data: { coverObjectKey: null } });
      await deleteObject(key);
      vi.unstubAllEnvs();
    }
  });
  it('returns the same visible imported and verified places as the map', async () => {
    const response = await lookupPlaces(
      new NextRequest(`http://localhost/api/meetups/places?q=${prefix}`),
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const { items } = await response.json();
    const map = await findPublicMapPoints({ query: prefix });
    const ids = items.map((p: { id: string }) => p.id).sort();
    expect(ids).toEqual([places.stale, places.verified].sort());
    expect(map.items.map((p) => p.id).sort()).toEqual(ids);
    const defaults = await lookupPlaces(new NextRequest('http://localhost/api/meetups/places'));
    const initial = (await defaults.json()).items;
    expect(initial.length).toBeGreaterThan(0);
    expect(initial.length).toBeLessThanOrEqual(20);
  });

  it('creates, discovers, edits, and approves members at imported places', async () => {
    const discovery = await searchMeetups(searchMeetupSchema.parse({ q: prefix }));
    expect(discovery.items.map((m) => m.id)).toContain(meetupId);
    session.userId = users.host;
    const version = (await prisma.meetup.findUniqueOrThrow({ where: { id: meetupId } })).version;
    expect((await updateMeetup(meetupId, version, input(places.stale))).ok).toBe(true);
    session.userId = users.outsider;
    expect((await joinMeetup(meetupId)).ok).toBe(true);
    const request = await prisma.meetupJoinRequest.findUniqueOrThrow({
      where: { meetupId_userId: { meetupId, userId: users.outsider } },
    });
    session.userId = users.host;
    expect((await decideMeetupJoinRequest(meetupId, request.id, 'APPROVED')).ok).toBe(true);
    await prisma.meetupMember.delete({
      where: { meetupId_userId: { meetupId, userId: users.outsider } },
    });
  });

  it.each(['hidden', 'pending', 'deleted'] as const)(
    'rejects %s places on create and edit',
    async (kind) => {
      session.userId = users.host;
      expect(await createMeetup(input(places[kind]))).toMatchObject({
        ok: false,
        formError: 'MEETUP_PLACE_UNAVAILABLE',
      });
      const { version } = await prisma.meetup.findUniqueOrThrow({ where: { id: meetupId } });
      expect(await updateMeetup(meetupId, version, input(places[kind]))).toMatchObject({
        ok: false,
        formError: 'MEETUP_PLACE_UNAVAILABLE',
      });
    },
  );

  it('rechecks visibility after a place was selected and before host approval', async () => {
    session.userId = users.outsider;
    expect((await joinMeetup(meetupId)).ok).toBe(true);
    const request = await prisma.meetupJoinRequest.findUniqueOrThrow({
      where: { meetupId_userId: { meetupId, userId: users.outsider } },
    });
    await prisma.place.update({ where: { id: places.stale }, data: { isVisible: false } });
    try {
      session.userId = users.host;
      expect(await decideMeetupJoinRequest(meetupId, request.id, 'APPROVED')).toMatchObject({
        ok: false,
        formError: 'MEETUP_PLACE_UNAVAILABLE',
      });
      expect((await searchMeetups(searchMeetupSchema.parse({ q: prefix }))).items).toEqual([]);
      expect(await createMeetup(input(places.stale))).toMatchObject({
        ok: false,
        formError: 'MEETUP_PLACE_UNAVAILABLE',
      });
      session.userId = users.empty;
      expect(await joinMeetup(meetupId)).toMatchObject({
        ok: false,
        formError: 'MEETUP_PLACE_UNAVAILABLE',
      });
    } finally {
      await prisma.place.update({ where: { id: places.stale }, data: { isVisible: true } });
    }
  });
});

describe('member pet profiles', () => {
  const profile = (viewer = users.host, member = users.member, admin = false) =>
    getMeetupMemberProfile(meetupId, member, viewer, admin);

  it('exposes only active pet identity fields to fellow members and valid admins', async () => {
    const member = await profile();
    expect(member?.pets).toHaveLength(1);
    expect(member?.pets[0]).toEqual({
      id: expect.any(String),
      name: 'Milo',
      species: 'dog',
      breed: 'Golden Retriever',
      sex: 'male',
      color: 'sage',
    });
    expect(Object.keys(member!).sort()).toEqual(['id', 'image', 'meetupTitle', 'name', 'pets']);
    expect(await profile(users.admin, users.member, true)).toEqual(member);
    expect((await profile(users.host, users.empty))?.pets).toEqual([]);
  });

  it('rejects outsiders, forged admin claims, unrelated targets, and missing targets', async () => {
    expect(await profile(users.outsider)).toBeNull();
    expect(await profile(users.outsider, users.member, true)).toBeNull();
    expect(await profile(users.host, users.outsider)).toBeNull();
    expect(await profile(users.host, 'missing')).toBeNull();
  });

  it.each(['viewer', 'target'])('respects blocks initiated by the %s', async (direction) => {
    const block = await prisma.userBlock.create({
      data: {
        blockerId: direction === 'viewer' ? users.host : users.member,
        blockedId: direction === 'viewer' ? users.member : users.host,
      },
    });
    try {
      expect(await profile()).toBeNull();
    } finally {
      await prisma.userBlock.delete({ where: { id: block.id } });
    }
  });

  it.each(['host', 'member'] as const)('denies access after %s leaves the group', async (role) => {
    const key = { meetupId_userId: { meetupId, userId: users[role] } };
    await prisma.meetupMember.update({ where: key, data: { state: 'LEFT' } });
    try {
      expect(await profile()).toBeNull();
    } finally {
      await prisma.meetupMember.update({ where: key, data: { state: 'ACTIVE' } });
    }
  });

  it.each(['host', 'member'] as const)('denies access when %s is suspended', async (role) => {
    await prisma.user.update({ where: { id: users[role] }, data: { suspendedAt: new Date() } });
    try {
      expect(await profile()).toBeNull();
    } finally {
      await prisma.user.update({ where: { id: users[role] }, data: { suspendedAt: null } });
    }
  });
});
