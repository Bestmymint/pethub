import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifyPassword } from 'better-auth/crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ userId: '' }));
vi.mock('@/lib/auth-guards', () => ({
  getCurrentSession: async () => ({ user: { id: session.userId, suspendedAt: null } }),
}));

import {
  accountSeedPlan,
  seedAccountPets,
  seedCredentialAccounts,
} from '../../prisma/seed-accounts';
import { demoIdPrefix } from '@/features/demo/demo-config';
import { ACCOUNT_PETS, MEMBER_PETS, SEED_PET_PREFIX } from '@/features/demo/demo-pets';
import { createDemoData, deleteDemoData, type DemoDeps } from '@/features/demo/demo-service';
import { pinMeetupMessage, reportMeetup, sendMeetupMessage } from '@/features/meetups/actions';
import { prisma } from '@/lib/prisma';
import { createPublicPlaceFixture } from '../helpers/place-fixture';

/** The default shared demo password, read from the compose file so the test covers the real value. */
const compose = readFileSync(new URL('../../infra/compose.demo.yml', import.meta.url), 'utf8');
const sharedPassword = /\$\{DEMO_PASSWORD:-([^}]+)\}/u.exec(compose)![1]!;

describe('demo sign-in accounts, shared chats and pets', () => {
  const prefix = `demo-accts-${randomUUID()}`;
  const email = (name: string) => `${prefix}-${name}@pawmap.local`;
  const oldVolumeEnv = {
    SEED_ADMIN_EMAIL: email('admin'),
    SEED_ADMIN_PASSWORD: sharedPassword,
    SEED_USER_EMAIL: email('user'),
    SEED_USER_PASSWORD: sharedPassword,
  };
  const newEnv = {
    ...oldVolumeEnv,
    SEED_USER2_EMAIL: email('user2'),
    SEED_USER2_PASSWORD: sharedPassword,
  };
  const storage = { put: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
  let ids = new Map<string, string>();
  let adminId = '';
  const placeIds: string[] = [];
  let realUserId = '';
  let realMeetupId = '';
  let realPetId = '';
  const m = (n: number) => `${demoIdPrefix('meetup')}${n}`;

  const deps = (): DemoDeps => ({
    db: prisma,
    now: new Date(),
    actorId: adminId,
    storage,
    renderImage: async () => new Uint8Array([137, 80, 78, 71]),
    demoUserEmail: email('user'),
    demoUser2Email: email('user2'),
  });
  /** The seeded pets of this test's three accounts (the database may hold other accounts' pets too). */
  const ownSeedPets = () =>
    prisma.pet.count({
      where: { ownerId: { in: [...ids.values()] }, id: { startsWith: SEED_PET_PREFIX } },
    });
  const petsOf = (ownerId: string) =>
    prisma.pet.findMany({ where: { ownerId }, orderBy: { id: 'asc' } });
  const activeMembers = async (meetupId: string) =>
    (
      await prisma.meetupMember.findMany({
        where: { meetupId, state: 'ACTIVE' },
        select: { userId: true },
      })
    ).map((member) => member.userId);

  beforeAll(async () => {
    for (let index = 0; index < 8; index += 1)
      placeIds.push((await createPublicPlaceFixture(prisma, `${prefix}-p${index}`)).id);
    // Something real that no demo tool may touch: a user with a pet, who hosts a meetup with a message.
    realUserId = `${prefix}-real`;
    await prisma.user.create({
      data: { id: realUserId, name: `${prefix} real`, email: email('real') },
    });
    realPetId = (
      await prisma.pet.create({
        data: { ownerId: realUserId, name: 'สัตว์เลี้ยงจริง', species: 'dog' },
      })
    ).id;
    realMeetupId = (
      await prisma.meetup.create({
        data: {
          title: `${prefix} real meetup`,
          description: 'A real meetup that is not demo data.',
          startsAt: new Date(Date.now() + 86_400_000),
          endsAt: new Date(Date.now() + 90_000_000),
          maxMembers: 5,
          hostId: realUserId,
          placeId: placeIds[7]!,
          members: { create: [{ userId: realUserId }] },
          messages: { create: [{ authorId: realUserId, kind: 'TEXT', text: 'real message' }] },
        },
      })
    ).id;
  });

  afterAll(async () => {
    const all = [...ids.values(), realUserId];
    await deleteDemoData(deps()).catch(() => undefined);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: all } } });
    await prisma.meetup.deleteMany({ where: { id: realMeetupId } });
    await prisma.rateLimitBucket.deleteMany({ where: { bucketKey: { in: all } } });
    await prisma.place.deleteMany({ where: { id: { in: placeIds } } });
    await prisma.user.deleteMany({ where: { id: { in: all } } });
    await prisma.$disconnect();
  });

  it('plans the third account only when it is configured, so CI and e2e runs are unchanged', () => {
    expect(accountSeedPlan(oldVolumeEnv).map((account) => account.key)).toEqual(['admin', 'user']);
    expect(accountSeedPlan(newEnv).map((account) => account.key)).toEqual([
      'admin',
      'user',
      'user2',
    ]);
  });

  it('starts from an existing volume that has only the two old accounts', async () => {
    ids = (await seedCredentialAccounts(oldVolumeEnv)) as Map<string, string>;
    adminId = ids.get('admin')!;
    expect([...ids.keys()]).toEqual(['admin', 'user']);
    expect(await prisma.user.count({ where: { email: email('user2') } })).toBe(0);
  });

  it('creates the demo data gracefully while the third account does not exist yet', async () => {
    const counts = await createDemoData(deps());
    expect(counts.meetups).toBe(5); // the sixth Meetup is hosted by the missing account
    expect(await prisma.meetup.count({ where: { id: m(6) } })).toBe(0);
    expect(await activeMembers(m(5))).toContain(ids.get('user'));
  });

  it('re-running the seed adds the third account to that existing database without touching the others', async () => {
    const before = await prisma.user.findMany({
      where: { id: { in: [ids.get('admin')!, ids.get('user')!] } },
      select: { id: true, email: true, name: true, role: true },
      orderBy: { email: 'asc' },
    });
    ids = (await seedCredentialAccounts(newEnv)) as Map<string, string>;
    expect([...ids.keys()]).toEqual(['admin', 'user', 'user2']);
    const after = await prisma.user.findMany({
      where: { id: { in: [ids.get('admin')!, ids.get('user')!] } },
      select: { id: true, email: true, name: true, role: true },
      orderBy: { email: 'asc' },
    });
    expect(after).toEqual(before);
  });

  it('the third account is a verified regular user who can sign in with the shared password', async () => {
    const user2 = await prisma.user.findUniqueOrThrow({
      where: { email: email('user2') },
      include: { accounts: { where: { providerId: 'credential' } } },
    });
    expect(user2).toMatchObject({ role: 'USER', emailVerified: true, name: 'PawMap Test User 2' });
    expect(user2.accounts).toHaveLength(1);
    for (const [key, id] of ids) {
      const account = await prisma.account.findFirstOrThrow({
        where: { userId: id, providerId: 'credential' },
      });
      await expect(
        verifyPassword({ hash: account.password ?? '', password: sharedPassword }),
        key,
      ).resolves.toBe(true);
    }
  });

  it('the seed is idempotent: a third run changes no ids and creates no duplicates', async () => {
    const again = await seedCredentialAccounts(newEnv);
    expect([...again]).toEqual([...ids]);
    for (const name of ['admin', 'user', 'user2']) {
      const user = await prisma.user.findMany({
        where: { email: email(name) },
        include: { accounts: true },
      });
      expect(user).toHaveLength(1);
      expect(user[0]!.accounts).toHaveLength(1);
    }
  });

  it('gives each of the three accounts its pets, once, and keeps what someone has edited', async () => {
    const created = await seedAccountPets(ids as Map<never, string>);
    expect(created).toBe(Object.values(ACCOUNT_PETS).flat().length);
    for (const key of ['admin', 'user', 'user2'] as const) {
      const pets = await petsOf(ids.get(key)!);
      expect(pets).toHaveLength(ACCOUNT_PETS[key].length);
      expect(pets.every((pet) => pet.id.startsWith(`${SEED_PET_PREFIX}${ids.get(key)}_`))).toBe(
        true,
      );
      expect(pets.map((pet) => pet.name).sort()).toEqual(
        ACCOUNT_PETS[key].map((pet) => pet.name).sort(),
      );
    }
    await prisma.pet.update({
      where: { id: `${SEED_PET_PREFIX}${ids.get('user')}_1` },
      data: { name: 'ชื่อที่แก้ไขแล้ว' },
    });
    expect(await seedAccountPets(ids as Map<never, string>)).toBe(0);
    expect(
      (
        await prisma.pet.findUniqueOrThrow({
          where: { id: `${SEED_PET_PREFIX}${ids.get('user')}_1` },
        })
      ).name,
    ).toBe('ชื่อที่แก้ไขแล้ว');
    expect(await prisma.pet.count({ where: { ownerId: { in: [...ids.values()] } } })).toBe(created);
  });

  it('creating again now adds the third account’s Meetup and memberships, and nothing twice', async () => {
    const before = await prisma.meetupMember.count({
      where: { id: { startsWith: demoIdPrefix('member') } },
    });
    const counts = await createDemoData(deps());
    expect(counts.meetups).toBe(1); // the sixth
    expect(counts.members).toBeGreaterThan(0);
    expect(
      await prisma.meetupMember.count({ where: { id: { startsWith: demoIdPrefix('member') } } }),
    ).toBe(before + counts.members);
    expect(counts.pets).toBe(0); // the made-up members' pets were already there
    const again = await createDemoData(deps());
    expect(Object.values(again).reduce((sum, value) => sum + value, 0)).toBe(0);
  });

  it('puts demo-user and demo-user2 together as active members of the same Meetups', async () => {
    const [user, user2] = [ids.get('user')!, ids.get('user2')!];
    for (const meetupId of [m(1), m(5), m(6)]) {
      const members = await activeMembers(meetupId);
      expect(members, meetupId).toEqual(expect.arrayContaining([user, user2]));
    }
    expect((await prisma.meetup.findUniqueOrThrow({ where: { id: m(5) } })).hostId).toBe(user);
    expect((await prisma.meetup.findUniqueOrThrow({ where: { id: m(6) } })).hostId).toBe(user2);
    for (const meetupId of [m(5), m(6)]) {
      const row = await prisma.meetup.findUniqueOrThrow({ where: { id: meetupId } });
      expect(row.status).toBe('OPEN');
      expect(row.startsAt.getTime()).toBeGreaterThan(Date.now());
    }
    // They have seeded messages to start from.
    expect(
      await prisma.meetupMessage.count({ where: { meetupId: m(5), authorId: user2 } }),
    ).toBeGreaterThan(0);
  });

  it('both can really chat, pin and report through the existing actions', async () => {
    const [user, user2] = [ids.get('user')!, ids.get('user2')!];
    session.userId = user;
    const first = await sendMeetupMessage(m(5), 'สวัสดีค่ะ จากบัญชีแรก');
    session.userId = user2;
    const second = await sendMeetupMessage(m(5), 'สวัสดีค่ะ ตอบกลับจากบัญชีที่สอง', undefined);
    expect(first.ok && second.ok).toBe(true);
    const texts = await prisma.meetupMessage.findMany({
      where: {
        meetupId: m(5),
        id: { in: [first.ok ? first.data.id : '', second.ok ? second.data.id : ''] },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(texts.map((message) => message.authorId)).toEqual([user, user2]);

    // The second user also chats in the Meetup the first one does not host.
    expect((await sendMeetupMessage(m(1), 'ขอร่วมสนทนาในกลุ่มแรกด้วยค่ะ')).ok).toBe(true);

    // The host (demo-user) can pin; a plain member (demo-user2) cannot.
    if (!second.ok) throw new Error('send failed');
    session.userId = user;
    expect((await pinMeetupMessage(m(5), second.data.id, true)).ok).toBe(true);
    session.userId = user2;
    expect(await pinMeetupMessage(m(5), second.data.id, false)).toMatchObject({ ok: false });

    // Either can report the other's message.
    expect(
      (
        await reportMeetup(m(5), {
          target: 'MESSAGE',
          targetId: first.ok ? first.data.id : '',
          reason: 'SPAM',
        })
      ).ok,
    ).toBe(true);
  });

  it('delete removes the made-up members’ pets and keeps the three accounts’ pets', async () => {
    const seedPets = await ownSeedPets();
    const memberPets = await prisma.pet.count({
      where: { id: { startsWith: demoIdPrefix('pet') } },
    });
    expect(memberPets).toBe(MEMBER_PETS.flat().length);

    const deleted = await deleteDemoData(deps());
    expect(deleted.pets).toBe(memberPets);
    expect(await prisma.pet.count({ where: { id: { startsWith: demoIdPrefix('pet') } } })).toBe(0);
    expect(await ownSeedPets()).toBe(seedPets);
    expect(seedPets).toBe(Object.values(ACCOUNT_PETS).flat().length);
  });

  it('delete keeps the three accounts and every non-demo row, and removes the shared Meetups', async () => {
    for (const id of ids.values())
      expect(await prisma.user.findUnique({ where: { id } })).not.toBeNull();
    expect(
      await prisma.account.count({
        where: { userId: { in: [...ids.values()] }, providerId: 'credential' },
      }),
    ).toBe(3);
    expect(
      await prisma.meetup.count({ where: { id: { startsWith: demoIdPrefix('meetup') } } }),
    ).toBe(0);
    expect(await prisma.meetupMember.count({ where: { userId: { in: [...ids.values()] } } })).toBe(
      0,
    );

    // The real user, their pet, meetup and message are exactly as they were.
    expect(await prisma.user.findUnique({ where: { id: realUserId } })).not.toBeNull();
    expect((await prisma.pet.findUniqueOrThrow({ where: { id: realPetId } })).name).toBe(
      'สัตว์เลี้ยงจริง',
    );
    expect(await prisma.meetup.findUnique({ where: { id: realMeetupId } })).not.toBeNull();
    expect(await prisma.meetupMessage.count({ where: { meetupId: realMeetupId } })).toBe(1);
  });

  it('deleting again is safe and removes nothing', async () => {
    const counts = await deleteDemoData(deps());
    expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(0);
    expect(await ownSeedPets()).toBe(Object.values(ACCOUNT_PETS).flat().length);
  });
});
