import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_PETS,
  MEMBER_PETS,
  SEED_PET_PREFIX,
  petRow,
  seedPetId,
  type DemoAccountKey,
} from '@/features/demo/demo-pets';
import { petSchema } from '@/features/pets/pet-schema';

const allPets = [...Object.values(ACCOUNT_PETS).flat(), ...MEMBER_PETS.flat()];

describe('demo pet data', () => {
  it('gives each of the three accounts at least two pets, and every made-up member at least one', () => {
    for (const key of ['admin', 'user', 'user2'] as DemoAccountKey[])
      expect(ACCOUNT_PETS[key].length).toBeGreaterThanOrEqual(2);
    expect(MEMBER_PETS).toHaveLength(6);
    for (const pets of MEMBER_PETS) expect(pets.length).toBeGreaterThanOrEqual(1);
  });

  it('passes the same validation as the pet form, with a past birthday', () => {
    for (const pet of allPets) {
      const parsed = petSchema.parse(pet);
      expect(parsed.birthday < new Date().toISOString().slice(0, 10)).toBe(true);
      expect(parsed.birthday).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    }
  });

  it('is Thai content using the species the app knows, with varied kinds of pets', () => {
    expect(new Set(allPets.map((pet) => pet.species))).toEqual(new Set(['dog', 'cat', 'other']));
    for (const pet of allPets) expect(pet.name).toMatch(/[฀-๿]/u);
  });

  it('does not repeat a pet name within one owner', () => {
    for (const pets of [...Object.values(ACCOUNT_PETS), ...MEMBER_PETS]) {
      const names = pets.map((pet) => pet.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('petRow', () => {
  it('builds a row with the given id and owner and a date-only birthday', () => {
    const row = petRow('owner-1', 'seed_pet_owner-1_1', ACCOUNT_PETS.user[0]!);
    expect(row).toMatchObject({ id: 'seed_pet_owner-1_1', ownerId: 'owner-1', species: 'dog' });
    expect((row.birthday as Date).toISOString()).toBe('2020-09-05T00:00:00.000Z');
  });

  it('rejects data the pet form would reject', () => {
    expect(() => petRow('o', 'x', { ...ACCOUNT_PETS.user[0]!, birthday: '2999-01-01' })).toThrow();
    expect(() => petRow('o', 'x', { ...ACCOUNT_PETS.user[0]!, name: '' })).toThrow();
  });
});

describe('seed pet ids', () => {
  it('are fixed per owner and position and carry a prefix the demo tools never delete', () => {
    expect(seedPetId('clx123', 2)).toBe('seed_pet_clx123_2');
    expect(seedPetId('clx123', 2)).toBe(seedPetId('clx123', 2));
    expect(seedPetId('clx123', 1).startsWith(SEED_PET_PREFIX)).toBe(true);
    expect(seedPetId('clx123', 1).startsWith('demo_')).toBe(false);
  });

  it('never repeat between two different owners', () => {
    expect(seedPetId('owner-a', 1)).not.toBe(seedPetId('owner-b', 1));
  });
});
