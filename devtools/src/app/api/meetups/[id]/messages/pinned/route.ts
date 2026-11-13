import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { PINNED_LIST_CAP } from '@/features/meetups/chat-pins';
import {
  activeMemberIds,
  blockedUserIds,
  messageInclude,
  toMessageDto,
} from '@/features/meetups/message-dto';
import { canAccessMeetupChat } from '@/features/meetups/service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Pinned messages of a meetup, newest pin first, in the same shape as `GET .../messages`.
 * Access is the same as the message list: signed in, not suspended, and an active member (or admin).
 * Like the message list and the events stream, it has no extra rate limit.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.suspendedAt)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const meetup = await canAccessMeetupChat(id, session.user.id, session.user.role === 'ADMIN');
  if (!meetup) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const where = { meetupId: id, pinnedAt: { not: null }, deletedAt: null };
  const [blockedIds, memberIds, messages, total] = await Promise.all([
    blockedUserIds(session.user.id),
    activeMemberIds(id),
    prisma.meetupMessage.findMany({
      where,
      include: messageInclude,
      orderBy: [{ pinnedAt: 'desc' }, { id: 'desc' }],
      take: PINNED_LIST_CAP,
    }),
    prisma.meetupMessage.count({ where }),
  ]);
  return NextResponse.json(
    { items: messages.map((message) => toMessageDto(message, blockedIds, memberIds)), total },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
