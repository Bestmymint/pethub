import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  describeReportTarget,
  loadReportTargets,
  mediaSrc,
  type MessageRow,
  type TargetLookups,
  type UserRow,
} from '@/features/admin/meetup-report-targets';

const message = (overrides: Partial<MessageRow> = {}): MessageRow => ({
  id: 'msg1',
  meetupId: 'm1',
  text: 'ขายของนอกประเด็นนะครับ',
  objectKey: null,
  deletedAt: null,
  author: { name: 'พี่ฟ้า' },
  ...overrides,
});
const user = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: 'u1',
  name: 'น้องบี',
  deletedAt: null,
  ...overrides,
});
const lookups = (
  parts: Partial<{
    messages: MessageRow[];
    users: UserRow[];
    covers: [string, string | null][];
  }> = {},
): TargetLookups => ({
  messagesById: new Map((parts.messages ?? []).map((m) => [m.id, m])),
  messagesByKey: new Map(
    (parts.messages ?? []).flatMap((m) => (m.objectKey ? [[m.objectKey, m] as const] : [])),
  ),
  usersById: new Map((parts.users ?? []).map((u) => [u.id, u])),
  coverByMeetup: new Map(parts.covers ?? []),
});
const ref = (target: 'MEETUP' | 'USER' | 'MESSAGE' | 'IMAGE', targetId: string) => ({
  target,
  targetId,
  meetupId: 'm1',
});

describe('describeReportTarget', () => {
  it('needs nothing extra for a Meetup report', () => {
    expect(describeReportTarget(ref('MEETUP', 'm1'), lookups())).toEqual({ kind: 'MEETUP' });
  });

  it('shows the reported user’s name, and says when the account is deleted or gone', () => {
    expect(describeReportTarget(ref('USER', 'u1'), lookups({ users: [user()] }))).toEqual({
      kind: 'USER',
      state: 'ok',
      name: 'น้องบี',
    });
    expect(
      describeReportTarget(
        ref('USER', 'u1'),
        lookups({ users: [user({ deletedAt: new Date() })] }),
      ),
    ).toMatchObject({ state: 'deleted', name: 'น้องบี' });
    expect(describeReportTarget(ref('USER', 'u1'), lookups())).toEqual({
      kind: 'USER',
      state: 'missing',
      name: null,
    });
  });

  it('shows a reported message with its sender, shortened to one line', () => {
    const long = message({ text: `เริ่ม\n\n${'ยาว '.repeat(200)}` });
    const view = describeReportTarget(ref('MESSAGE', 'msg1'), lookups({ messages: [long] }));
    expect(view).toMatchObject({
      kind: 'MESSAGE',
      state: 'ok',
      senderName: 'พี่ฟ้า',
      imageSrc: null,
    });
    if (view.kind !== 'MESSAGE') throw new Error('unexpected kind');
    expect(view.text.startsWith('เริ่ม ยาว')).toBe(true);
    expect(view.text).not.toContain('\n');
    expect(view.text.endsWith('…')).toBe(true);
    expect([...view.text].length).toBeLessThan(260);
  });

  it('gives a photo message a thumbnail', () => {
    const photo = message({ text: null, objectKey: 'meetup_abc-123.png' });
    expect(
      describeReportTarget(ref('MESSAGE', 'msg1'), lookups({ messages: [photo] })),
    ).toMatchObject({
      state: 'ok',
      text: '',
      imageSrc: '/api/meetups/media/meetup_abc-123.png',
    });
  });

  it('keeps a deleted message’s text out of the view but still names the sender', () => {
    const view = describeReportTarget(
      ref('MESSAGE', 'msg1'),
      lookups({ messages: [message({ deletedAt: new Date(), text: null })] }),
    );
    expect(view).toEqual({
      kind: 'MESSAGE',
      state: 'deleted',
      text: '',
      senderName: 'พี่ฟ้า',
      imageSrc: null,
    });
  });

  it('treats an unknown message, or one from another Meetup, as gone', () => {
    expect(describeReportTarget(ref('MESSAGE', 'nope'), lookups())).toMatchObject({
      state: 'missing',
    });
    expect(
      describeReportTarget(
        ref('MESSAGE', 'msg1'),
        lookups({ messages: [message({ meetupId: 'other' })] }),
      ),
    ).toMatchObject({ state: 'missing', text: '' });
  });

  it('shows a chat image, a cover image, a deleted image and a vanished one', () => {
    const chat = message({ objectKey: 'meetup_a.jpg' });
    expect(
      describeReportTarget(ref('IMAGE', 'meetup_a.jpg'), lookups({ messages: [chat] })),
    ).toEqual({
      kind: 'IMAGE',
      state: 'ok',
      src: mediaSrc('meetup_a.jpg'),
      source: 'chat',
    });
    expect(
      describeReportTarget(
        ref('IMAGE', 'meetup_cover.webp'),
        lookups({ covers: [['m1', 'meetup_cover.webp']] }),
      ),
    ).toMatchObject({ state: 'ok', source: 'cover' });
    expect(
      describeReportTarget(
        ref('IMAGE', 'meetup_a.jpg'),
        lookups({ messages: [message({ objectKey: 'meetup_a.jpg', deletedAt: new Date() })] }),
      ),
    ).toMatchObject({ state: 'deleted', src: null });
    expect(describeReportTarget(ref('IMAGE', 'meetup_zzz.png'), lookups())).toMatchObject({
      state: 'missing',
      src: null,
    });
  });

  it('does not show another Meetup’s cover as this report’s image', () => {
    expect(
      describeReportTarget(
        ref('IMAGE', 'meetup_cover.webp'),
        lookups({ covers: [['other', 'meetup_cover.webp']] }),
      ),
    ).toMatchObject({ state: 'missing' });
  });
});

