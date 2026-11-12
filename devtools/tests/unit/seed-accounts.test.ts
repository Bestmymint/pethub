import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('../../prisma/provision-user', () => ({ provisionCredentialUser: vi.fn() }));

import { accountSeedPlan, demoPetsEnabled } from '../../prisma/seed-accounts';

const base = {
  SEED_ADMIN_EMAIL: 'admin@example.com',
  SEED_ADMIN_PASSWORD: 'pw-admin-0000',
  SEED_USER_EMAIL: 'user@example.com',
  SEED_USER_PASSWORD: 'pw-user-0000',
};

describe('accountSeedPlan', () => {
  it('plans the admin and the user, as CI and test environments set them', () => {
    expect(accountSeedPlan(base).map((account) => [account.key, account.role])).toEqual([
      ['admin', 'ADMIN'],
      ['user', 'USER'],
    ]);
  });

  it('adds the second user when it is configured, as a regular user', () => {
    const plan = accountSeedPlan({
      ...base,
      SEED_USER2_EMAIL: 'user2@example.com',
      SEED_USER2_PASSWORD: 'pw-user2-0000',
    });
    expect(plan.map((account) => account.key)).toEqual(['admin', 'user', 'user2']);
    expect(plan[2]).toMatchObject({
      email: 'user2@example.com',
      role: 'USER',
      name: 'PawMap Test User 2',
    });
  });

  it('refuses a half-configured second user instead of skipping it quietly', () => {
    expect(() => accountSeedPlan({ ...base, SEED_USER2_EMAIL: 'user2@example.com' })).toThrow(
      'SEED_USER2_PASSWORD',
    );
    expect(() => accountSeedPlan({ ...base, SEED_USER2_PASSWORD: 'pw-user2-0000' })).toThrow(
      'SEED_USER2_EMAIL',
    );
  });

  it('still requires the first two accounts', () => {
    expect(() =>
      accountSeedPlan({ SEED_USER_EMAIL: 'u@example.com', SEED_USER_PASSWORD: 'x' }),
    ).toThrow('SEED_ADMIN_EMAIL');
  });
});

describe('demoPetsEnabled', () => {
  it('is on only for the exact string "true"', () => {
    expect(demoPetsEnabled({ SEED_DEMO_PETS: 'true' })).toBe(true);
    for (const value of [undefined, '', 'false', 'TRUE', '1'])
      expect(demoPetsEnabled({ SEED_DEMO_PETS: value })).toBe(false);
  });
});
