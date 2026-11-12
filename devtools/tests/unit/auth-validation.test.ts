import { describe, expect, it } from 'vitest';

import { authRequestProblem } from '@/lib/auth-validation';
import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/form-validation';

const signUp = (overrides: Record<string, unknown> = {}) => ({
  email: 'member@example.com',
  name: 'PawMap Member',
  password: 'a'.repeat(PASSWORD_MIN_LENGTH),
  ...overrides,
});

describe('authRequestProblem on /sign-up/email', () => {
  it('accepts a valid sign-up, including the seed and admin account names', () => {
    expect(authRequestProblem('/sign-up/email', signUp())).toBeUndefined();
    for (const name of ['PawMap Test Admin', 'PawMap Test User', 'PawMap Administrator'])
      expect(authRequestProblem('/sign-up/email', signUp({ name }))).toBeUndefined();
    for (const email of ['admin@pawmap.local', 'demo-admin@example.com', 'x@example.invalid'])
      expect(authRequestProblem('/sign-up/email', signUp({ email }))).toBeUndefined();
  });

  it('rejects a malformed email with INVALID_EMAIL_FORMAT', () => {
    for (const email of ['user@example', 'user example@test.com', '', 42])
      expect(authRequestProblem('/sign-up/email', signUp({ email }))?.code).toBe(
        'INVALID_EMAIL_FORMAT',
      );
  });

  it('accepts punycode and Unicode (IDN) domains', () => {
    for (const email of ['user@example.xn--o3cw4h', 'user@ตัวอย่าง.ไทย', 'user@example.ไทย'])
      expect(authRequestProblem('/sign-up/email', signUp({ email }))).toBeUndefined();
  });

  it('enforces the 10..128 password window at its boundaries', () => {
    const at = (length: number) =>
      authRequestProblem('/sign-up/email', signUp({ password: 'p'.repeat(length) }))?.code;
    expect(at(PASSWORD_MIN_LENGTH - 1)).toBe('PASSWORD_TOO_SHORT');
    expect(at(PASSWORD_MIN_LENGTH)).toBeUndefined();
    expect(at(PASSWORD_MAX_LENGTH)).toBeUndefined();
    expect(at(PASSWORD_MAX_LENGTH + 1)).toBe('PASSWORD_TOO_LONG');
  });

  it('validates the display name (trimmed, 2..80)', () => {
    const name = (value: unknown) => authRequestProblem('/sign-up/email', signUp({ name: value }));
    expect(name('')?.code).toBe('NAME_REQUIRED');
    expect(name('   ')?.code).toBe('NAME_REQUIRED');
    expect(name(undefined)?.code).toBe('NAME_REQUIRED');
    expect(name('  ก ')?.code).toBe('NAME_TOO_SHORT');
    expect(name('a'.repeat(NAME_MAX_LENGTH + 1))?.code).toBe('NAME_TOO_LONG');
    expect(name('a'.repeat(NAME_MAX_LENGTH))).toBeUndefined();
  });

  it('returns a message alongside every code', () => {
    expect(authRequestProblem('/sign-up/email', signUp({ name: '' }))).toEqual({
      code: 'NAME_REQUIRED',
      message: 'Name is required',
    });
  });
});

describe('authRequestProblem on other paths', () => {
  it('reads newPassword on /reset-password', () => {
    expect(authRequestProblem('/reset-password', { newPassword: 'short', token: 't' })?.code).toBe(
      'PASSWORD_TOO_SHORT',
    );
    expect(
      authRequestProblem('/reset-password', {
        newPassword: 'p'.repeat(PASSWORD_MAX_LENGTH + 1),
        token: 't',
      })?.code,
    ).toBe('PASSWORD_TOO_LONG');
    expect(
      authRequestProblem('/reset-password', {
        newPassword: 'p'.repeat(PASSWORD_MIN_LENGTH),
        password: 'x',
        token: 't',
      }),
    ).toBeUndefined();
  });

  it('checks the name on /update-user only when a name is sent', () => {
    expect(authRequestProblem('/update-user', { image: null })).toBeUndefined();
    expect(authRequestProblem('/update-user', { name: 'New Name' })).toBeUndefined();
    expect(authRequestProblem('/update-user', { name: 'x' })?.code).toBe('NAME_TOO_SHORT');
    expect(authRequestProblem('/update-user', { name: '  ' })?.code).toBe('NAME_REQUIRED');
  });

  it('does not intercept sign-in or any other path', () => {
    const odd = { email: 'not-an-email', password: 'x', name: '', newPassword: 'x' };
    for (const path of [
      '/sign-in/email',
      '/request-password-reset',
      '/reset-password/:token',
      '/get-session',
      '/change-password',
      '/sign-out',
    ])
      expect(authRequestProblem(path, odd)).toBeUndefined();
  });

  it('tolerates a missing or non-object body', () => {
    expect(authRequestProblem('/get-session', undefined)).toBeUndefined();
    expect(authRequestProblem('/sign-up/email', null)?.code).toBe('INVALID_EMAIL_FORMAT');
    expect(authRequestProblem('/reset-password', 'text')).toBeUndefined();
  });
});