describe('loadReportTargets', () => {
  const report = (
    id: string,
    target: 'MEETUP' | 'USER' | 'MESSAGE' | 'IMAGE',
    targetId: string,
  ) => ({
    id,
    ...ref(target, targetId),
    meetupCoverKey: null,
  });

  function fakeDb() {
    const calls = { messages: [] as unknown[], users: [] as unknown[] };
    return {
      calls,
      db: {
        meetupMessage: {
          findMany: vi.fn(async (args: unknown) => {
            calls.messages.push(args);
            return [message()] as never;
          }),
        },
        user: {
          findMany: vi.fn(async (args: unknown) => {
            calls.users.push(args);
            return [user()] as never;
          }),
        },
      },
    };
  }

  it('answers every report from at most one query per table', async () => {
    const { db } = fakeDb();
    const views = await loadReportTargets(db as never, [
      report('r1', 'MESSAGE', 'msg1'),
      report('r2', 'MESSAGE', 'msg-other'),
      report('r3', 'USER', 'u1'),
      report('r4', 'MEETUP', 'm1'),
      report('r5', 'IMAGE', 'meetup_x.png'),
    ]);
    expect(db.meetupMessage.findMany).toHaveBeenCalledTimes(1);
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
    expect(views.get('r1')).toMatchObject({ kind: 'MESSAGE', state: 'ok' });
    expect(views.get('r2')).toMatchObject({ kind: 'MESSAGE', state: 'missing' });
    expect(views.get('r3')).toMatchObject({ kind: 'USER', state: 'ok' });
    expect(views.get('r4')).toEqual({ kind: 'MEETUP' });
    expect(views.get('r5')).toMatchObject({ kind: 'IMAGE', state: 'missing' });
  });

  it('only asks for the rows the reports point at, and selects no more than it shows', async () => {
    const { db, calls } = fakeDb();
    await loadReportTargets(db as never, [
      report('r1', 'MESSAGE', 'msg1'),
      report('r2', 'IMAGE', 'meetup_x.png'),
    ]);
    expect(calls.users).toHaveLength(0);
    expect(calls.messages[0]).toMatchObject({
      where: { OR: [{ id: { in: ['msg1'] } }, { objectKey: { in: ['meetup_x.png'] } }] },
      select: {
        id: true,
        meetupId: true,
        text: true,
        objectKey: true,
        deletedAt: true,
        author: { select: { name: true } },
      },
    });
  });

  it('runs no query for a list of Meetup-only reports', async () => {
    const { db } = fakeDb();
    await loadReportTargets(db as never, [report('r1', 'MEETUP', 'm1')]);
    expect(db.meetupMessage.findMany).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
});
