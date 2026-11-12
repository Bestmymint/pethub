import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadReportTargets } from '@/features/admin/meetup-report-targets';
import { prisma } from '@/lib/prisma';
import { createPublicPlaceFixture } from '../helpers/place-fixture';

describe('Meetup report targets (admin list)', () => {
  const prefix = `report-targets-${randomUUID()}`;
  const ids = { host: `${prefix}-host`, member: `${prefix}-member`, gone: `${prefix}-gone` };
  const keys = {
    chat: `meetup_${randomUUID()}.png`,
    deleted: `meetup_${randomUUID()}.png`,
    cover: `meetup_${randomUUID()}.webp`,
  };
  let meetupId = '';
  let otherMeetupId = '';
  let placeId = '';
  const message: Record<string, string> = {};

  beforeAll(async () => {
    const place = await createPublicPlaceFixture(prisma, `${prefix}-fixture`);
    placeId = place.id;
    await prisma.user.createMany({
      data: Object.entries(ids).map(([role, id]) => ({
        id,
        name: `${prefix} ${role}`,
        email: `${id}@pawmap.local`,
        ...(role === 'gone' ? { deletedAt: new Date() } : {}),
      })),
    });
    const base = {
      description: 'Integration fixture for admin report targets.',
      startsAt: new Date(Date.now() + 2 * 86_400_000),
      endsAt: new Date(Date.now() + 2 * 86_400_000 + 3_600_000),
      maxMembers: 5,
      hostId: ids.host,
      placeId: place.id,
    };
    meetupId = (
      await prisma.meetup.create({
        data: { ...base, title: prefix, coverObjectKey: keys.cover },
      })
    ).id;
    otherMeetupId = (await prisma.meetup.create({ data: { ...base, title: `${prefix}-other` } }))
      .id;
    const create = async (name: string, data: Record<string, unknown>) => {
      message[name] = (
        await prisma.meetupMessage.create({
          data: { meetupId, authorId: ids.member, kind: 'TEXT', ...data } as never,
        })
      ).id;
    };
    await create('text', { text: 'ข้อความที่ถูกรายงาน' });
    await create('deletedText', { text: null, deletedAt: new Date() });
    await create('photo', { kind: 'IMAGE', objectKey: keys.chat });
    await create('deletedPhoto', { kind: 'IMAGE', objectKey: keys.deleted, deletedAt: new Date() });
  });

  afterAll(async () => {
    await prisma.meetup.deleteMany({ where: { id: { in: [meetupId, otherMeetupId] } } });
    if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await prisma.$disconnect();
  });

  const ref = (
    id: string,
    target: 'MEETUP' | 'USER' | 'MESSAGE' | 'IMAGE',
    targetId: string,
    at = meetupId,
  ) => ({
    id,
    target,
    targetId,
    meetupId: at,
    meetupCoverKey: at === meetupId ? keys.cover : null,
  });

  it('describes each kind of target from the real database', async () => {
    const views = await loadReportTargets(prisma, [
      ref('meetup', 'MEETUP', meetupId),
      ref('user', 'USER', ids.member),
      ref('goneUser', 'USER', ids.gone),
      ref('noUser', 'USER', `${prefix}-nobody`),
      ref('text', 'MESSAGE', message.text!),
      ref('deletedText', 'MESSAGE', message.deletedText!),
      ref('noMessage', 'MESSAGE', 'does-not-exist'),
      ref('photo', 'MESSAGE', message.photo!),
      ref('chatImage', 'IMAGE', keys.chat),
      ref('deletedImage', 'IMAGE', keys.deleted),
      ref('cover', 'IMAGE', keys.cover),
      ref('noImage', 'IMAGE', 'meetup_nothing.png'),
    ]);
    expect(views.get('meetup')).toEqual({ kind: 'MEETUP' });
    expect(views.get('user')).toMatchObject({ state: 'ok', name: `${prefix} member` });
    expect(views.get('goneUser')).toMatchObject({ state: 'deleted' });
    expect(views.get('noUser')).toMatchObject({ state: 'missing' });
    expect(views.get('text')).toMatchObject({
      kind: 'MESSAGE',
      state: 'ok',
      text: 'ข้อความที่ถูกรายงาน',
      senderName: `${prefix} member`,
    });
    expect(views.get('deletedText')).toMatchObject({
      state: 'deleted',
      text: '',
      senderName: `${prefix} member`,
    });
    expect(views.get('noMessage')).toMatchObject({ state: 'missing' });
    expect(views.get('photo')).toMatchObject({
      state: 'ok',
      imageSrc: `/api/meetups/media/${keys.chat}`,
    });
    expect(views.get('chatImage')).toMatchObject({ state: 'ok', source: 'chat' });
    expect(views.get('deletedImage')).toMatchObject({ state: 'deleted', src: null });
    expect(views.get('cover')).toMatchObject({ state: 'ok', source: 'cover' });
    expect(views.get('noImage')).toMatchObject({ state: 'missing' });
  });

  it('does not reveal a message through a report filed against a different Meetup', async () => {
    const views = await loadReportTargets(prisma, [
      ref('crossMessage', 'MESSAGE', message.text!, otherMeetupId),
      ref('crossImage', 'IMAGE', keys.chat, otherMeetupId),
    ]);
    expect(views.get('crossMessage')).toMatchObject({ state: 'missing', text: '' });
    expect(views.get('crossImage')).toMatchObject({ state: 'missing', src: null });
  });

  it('works for an empty list', async () => {
    expect((await loadReportTargets(prisma, [])).size).toBe(0);
  });
});
