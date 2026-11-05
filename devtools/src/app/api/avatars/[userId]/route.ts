import { NextResponse } from 'next/server';

import { getCurrentSession } from '@/lib/auth-guards';
import { avatarBytes } from '@/lib/avatar';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const missing = () =>
    NextResponse.json(
      { error: 'NOT_FOUND' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
    );
  const session = await getCurrentSession();
  if (!session || session.user.suspendedAt) return missing();
  const viewer = await prisma.user.findFirst({
    where: { id: session.user.id, suspendedAt: null, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!viewer) return missing();
  const { userId } = await params;
  const target = await prisma.user.findFirst({
    where: { id: userId, suspendedAt: null, deletedAt: null },
    select: { image: true },
  });
  if (!target) return missing();
  if (viewer.id !== userId) {
    const blocked = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: viewer.id, blockedId: userId },
          { blockerId: userId, blockedId: viewer.id },
        ],
      },
      select: { id: true },
    });
    if (blocked) return missing();
    if (viewer.role !== 'ADMIN') {
      const shared = await prisma.meetup.findFirst({
        where: {
          deletedAt: null,
          AND: [
            { members: { some: { userId: viewer.id, state: 'ACTIVE' } } },
            { members: { some: { userId, state: 'ACTIVE' } } },
          ],
        },
        select: { id: true },
      });
      if (!shared) return missing();
    }
  }
  const bytes = avatarBytes(target.image);
  if (!bytes) return missing();
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
