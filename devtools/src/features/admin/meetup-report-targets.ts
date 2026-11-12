import 'server-only';

import type { MeetupReportTarget, PrismaClient } from '@prisma/client';

import { pinPreview } from '@/features/meetups/chat-pins';

/** The part of a Meetup report that says what was reported. */
export interface ReportRef {
  target: MeetupReportTarget;
  targetId: string;
  meetupId: string;
}

/** What an admin sees for the reported item. `state` tells a live item from a deleted or vanished one. */
export type ReportTargetView =
  | { kind: 'MEETUP' }
  | { kind: 'USER'; state: 'ok' | 'deleted' | 'missing'; name: string | null }
  | {
      kind: 'MESSAGE';
      state: 'ok' | 'deleted' | 'missing';
      /** Shortened to one line; empty unless state is "ok". */
      text: string;
      senderName: string | null;
      /** Thumbnail when the message is a photo and still exists. */
      imageSrc: string | null;
    }
  | {
      kind: 'IMAGE';
      state: 'ok' | 'deleted' | 'missing';
      src: string | null;
      source: 'chat' | 'cover';
    };

export interface MessageRow {
  id: string;
  meetupId: string;
  text: string | null;
  objectKey: string | null;
  deletedAt: Date | null;
  author: { name: string } | null;
}

export interface UserRow {
  id: string;
  name: string;
  deletedAt: Date | null;
}

export interface TargetLookups {
  messagesById: ReadonlyMap<string, MessageRow>;
  messagesByKey: ReadonlyMap<string, MessageRow>;
  usersById: ReadonlyMap<string, UserRow>;
  /** Cover image key of each reported Meetup (null when it has none). */
  coverByMeetup: ReadonlyMap<string, string | null>;
}

const MESSAGE_PREVIEW_LENGTH = 240;

/** Served by `/api/meetups/media/[key]`, which lets an admin read any Meetup's chat images. */
export function mediaSrc(objectKey: string) {
  return `/api/meetups/media/${encodeURIComponent(objectKey)}`;
}

/** Pure: turns a report and the rows fetched for it into what the admin list shows. */
export function describeReportTarget(ref: ReportRef, lookups: TargetLookups): ReportTargetView {
  if (ref.target === 'MEETUP') return { kind: 'MEETUP' };

  if (ref.target === 'USER') {
    const user = lookups.usersById.get(ref.targetId);
    if (!user) return { kind: 'USER', state: 'missing', name: null };
    return { kind: 'USER', state: user.deletedAt ? 'deleted' : 'ok', name: user.name };
  }

  if (ref.target === 'MESSAGE') {
    const message = lookups.messagesById.get(ref.targetId);
    // A report can only point at a message of its own Meetup; anything else is treated as gone.
    if (!message || message.meetupId !== ref.meetupId)
      return { kind: 'MESSAGE', state: 'missing', text: '', senderName: null, imageSrc: null };
    const senderName = message.author?.name ?? null;
    if (message.deletedAt)
      return { kind: 'MESSAGE', state: 'deleted', text: '', senderName, imageSrc: null };
    return {
      kind: 'MESSAGE',
      state: 'ok',
      text: message.text
        ? pinPreview({ text: message.text, kind: 'TEXT' }, 'th', MESSAGE_PREVIEW_LENGTH)
        : '',
      senderName,
      imageSrc: message.objectKey ? mediaSrc(message.objectKey) : null,
    };
  }

  // IMAGE: the target is an object key, either a chat photo or the Meetup's cover.
  const message = lookups.messagesByKey.get(ref.targetId);
  if (message && message.meetupId === ref.meetupId) {
    return message.deletedAt
      ? { kind: 'IMAGE', state: 'deleted', src: null, source: 'chat' }
      : { kind: 'IMAGE', state: 'ok', src: mediaSrc(ref.targetId), source: 'chat' };
  }
  if (lookups.coverByMeetup.get(ref.meetupId) === ref.targetId)
    return { kind: 'IMAGE', state: 'ok', src: mediaSrc(ref.targetId), source: 'cover' };
  return { kind: 'IMAGE', state: 'missing', src: null, source: 'chat' };
}

type TargetDb = {
  meetupMessage: Pick<PrismaClient['meetupMessage'], 'findMany'>;
  user: Pick<PrismaClient['user'], 'findMany'>;
};

/**
 * Read-only: loads everything the given reports point at with at most two queries, and returns the
 * view for each report id. The caller (an admin page) is responsible for the admin check.
 */
export async function loadReportTargets(
  db: TargetDb,
  reports: Array<ReportRef & { id: string; meetupCoverKey: string | null }>,
) {
  const messageIds = reports.filter((r) => r.target === 'MESSAGE').map((r) => r.targetId);
  const imageKeys = reports.filter((r) => r.target === 'IMAGE').map((r) => r.targetId);
  const userIds = reports.filter((r) => r.target === 'USER').map((r) => r.targetId);

  const [messages, users] = await Promise.all([
    messageIds.length || imageKeys.length
      ? db.meetupMessage.findMany({
          where: {
            OR: [
              ...(messageIds.length ? [{ id: { in: messageIds } }] : []),
              ...(imageKeys.length ? [{ objectKey: { in: imageKeys } }] : []),
            ],
          },
          select: {
            id: true,
            meetupId: true,
            text: true,
            objectKey: true,
            deletedAt: true,
            author: { select: { name: true } },
          },
        })
      : [],
    userIds.length
      ? db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, deletedAt: true },
        })
      : [],
  ]);

  const lookups: TargetLookups = {
    messagesById: new Map(messages.map((m) => [m.id, m])),
    messagesByKey: new Map(
      messages.flatMap((m) => (m.objectKey ? [[m.objectKey, m] as const] : [])),
    ),
    usersById: new Map(users.map((u) => [u.id, u])),
    coverByMeetup: new Map(reports.map((r) => [r.meetupId, r.meetupCoverKey])),
  };
  return new Map(reports.map((report) => [report.id, describeReportTarget(report, lookups)]));
}
