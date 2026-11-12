import { describe, expect, it } from 'vitest';

import {
  authFieldsForMode,
  canSubmitFromStep,
  confirmPasswordProblem,
  emailProblem,
  firstInvalidControl,
  firstInvalidField,
  nameProblem,
  normalizeEmail,
  passwordProblem,
  shouldShowFieldError,
  touchAll,
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/form-validation';

describe('emailProblem', () => {
  it('accepts a normal address and normalizes case and spaces', () => {
    expect(emailProblem(normalizeEmail('  User@Example.COM '))).toBeUndefined();
  });

  it('requires an @ and a dotted domain', () => {
    expect(emailProblem('user@example')).toBe('format');
    expect(emailProblem('userexample.com')).toBe('format');
    expect(emailProblem('user@.com')).toBe('format');
    expect(emailProblem('user@example.c')).toBe('format');
    expect(emailProblem('user @example.com')).toBe('format');
  });

  it('treats blanks as missing', () => {
    expect(emailProblem('')).toBe('required');
    expect(emailProblem('   ')).toBe('required');
  });

  it('accepts punycode and Unicode top-level domains', () => {
    expect(emailProblem('user@example.xn--o3cw4h')).toBeUndefined();
    expect(emailProblem('user@ตัวอย่าง.ไทย')).toBeUndefined();
    expect(emailProblem('user@example.ไทย')).toBeUndefined();
    expect(emailProblem('user@mail.example.co.th')).toBeUndefined();
    expect(emailProblem('user@xn--72c1a1bt4awk9o.xn--o3cw4h')).toBeUndefined();
  });

  it('keeps accepting the seed, demo and test account domains', () => {
    for (const email of [
      'admin@pawmap.local',
      'demo-admin@example.com',
      'ci-contact@pawmap.invalid',
      'first.last+tag@sub-domain.example.org',
    ])
      expect(emailProblem(email), email).toBeUndefined();
  });

  it('rejects bad domains, spaces and extra @ signs', () => {
    for (const email of [
      'user@localhost',
      'user@ไทย',
      'user@example.123',
      'user@example.ไ',
      'user@-example.com',
      'user@example-.com',
      'user@example..com',
      'user@example.com.',
      'user@exa mple.com',
      'us er@example.com',
      'user@@example.com',
      'a@b@example.com',
      '@example.com',
      'user@',
    ])
      expect(emailProblem(email), email).toBe('format');
  });

  it('caps the length and stays fast on long hostile input', () => {
    expect(emailProblem(`${'a'.repeat(64)}@${'b'.repeat(180)}.com`)).toBeUndefined();
    expect(emailProblem(`${'a'.repeat(64)}@${'b'.repeat(EMAIL_MAX_LENGTH)}.com`)).toBe('format');
    const hostile = [
      `${'a'.repeat(50_000)}@`,
      `a@${'b-'.repeat(25_000)}`,
      `a@${'b.'.repeat(25_000)}`,
      `${'@'.repeat(50_000)}`,
      `a@${'ก'.repeat(50_000)}.x`,
    ];
    const started = performance.now();
    for (const input of hostile) expect(emailProblem(input)).toBe('format');
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe('passwordProblem', () => {
  it('keeps the existing 10..128 length window', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(11); // deliberate failure for the CI demo, do not merge
    expect(passwordProblem('a'.repeat(PASSWORD_MIN_LENGTH))).toBeUndefined();
    expect(passwordProblem('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe('tooShort');
    expect(passwordProblem('a'.repeat(PASSWORD_MAX_LENGTH))).toBeUndefined();
    expect(passwordProblem('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe('tooLong');
    expect(passwordProblem('')).toBe('required');
  });
});

describe('confirmPasswordProblem', () => {
  it('flags a mismatch and an empty confirmation', () => {
    expect(confirmPasswordProblem('longenough1', 'longenough1')).toBeUndefined();
    expect(confirmPasswordProblem('longenough1', 'longenough2')).toBe('mismatch');
    expect(confirmPasswordProblem('longenough1', '')).toBe('required');
  });
});

describe('firstInvalidControl', () => {
  const control = (name: string, valid: boolean, disabled = false) => ({
    name,
    disabled,
    checkValidity: () => valid,
  });

  it('returns the first named, enabled control that fails validation', () => {
    const invalid = firstInvalidControl([
      control('', false),
      control('latitude', true),
      control('longitude', false),
      control('descriptionTh', false),
    ]);
    expect(invalid?.name).toBe('longitude');
  });

  it('skips disabled controls and passes a fully valid form', () => {
    expect(firstInvalidControl([control('districtCode', false, true)])).toBeUndefined();
    expect(firstInvalidControl([control('nameTh', true)])).toBeUndefined();
  });
});

describe('canSubmitFromStep', () => {
  it('allows submitting only from the last step', () => {
    expect([0, 1, 2, 3].map((step) => canSubmitFromStep(step, 4))).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });
  it('rejects out-of-range steps and empty step lists', () => {
    expect(canSubmitFromStep(4, 4)).toBe(false);
    expect(canSubmitFromStep(0, 0)).toBe(false);
  });
});

describe('nameProblem', () => {
  it('uses the display name rules of the input', () => {
    expect(NAME_MIN_LENGTH).toBe(2);
    expect(NAME_MAX_LENGTH).toBe(80);
    expect(nameProblem('Bestmymint')).toBeUndefined();
    expect(nameProblem('  ก  ')).toBe('tooShort');
    expect(nameProblem('   ')).toBe('required');
    expect(nameProblem('')).toBe('required');
    expect(nameProblem('a'.repeat(NAME_MAX_LENGTH + 1))).toBe('tooLong');
  });
});

describe('authFieldsForMode', () => {
  it('lists only the fields each auth mode renders', () => {
    expect(authFieldsForMode('register')).toEqual(['name', 'email', 'password', 'confirmPassword']);
    expect(authFieldsForMode('login')).toEqual(['email', 'password']);
    expect(authFieldsForMode('forgot')).toEqual(['email']);
    expect(authFieldsForMode('reset')).toEqual(['password', 'confirmPassword']);
  });
});

describe('shouldShowFieldError', () => {
  it('hides errors for untouched fields until the form is submitted', () => {
    expect(shouldShowFieldError({}, false, 'email')).toBe(false);
    expect(shouldShowFieldError({ email: true }, false, 'email')).toBe(true);
    expect(shouldShowFieldError({ email: true }, false, 'password')).toBe(false);
  });

  it('shows every error once submitted', () => {
    expect(shouldShowFieldError({}, true, 'password')).toBe(true);
    expect(shouldShowFieldError({}, true, 'confirmPassword')).toBe(true);
  });
});

describe('touchAll', () => {
  it('marks exactly the rendered fields as touched', () => {
    expect(touchAll(['email', 'password'])).toEqual({ email: true, password: true });
    expect(touchAll([])).toEqual({});
  });
});

describe('firstInvalidField', () => {
  it('returns the first invalid field in form order', () => {
    const fields = authFieldsForMode('register');
    expect(firstInvalidField(fields, {})).toBeUndefined();
    expect(firstInvalidField(fields, { password: 'too short', email: 'bad' })).toBe('email');
    expect(firstInvalidField(fields, { confirmPassword: 'mismatch' })).toBe('confirmPassword');
    expect(firstInvalidField(fields, { email: '', name: undefined })).toBeUndefined();
  });
});

describe('confirm password follows the password field', () => {
  it('reports a mismatch as soon as the password changes and stays hidden until touched', () => {
    const touched = { confirmPassword: true };
    // Typing a new password keeps the confirm error in sync because it is derived.
    expect(confirmPasswordProblem('secret-pass-1', 'secret-pass-2')).toBe('mismatch');
    expect(shouldShowFieldError(touched, false, 'confirmPassword')).toBe(true);
    expect(shouldShowFieldError({}, false, 'confirmPassword')).toBe(false);
    expect(confirmPasswordProblem('secret-pass-1', 'secret-pass-1')).toBeUndefined();
  });
});
