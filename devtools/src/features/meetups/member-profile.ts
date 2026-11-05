import 'server-only';

import { prisma } from '@/lib/prisma';
import { avatarUrl } from '@/lib/avatar';
import { canAccessMeetupChat } from './service';

export async function getMeetupMemberProfile(
  meetupId: string,
  memberId: string,
  viewerId: string,
  isAdmin: boolean,
) {
  const meetup = await canAccessMeetupChat(meetupId, viewerId, isAdmin);
  if (!meetup) return null;
  const blocked = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: memberId },
        { blockerId: memberId, blockedId: viewerId },
      ],
    },
    select: { id: true },
  });
  if (blocked) return null;
  const member = await prisma.meetupMember.findFirst({
    where: {
      meetupId,
      userId: memberId,
      state: 'ACTIVE',
      user: { suspendedAt: null, deletedAt: null },
    },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          pets: {
            where: { archivedAt: null },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, species: true, breed: true, sex: true, color: true },
          },
        },
      },
    },
  });
  return member
    ? { ...member.user, image: avatarUrl(member.user), meetupTitle: meetup.title }
    : null;
}
