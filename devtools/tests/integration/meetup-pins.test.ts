import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
const session = vi.hoisted(() => ({
  userId: '',
  /** What the better-auth session lookup returns for the API routes. */
  api: null as null | { user: { id: string; role: string; suspendedAt: Date | null } },
}));
vi.mock('@/lib/auth-guards', () => ({
  getCurrentSession: async () => ({ user: { id: session.userId, suspendedAt: null } }),
}));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: async () => session.api } } }));

import { GET as getMessages } from '@/app/api/meetups/[id]/messages/route';
import { GET as getPinned } from '@/app/api/meetups/[id]/messages/pinned/route';
import {
  deleteMeetupMessage,
  pinMeetupMessage,
  sendMeetupMessage,
} from '@/features/meetups/actions';
import { MAX_PINNED_MESSAGES } from '@/features/meetups/chat-pins';
import type { ChatMessage } from '@/features/meetups/chat-types';
import { prisma } from '@/lib/prisma';
import { createPublicPlaceFixture } from '../helpers/place-fixture';

describe('Meetup pinned messages', () => {
  const prefix = `meetup-pins-${randomUUID()}`;
  const users = {
    host: `${prefix}-host`,
    member: `${prefix}-member`,
    noisy: `${prefix}-noisy`,
    outsider: `${prefix}-outsider`,
    admin: `${prefix}-admin`,
  };
  let meetupId = '';
  let placeId = '';
  let seq = 0;

  const asApi = (userId: string, role = 'USER', suspendedAt: Date | null = null) => {
    session.userId = userId;
    session.api = { user: { id: userId, role, suspendedAt } };
  };
  const call = (
    handler: (
      request: NextRequest,
      context: { params: Promise<{ id: string }> },
    ) => Promise<Response>,
    path = '',
  ) =>
    handler(new NextRequest(`http://localhost:3000/api/meetups/${meetupId}/messages${path}`), {
      params: Promise.resolve({ id: meetupId }),
    });

  /** A text message created `minutesAgo` minutes ago; pinned `pinnedMinutesAgo` minutes ago when given. */
  async function addMessage(
    authorId: string,
    { pinnedMinutesAgo, minutesAgo = 60 }: { pinnedMinutesAgo?: number; minutesAgo?: number } = {},
  ) {
    seq += 1;
    return prisma.meetupMessage.create({
      data: {
        meetupId,
        authorId,
        kind: 'TEXT',
        text: `pin test message ${seq}`,
        createdAt: new Date(Date.now() - minutesAgo * 60_000 - seq),
        pinnedAt:
          pinnedMinutesAgo === undefined ? null : new Date(Date.now() - pinnedMinutesAgo * 60_000),
      },
    });
  }
  const clearMessages = () => prisma.meetupMessage.deleteMany({ where: { meetupId } });

  beforeAll(async () => {
    const place = await createPublicPlaceFixture(prisma, `${prefix}-fixture`);
    placeId = place.id;
    await prisma.user.createMany({
      data: Object.entries(users).map(([role, id]) => ({
        id,
        name: `${prefix} ${role}`,
        email: `${id}@pawmap.local`,
        ...(role === 'admin' ? { role: 'ADMIN' as const } : {}),
      })),
    });
    const meetup = await prisma.meetup.create({
      data: {
        title: prefix,
        description: 'Integration fixture for pinned chat messages.',
        startsAt: new Date(Date.now() + 2 * 86_400_000),
        endsAt: new Date(Date.now() + 2 * 86_400_000 + 3_600_000),
        maxMembers: 5,
        hostId: users.host,
        placeId: place.id,
        members: { create: [users.host, users.member, users.noisy].map((userId) => ({ userId })) },
      },
    });
    meetupId = meetup.id;
  });

  beforeEach(async () => {
    await clearMessages();
    await prisma.userBlock.deleteMany({ where: { blockerId: { in: Object.values(users) } } });
  });

  afterAll(async () => {
    if (meetupId) await prisma.meetup.deleteMany({ where: { id: meetupId, title: prefix } });
    if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.rateLimitBucket.deleteMany({ where: { bucketKey: { in: Object.values(users) } } });
    await prisma.userBlock.deleteMany({ where: { blockerId: { in: Object.values(users) } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.$disconnect();
  });

  describe('GET /api/meetups/[id]/messages/pinned', () => {
    it('requires a signed-in, non-suspended user', async () => {
      session.api = null;
      expect((await call(getPinned)).status).toBe(401);
      asApi(users.member, 'USER', new Date());
      expect((await call(getPinned)).status).toBe(401);
    });

    it('answers 404 to a user who is not an active member, like the message list', async () => {
      asApi(users.outsider);
      expect((await call(getPinned)).status).toBe(404);
      expect((await call(getMessages)).status).toBe(404);
      await prisma.meetupMember.update({
        where: { meetupId_userId: { meetupId, userId: users.noisy } },
        data: { state: 'LEFT' },
      });
      try {
        asApi(users.noisy);
        expect((await call(getPinned)).status).toBe(404);
      } finally {
        await prisma.meetupMember.update({
          where: { meetupId_userId: { meetupId, userId: users.noisy } },
          data: { state: 'ACTIVE' },
        });
      }
    });

    it('lets an admin read the pins without being a member', async () => {
      await addMessage(users.host, { pinnedMinutesAgo: 5 });
      asApi(users.admin, 'ADMIN');
      const response = await call(getPinned);
      expect(response.status).toBe(200);
      expect(((await response.json()) as { items: unknown[] }).items).toHaveLength(1);
    });

    it('returns pinned messages newest pin first, not newest message first', async () => {
      const oldMessageNewPin = await addMessage(users.host, {
        minutesAgo: 600,
        pinnedMinutesAgo: 1,
      });
      const newMessageOldPin = await addMessage(users.member, {
        minutesAgo: 10,
        pinnedMinutesAgo: 30,
      });
      const middle = await addMessage(users.host, { minutesAgo: 300, pinnedMinutesAgo: 15 });
      await addMessage(users.host); // not pinned
      asApi(users.member);
      const body = (await (await call(getPinned)).json()) as {
        items: ChatMessage[];
        total: number;
      };
      expect(body.items.map((item) => item.id)).toEqual([
        oldMessageNewPin.id,
        middle.id,
        newMessageOldPin.id,
      ]);
      expect(body.total).toBe(3);
      expect(body.items.every((item) => item.pinned && item.pinnedAt)).toBe(true);
    });

    it('leaves out deleted messages and uses the same shape as the message list', async () => {
      const kept = await addMessage(users.host, { pinnedMinutesAgo: 2 });
      await addMessage(users.host, { pinnedMinutesAgo: 1 }).then((message) =>
        prisma.meetupMessage.update({
          where: { id: message.id },
          data: { deletedAt: new Date(), text: null },
        }),
      );
      asApi(users.member);
      const pinned = (await (await call(getPinned)).json()) as {
        items: ChatMessage[];
        total: number;
      };
      expect(pinned.items.map((item) => item.id)).toEqual([kept.id]);
      expect(pinned.total).toBe(1);
      const list = (await (await call(getMessages)).json()) as { items: ChatMessage[] };
      expect(pinned.items[0]).toEqual(list.items.find((item) => item.id === kept.id));
    });

    it('keeps pins from a blocked user visible, while their other messages stay hidden', async () => {
      const pinnedByNoisy = await addMessage(users.noisy, { pinnedMinutesAgo: 3 });
      const plainByNoisy = await addMessage(users.noisy);
      await prisma.userBlock.create({ data: { blockerId: users.member, blockedId: users.noisy } });
      asApi(users.member);
      const pinned = (await (await call(getPinned)).json()) as { items: ChatMessage[] };
      expect(pinned.items).toHaveLength(1);
      expect(pinned.items[0]).toMatchObject({
        id: pinnedByNoisy.id,
        blocked: false,
        text: pinnedByNoisy.text,
      });
      const list = (await (await call(getMessages)).json()) as { items: ChatMessage[] };
      expect(list.items.find((item) => item.id === plainByNoisy.id)).toMatchObject({
        blocked: true,
        text: null,
      });
    });
  });

  describe('pin limit', () => {
    async function fillPins(count: number) {
      const messages = [];
      for (let index = 0; index < count; index += 1)
        messages.push(await addMessage(users.member, { pinnedMinutesAgo: index + 1 }));
      return messages;
    }

    it('lets the host pin up to the limit and then refuses with MEETUP_PIN_LIMIT', async () => {
      const messages = await fillPins(0).then(async () => {
        const created = [];
        for (let index = 0; index < MAX_PINNED_MESSAGES + 1; index += 1)
          created.push(await addMessage(users.member));
        return created;
      });
      session.userId = users.host;
      for (const message of messages.slice(0, MAX_PINNED_MESSAGES))
        expect((await pinMeetupMessage(meetupId, message.id, true)).ok).toBe(true);
      expect(await pinMeetupMessage(meetupId, messages[MAX_PINNED_MESSAGES]!.id, true)).toEqual({
        ok: false,
        formError: 'MEETUP_PIN_LIMIT',
      });
      expect(
        await prisma.meetupMessage.count({ where: { meetupId, pinnedAt: { not: null } } }),
      ).toBe(MAX_PINNED_MESSAGES);
    });

    it('allows re-pinning at the limit, and pinning again after an unpin', async () => {
      const pinned = await fillPins(MAX_PINNED_MESSAGES);
      const extra = await addMessage(users.member);
      session.userId = users.host;
      expect((await pinMeetupMessage(meetupId, pinned[0]!.id, true)).ok).toBe(true);
      expect((await pinMeetupMessage(meetupId, extra.id, true)).ok).toBe(false);
      expect((await pinMeetupMessage(meetupId, pinned[1]!.id, false)).ok).toBe(true);
      expect((await pinMeetupMessage(meetupId, extra.id, true)).ok).toBe(true);
    });

    it('frees a slot when a pinned message is deleted', async () => {
      const pinned = await fillPins(MAX_PINNED_MESSAGES);
      const extra = await addMessage(users.member);
      session.userId = users.host;
      expect((await deleteMeetupMessage(meetupId, pinned[0]!.id)).ok).toBe(true);
      expect((await pinMeetupMessage(meetupId, extra.id, true)).ok).toBe(true);
    });

    it('cannot be exceeded by pins that run at the same time', async () => {
      const messages = [];
      for (let index = 0; index < MAX_PINNED_MESSAGES + 4; index += 1)
        messages.push(await addMessage(users.member));
      session.userId = users.host;
      const results = await Promise.all(
        messages.map((message) => pinMeetupMessage(meetupId, message.id, true)),
      );
      expect(results.filter((result) => result.ok)).toHaveLength(MAX_PINNED_MESSAGES);
      expect(
        await prisma.meetupMessage.count({ where: { meetupId, pinnedAt: { not: null } } }),
      ).toBe(MAX_PINNED_MESSAGES);
    });

    it('counts host announcements against the limit', async () => {
      await fillPins(MAX_PINNED_MESSAGES);
      session.userId = users.host;
      expect(await sendMeetupMessage(meetupId, 'Announcement', undefined, true)).toEqual({
        ok: false,
        formError: 'MEETUP_PIN_LIMIT',
      });
    });

    it('keeps pinning and unpinning to the host and admins', async () => {
      const message = await addMessage(users.member);
      session.userId = users.member;
      expect(await pinMeetupMessage(meetupId, message.id, true)).toEqual({
        ok: false,
        formError: 'MEETUP_FORBIDDEN',
      });
      session.userId = users.outsider;
      expect((await pinMeetupMessage(meetupId, message.id, true)).ok).toBe(false);
      session.userId = users.admin;
      expect((await pinMeetupMessage(meetupId, message.id, true)).ok).toBe(true);
      session.userId = users.member;
      expect((await pinMeetupMessage(meetupId, message.id, false)).ok).toBe(false);
    });

    it('reports an unknown or deleted message as not found', async () => {
      session.userId = users.host;
      expect(await pinMeetupMessage(meetupId, 'does-not-exist', true)).toEqual({
        ok: false,
        formError: 'MEETUP_MESSAGE_NOT_FOUND',
      });
    });
  });
});
