import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const session = vi.hoisted(() => ({ userId: '' }));
vi.mock('@/lib/auth-guards', () => ({
  getCurrentSession: async () =>
    session.userId ? { user: { id: session.userId, suspendedAt: null } } : null,
}));
import { POST, DELETE } from '@/app/api/profile/avatar/route';
import { GET } from '@/app/api/avatars/[userId]/route';
import { avatarBytes, avatarUrl, normalizeAvatar } from '@/lib/avatar';
import { prisma } from '@/lib/prisma';
import { createPublicPlaceFixture } from '../helpers/place-fixture';

const prefix = `avatars-${randomUUID()}`;
const users = {
  owner: `${prefix}-owner`,
  peer: `${prefix}-peer`,
  outsider: `${prefix}-outsider`,
  admin: `${prefix}-admin`,
};
let meetupId = '',
  placeId = '';
let png: Buffer;
const upload = (
  file = new File([new Uint8Array(png)], 'photo.png', { type: 'image/png' }),
  origin?: string,
) => {
  const body = new FormData();
  body.set('file', file);
  body.set('userId', users.peer);
  return POST(
    new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body,
      headers: origin ? { origin } : {},
    }),
  );
};
const read = () =>
  GET(new Request('http://localhost/api/avatars/' + users.owner), {
    params: Promise.resolve({ userId: users.owner }),
  });
const remove = () =>
  DELETE(new Request('http://localhost/api/profile/avatar', { method: 'DELETE' }));

beforeAll(async () => {
  png = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#89ab86' } })
    .png()
    .toBuffer();
  await prisma.user.createMany({
    data: Object.entries(users).map(([role, id]) => ({
      id,
      name: role,
      email: `${id}@example.invalid`,
      role: role === 'admin' ? 'ADMIN' : 'USER',
    })),
  });
  const place = await createPublicPlaceFixture(prisma, prefix);
  placeId = place.id;
  meetupId = (
    await prisma.meetup.create({
      data: {
        hostId: users.owner,
        placeId,
        title: prefix,
        description: 'Avatar integration fixture',
        maxMembers: 4,
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        members: { create: [users.owner, users.peer].map((userId) => ({ userId })) },
      },
    })
  ).id;
});
afterAll(async () => {
  if (meetupId) await prisma.meetup.deleteMany({ where: { id: meetupId } });
  if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
  await prisma.rateLimitBucket.deleteMany({ where: { bucketKey: { in: Object.values(users) } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});

it('requires authentication and a trusted origin for picture changes', async () => {
  expect((await upload()).status).toBe(401);
  expect((await remove()).status).toBe(401);
  expect((await read()).status).toBe(404);
  session.userId = users.owner;
  expect((await upload(undefined, 'https://untrusted.invalid')).status).toBe(403);
});

it('decodes and crops images, persists only the session owner, and serves local URLs', async () => {
  session.userId = users.owner;
  const result = await upload();
  expect(result.status).toBe(200);
  const { image } = await result.json();
  expect(image).toMatch(new RegExp(`^/api/avatars/${users.owner}\\?v=[a-f0-9]+$`));
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: users.owner } });
  expect(avatarUrl(owner)).toBe(image);
  const meta = await sharp(avatarBytes(owner.image)!).metadata();
  expect(meta).toMatchObject({ format: 'webp', width: 256, height: 256 });
  expect(meta.exif).toBeUndefined();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: users.peer } })).image).toBeNull();
  const response = await read();
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('image/webp');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(
    new Uint8Array(avatarBytes(owner.image)!),
  );
});

it('keeps the saved picture when invalid, corrupted or oversized files are rejected', async () => {
  const before = (await prisma.user.findUniqueOrThrow({ where: { id: users.owner } })).image;
  for (const bytes of [Buffer.from('<svg onload="alert(1)"></svg>'), png.subarray(0, 35)]) {
    expect(
      (await upload(new File([new Uint8Array(bytes)], 'fake.png', { type: 'image/png' }))).status,
    ).toBe(415);
  }
  expect(
    (
      await upload(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
      )
    ).status,
  ).toBe(413);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: users.owner } })).image).toBe(before);
});

it('allows shared members and admins while withholding images from unrelated users and blocks', async () => {
  session.userId = users.peer;
  expect((await read()).status).toBe(200);
  session.userId = users.admin;
  expect((await read()).status).toBe(200);
  session.userId = users.outsider;
  expect((await read()).status).toBe(404);
  for (const [blockerId, blockedId] of [
    [users.owner, users.peer],
    [users.peer, users.owner],
  ]) {
    const block = await prisma.userBlock.create({
      data: { blockerId: blockerId!, blockedId: blockedId! },
    });
    try {
      session.userId = users.peer;
      expect((await read()).status).toBe(404);
    } finally {
      await prisma.userBlock.delete({ where: { id: block.id } });
    }
  }
});

it('rejects former and suspended members, including a suspended owner upload', async () => {
  session.userId = users.peer;
  const where = { meetupId_userId: { meetupId, userId: users.peer } };
  await prisma.meetupMember.update({ where, data: { state: 'LEFT' } });
  try {
    expect((await read()).status).toBe(404);
  } finally {
    await prisma.meetupMember.update({ where, data: { state: 'ACTIVE' } });
  }
  await prisma.user.update({ where: { id: users.owner }, data: { suspendedAt: new Date() } });
  try {
    expect((await read()).status).toBe(404);
    session.userId = users.owner;
    expect((await upload()).status).toBe(401);
  } finally {
    await prisma.user.update({ where: { id: users.owner }, data: { suspendedAt: null } });
  }
});

it('changes the version on replacement and removes only the owner picture', async () => {
  session.userId = users.owner;
  const old = avatarUrl(await prisma.user.findUniqueOrThrow({ where: { id: users.owner } }));
  const replacement = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#aa6633' },
  })
    .jpeg()
    .toBuffer();
  const response = await upload(
    new File([new Uint8Array(replacement)], 'new.jpg', { type: 'image/jpeg' }),
  );
  expect((await response.json()).image).not.toBe(old);
  expect((await remove()).status).toBe(200);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: users.owner } })).image).toBeNull();
  expect((await read()).status).toBe(404);
});

it('bounds decoded pixel count and ignores unsupported stored images', async () => {
  const wide = await sharp({
    create: { width: 5000, height: 5000, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  await expect(normalizeAvatar(new File([new Uint8Array(wide)], 'big.png'))).rejects.toThrow(
    'INVALID_IMAGE',
  );
  expect(avatarBytes('https://example.invalid/photo.svg')).toBeNull();
});

it('rate limits repeated uploads before replacing a saved picture', async () => {
  session.userId = users.owner;
  const windowStart = new Date(Math.floor(Date.now() / 3600000) * 3600000);
  await prisma.rateLimitBucket.upsert({
    where: {
      bucketKey_action_windowStart: {
        bucketKey: users.owner,
        action: 'profile-avatar',
        windowStart,
      },
    },
    create: {
      bucketKey: users.owner,
      action: 'profile-avatar',
      windowStart,
      expiresAt: new Date(windowStart.getTime() + 3600000),
      count: 15,
    },
    update: { count: 15 },
  });
  expect((await upload()).status).toBe(429);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: users.owner } })).image).toBeNull();
});
