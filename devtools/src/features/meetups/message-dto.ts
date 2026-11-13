import 'server-only';

import type { Prisma } from '@prisma/client';

import { avatarUrl } from '@/lib/avatar';
import { prisma } from '@/lib/prisma';
import type { ChatMessage } from './chat-types';

/** What the chat routes load for each message. */
export const messageInclude = {
  author: { select: { id: true, name: true, image: true } },
  replyTo: { select: { id: true, text: true, authorId: true } },
} satisfies Prisma.MeetupMessageInclude;

export type MessageRow = Prisma.MeetupMessageGetPayload<{ include: typeof messageInclude }>;

/** Ids of the users the viewer blocked. */
export async function blockedUserIds(viewerId: string) {
  const blocked = await prisma.userBlock.findMany({
    where: { blockerId: viewerId },
    select: { blockedId: true },
  });
  return new Set(blocked.map((item) => item.blockedId));
}

/** Ids of the active members of a meetup: only these have a profile page that opens. */
export async function activeMemberIds(meetupId: string) {
  const members = await prisma.meetupMember.findMany({
    where: { meetupId, state: 'ACTIVE' },
    select: { userId: true },
  });
  return new Set(members.map((item) => item.userId));
}

/**
 * The one place that turns a stored message into the DTO the chat sends, so the message list and the
 * pinned list always agree. Messages from blocked users are hidden for the viewer, except pinned ones:
 * a pin is a host decision and stays visible to everyone.
 */
export function toMessageDto(
  message: MessageRow,
  blockedIds: ReadonlySet<string>,
  memberIds: ReadonlySet<string>,
): ChatMessage {
  const hidden =
    message.kind !== 'SYSTEM' &&
    !message.pinnedAt &&
    Boolean(message.authorId && blockedIds.has(message.authorId));
  const replyHidden =
    hidden || Boolean(message.replyTo?.authorId && blockedIds.has(message.replyTo.authorId));
  return {
    id: message.id,
    kind: message.kind,
    text: hidden || message.deletedAt ? null : message.text,
    mediaUrl:
      hidden || message.deletedAt || !message.objectKey
        ? null
        : `/api/meetups/media/${encodeURIComponent(message.objectKey)}`,
    author:
      hidden || !message.author ? null : { ...message.author, image: avatarUrl(message.author) },
    authorId: message.authorId,
    authorIsMember: Boolean(message.authorId && memberIds.has(message.authorId)),
    blocked: hidden,
    deleted: Boolean(message.deletedAt),
    pinned: Boolean(message.pinnedAt),
    pinnedAt: message.pinnedAt?.toISOString() ?? null,
    replyTo:
      replyHidden || !message.replyTo
        ? null
        : { id: message.replyTo.id, text: message.replyTo.text },
    createdAt: message.createdAt.toISOString(),
  };
}
