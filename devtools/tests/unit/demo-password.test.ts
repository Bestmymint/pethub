import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { passwordProblem } from '@/lib/form-validation';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const compose = read('infra/compose.demo.yml');
const smoke = read('infra/scripts/smoke-demo.sh');

/** The default written once, on the line that defines the YAML anchor. */
const defaults = [...compose.matchAll(/\$\{DEMO_PASSWORD:-([^}]+)\}/gu)].map((match) => match[1]!);

describe('the one shared demo password', () => {
  it('is written once in compose, from one variable', () => {
    expect(defaults).toHaveLength(1);
  });

  it('is shared by the admin and both users through one alias', () => {
    expect(compose).toMatch(/SEED_ADMIN_PASSWORD: &demo-password \$\{DEMO_PASSWORD:-/u);
    expect(compose).toContain('SEED_USER_PASSWORD: *demo-password');
    expect(compose).toContain('SEED_USER2_PASSWORD: *demo-password');
  });

  it('satisfies the app’s own password policy', () => {
    expect(passwordProblem(defaults[0]!)).toBeUndefined();
  });

  it('is what the smoke test logs in with', () => {
    expect(smoke).toContain(`PASSWORD="\${DEMO_PASSWORD:-${defaults[0]}}"`);
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

describe('the demo accounts in compose', () => {
  it('seeds a second regular user next to the admin and the first user', () => {
    expect(compose).toContain('SEED_USER2_EMAIL: ${DEMO_USER2_EMAIL:-demo-user2@example.com}');
    expect(compose).toContain('SEED_USER_EMAIL: ${DEMO_USER_EMAIL:-demo-user@example.com}');
    expect(compose).toContain('SEED_ADMIN_EMAIL: ${DEMO_ADMIN_EMAIL:-demo-admin@example.com}');
  });

  it('turns the sample pets on for setup only through this file', () => {
    expect(compose).toContain("SEED_DEMO_PETS: 'true'");
  });
});
