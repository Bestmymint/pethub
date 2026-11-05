import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { prisma } from '@/lib/prisma';
import {
  addOwnedRecord,
  archiveOwnedPet,
  listPets,
  saveOwnedPet,
  setOwnedCare,
} from '@/features/pets/service';
import { bangkokToday, petSchema, recordSchema } from '@/features/pets/pet-schema';

const prefix = `pet-test-${randomUUID()}`;
const ownerId = `${prefix}-owner`,
  otherId = `${prefix}-other`;
let petId = '';
const values = petSchema.parse({
  name: 'Milo',
  species: 'dog',
  weight: 10,
  birthday: '2023-03-01',
});

beforeAll(async () => {
  nextEnv.loadEnvConfig(process.cwd());
  await prisma.user.createMany({
    data: [ownerId, otherId].map((id) => ({ id, name: id, email: `${id}@example.invalid` })),
  });
  petId = (await saveOwnedPet(ownerId, values))!;
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
  await prisma.$disconnect();
});

it('keeps pet reads, edits, archive, health records, and care logs private to the owner', async () => {
  expect((await listPets(ownerId)).map((p) => p.id)).toContain(petId);
  expect(await listPets(otherId)).toEqual([]);
  expect(await saveOwnedPet(otherId, { ...values, name: 'Stolen' }, petId)).toBeNull();
  expect(await archiveOwnedPet(otherId, petId, true)).toBe(false);
  expect(
    await addOwnedRecord(
      otherId,
      recordSchema.parse({ petId, category: 'note', title: 'No access', date: bangkokToday() }),
    ),
  ).toBeNull();
  expect(await setOwnedCare(otherId, { petId, task: 'breakfast', done: true })).toBe(false);
  expect((await listPets(ownerId))[0]?.name).toBe('Milo');
});

it('preserves the latest weight when older records arrive, including concurrent inserts', async () => {
  await Promise.all([
    addOwnedRecord(
      ownerId,
      recordSchema.parse({
        petId,
        category: 'weight',
        title: 'Latest',
        value: 12,
        date: '2025-06-01',
      }),
    ),
    addOwnedRecord(
      ownerId,
      recordSchema.parse({
        petId,
        category: 'weight',
        title: 'Older',
        value: 8,
        date: '2024-06-01',
      }),
    ),
  ]);
  const pet = (await listPets(ownerId))[0]!;
  expect(pet.weight).toBe(12);
  expect(pet.records.map((r) => r.value)).toEqual([12, 8]);
});

it('persists today’s care idempotently and keeps other Bangkok dates separate', async () => {
  await prisma.petCareLog.create({
    data: { petId, task: 'play', date: new Date('2020-01-01T00:00:00Z') },
  });
  await setOwnedCare(ownerId, { petId, task: 'breakfast', done: true });
  await setOwnedCare(ownerId, { petId, task: 'breakfast', done: true });
  expect((await listPets(ownerId))[0]?.careToday).toEqual(['breakfast']);
  expect(await prisma.petCareLog.count({ where: { petId, task: 'breakfast' } })).toBe(1);
  await setOwnedCare(ownerId, { petId, task: 'breakfast', done: false });
  expect((await listPets(ownerId))[0]?.careToday).toEqual([]);
});

it('archives without deleting history, blocks new writes while archived, and restores', async () => {
  expect(await archiveOwnedPet(ownerId, petId, true)).toBe(true);
  expect(await saveOwnedPet(ownerId, values, petId)).toBeNull();
  expect(await setOwnedCare(ownerId, { petId, task: 'play', done: true })).toBe(false);
  expect(
    await addOwnedRecord(
      ownerId,
      recordSchema.parse({ petId, category: 'note', title: 'Archived', date: bangkokToday() }),
    ),
  ).toBeNull();
  expect((await listPets(ownerId))[0]?.archived).toBe(true);
  expect(await archiveOwnedPet(ownerId, petId, false)).toBe(true);
  expect((await listPets(ownerId))[0]?.records).toHaveLength(2);
});
