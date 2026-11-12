import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { passwordProblem } from '@/lib/form-validation';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const compose = read('infra/compose.demo.yml');
const smoke = read('infra/scripts/smoke-demo.sh');

const passwordDefault = (text: string, name: string) =>
  new RegExp(`${name}:\\s*\\$\\{DEMO_PASSWORD:-([^}]+)\\}`, 'u').exec(text)?.[1];

describe('the one shared demo password', () => {
  const admin = passwordDefault(compose, 'SEED_ADMIN_PASSWORD');
  const user = passwordDefault(compose, 'SEED_USER_PASSWORD');

  it('is the same default for the admin and the user, from one variable', () => {
    expect(admin).toBeTruthy();
    expect(user).toBe(admin);
  });

  it('satisfies the app’s own password policy', () => {
    expect(passwordProblem(admin!)).toBeUndefined();
  });

  it('is what the smoke test logs in with', () => {
    expect(smoke).toContain(`PASSWORD="\${DEMO_PASSWORD:-${admin}}"`);
  });

  it('leaves no trace of the two old passwords or their variables', () => {
    for (const text of [compose, smoke])
      for (const old of [
        'DemoUser-ChangeMe',
        'DemoAdmin-ChangeMe',
        'DEMO_USER_PASSWORD',
        'DEMO_ADMIN_PASSWORD',
      ])
        expect(text).not.toContain(old);
  });
});
