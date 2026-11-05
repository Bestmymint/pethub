import { NextResponse } from 'next/server';

import { getCurrentSession } from '@/lib/auth-guards';
import { avatarUrl, MAX_AVATAR_UPLOAD, normalizeAvatar } from '@/lib/avatar';
import { hasTrustedOrigin } from '@/lib/origin';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/rate-limit';

async function activeOwner() {
  const session = await getCurrentSession();
  if (!session || session.user.suspendedAt) return null;
  return prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null, suspendedAt: null },
    select: { id: true },
  });
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request))
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const owner = await activeOwner();
  if (!owner) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_AVATAR_UPLOAD + 65536)
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get('file');
  } catch {
    return NextResponse.json({ error: 'INVALID_UPLOAD' }, { status: 400 });
  }
  if (!(file instanceof File) || !file.size)
    return NextResponse.json({ error: 'INVALID_UPLOAD' }, { status: 400 });
  if (file.size > MAX_AVATAR_UPLOAD)
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
  const limit = await consumeRateLimit({
    key: owner.id,
    action: 'profile-avatar',
    limit: 15,
    windowMs: 3600000,
  });
  if (!limit.allowed) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
  let image: string;
  try {
    image = await normalizeAvatar(file);
  } catch {
    return NextResponse.json({ error: 'INVALID_IMAGE' }, { status: 415 });
  }
  const saved = await prisma.user.updateMany({
    where: { id: owner.id, deletedAt: null, suspendedAt: null },
    data: { image },
  });
  if (!saved.count) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  return NextResponse.json(
    { image: avatarUrl({ id: owner.id, image }) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function DELETE(request: Request) {
  if (!hasTrustedOrigin(request))
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const owner = await activeOwner();
  if (!owner) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const saved = await prisma.user.updateMany({
    where: { id: owner.id, deletedAt: null, suspendedAt: null },
    data: { image: null },
  });
  if (!saved.count) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  return NextResponse.json({ image: null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
