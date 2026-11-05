import { describe, expect, it } from 'vitest';
import { bangkokToday, careSchema, petSchema, recordSchema } from '@/features/pets/pet-schema';

describe('pet care validation', () => {
  it('uses the Bangkok calendar at the UTC day boundary', () => {
    expect(bangkokToday(new Date('2026-10-25T17:01:00Z'))).toBe('2026-10-26');
    expect(bangkokToday(new Date('2026-10-25T16:59:00Z'))).toBe('2026-10-25');
  });
  it('accepts unknown birth date and weight, and strips caller-supplied ownership', () => {
    const pet = petSchema.parse({
      name: ' Milo ',
      species: 'dog',
      weight: '',
      ownerId: 'someone-else',
    });
    expect(pet.name).toBe('Milo');
    expect(pet.birthday).toBe('');
    expect(pet.weight).toBeNull();
    expect(pet).not.toHaveProperty('ownerId');
  });
  it.each(['2026-02-30', '2025-02-29', '2999-01-01', 'not-a-date'])(
    'rejects impossible or future birthday %s',
    (birthday) => {
      expect(petSchema.safeParse({ name: 'Milo', species: 'dog', birthday }).success).toBe(false);
    },
  );
  it.each([-1, 0, 201, 'no', Infinity])('rejects invalid weight %s', (weight) => {
    expect(petSchema.safeParse({ name: 'Milo', species: 'dog', weight }).success).toBe(false);
  });
  it('requires weight for weight records and a follow-up on or after the record', () => {
    const base = { petId: 'pet', category: 'weight', title: 'Weight', date: '2025-01-01' };
    expect(recordSchema.safeParse(base).success).toBe(false);
    expect(recordSchema.safeParse({ ...base, value: 4, dueDate: '2024-12-31' }).success).toBe(
      false,
    );
    expect(recordSchema.safeParse({ ...base, value: 4, dueDate: '2025-02-01' }).success).toBe(true);
  });
  it('accepts only the three daily tasks and a boolean completion', () => {
    expect(careSchema.safeParse({ petId: 'pet', task: 'breakfast', done: true }).success).toBe(
      true,
    );
    expect(careSchema.safeParse({ petId: 'pet', task: 'arbitrary', done: true }).success).toBe(
      false,
    );
    expect(careSchema.safeParse({ petId: 'pet', task: 'breakfast', done: 'false' }).success).toBe(
      false,
    );
  });
});
