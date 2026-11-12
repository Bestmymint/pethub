import {
  ACCOUNT_PETS,
  petRow,
  seedPetId,
  type DemoAccountKey,
} from '../src/features/demo/demo-pets';
import { prisma } from '../src/lib/prisma';
import { provisionCredentialUser } from './provision-user';

export interface AccountSeed {
  key: DemoAccountKey;
  email: string;
  password: string;
  name: string;
  role: 'USER' | 'ADMIN';
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Required environment variable ${name} is not configured`);
  return value;
}

/**
 * The sign-in accounts to create from the environment. The admin and the user are always required.
 * The second user is optional so that CI and test environments, which only set the first two, keep
 * working: it is created when SEED_USER2_EMAIL is set, and then SEED_USER2_PASSWORD is required too.
 */
export function accountSeedPlan(env: Env): AccountSeed[] {
  const plan: AccountSeed[] = [
    {
      key: 'admin',
      email: required(env, 'SEED_ADMIN_EMAIL'),
      password: required(env, 'SEED_ADMIN_PASSWORD'),
      name: 'PawMap Test Admin',
      role: 'ADMIN',
    },
    {
      key: 'user',
      email: required(env, 'SEED_USER_EMAIL'),
      password: required(env, 'SEED_USER_PASSWORD'),
      name: 'PawMap Test User',
      role: 'USER',
    },
  ];
  if (env.SEED_USER2_EMAIL?.trim() || env.SEED_USER2_PASSWORD?.trim())
    plan.push({
      key: 'user2',
      email: required(env, 'SEED_USER2_EMAIL'),
      password: required(env, 'SEED_USER2_PASSWORD'),
      name: 'PawMap Test User 2',
      role: 'USER',
    });
  return plan;
}

/** Creates or refreshes each account. Safe to repeat, and adds a new account to an existing database. */
export async function seedCredentialAccounts(env: Env = process.env) {
  const ids = new Map<DemoAccountKey, string>();
  for (const account of accountSeedPlan(env))
    ids.set(
      account.key,
      await provisionCredentialUser({
        email: account.email,
        password: account.password,
        name: account.name,
        role: account.role,
      }),
    );
  return ids;
}

/** Pets are only seeded when SEED_DEMO_PETS is exactly "true" (the demo stack), never in CI or e2e runs. */
export function demoPetsEnabled(env: Env = process.env) {
  return env.SEED_DEMO_PETS === 'true';
}

/**
 * Gives each sign-in account its sample pets. The ids are fixed and rows are only inserted when
 * missing, so a re-run neither duplicates them nor overwrites a pet someone has since edited.
 */
export async function seedAccountPets(ids: Map<DemoAccountKey, string>) {
  const rows = [...ids].flatMap(([key, ownerId]) =>
    ACCOUNT_PETS[key].map((input, index) => petRow(ownerId, seedPetId(ownerId, index + 1), input)),
  );
  return (await prisma.pet.createMany({ data: rows, skipDuplicates: true })).count;
}
