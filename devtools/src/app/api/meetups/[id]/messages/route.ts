import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { canAccessMeetupChat } from '@/features/meetups/service';
import { prisma } from '@/lib/prisma';
import {
  activeMemberIds,
  blockedUserIds,
  messageInclude,
  toMessageDto,
} from '@/features/meetups/message-dto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.suspendedAt)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const meetup = await canAccessMeetupChat(id, session.user.id, session.user.role === 'ADMIN');
  if (!meetup) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const cursor = request.nextUrl.searchParams.get('before') ?? undefined;
  const [blockedIds, memberIds] = await Promise.all([
    blockedUserIds(session.user.id),
    activeMemberIds(id),
  ]);
  const messages = await prisma.meetupMessage.findMany({
    where: { meetupId: id },
    include: messageInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: 50,
  });
  const items = messages.reverse().map((message) => toMessageDto(message, blockedIds, memberIds));
  return NextResponse.json(
    { items, before: messages.length === 50 ? messages[0]?.id : null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
