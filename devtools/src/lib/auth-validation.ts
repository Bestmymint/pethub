/**
 * Pure request checks for the Better Auth `hooks.before` middleware in `auth.ts`.
 *
 * The register, reset-password and profile forms apply the same rules in the
 * browser (see `form-validation`); these checks re-apply them on the server so a
 * direct API call cannot skip them. Better Auth runs its own email and password
 * length checks after this, and its rate limiter runs before it.
 */

import { emailProblem, nameProblem, normalizeEmail, passwordProblem } from '@/lib/form-validation';

export interface AuthValidationError {
  code:
    | 'INVALID_EMAIL_FORMAT'
    | 'PASSWORD_TOO_SHORT'
    | 'PASSWORD_TOO_LONG'
    | 'NAME_REQUIRED'
    | 'NAME_TOO_SHORT'
    | 'NAME_TOO_LONG';
  message: string;
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/** Reads a string field from an untrusted request body. */
function bodyString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' ? value : '';
}

function checkName(name: string): AuthValidationError | undefined {
  const problem = nameProblem(name);
  if (problem === 'required') return { code: 'NAME_REQUIRED', message: 'Name is required' };
  if (problem === 'tooShort') return { code: 'NAME_TOO_SHORT', message: 'Name is too short' };
  if (problem === 'tooLong') return { code: 'NAME_TOO_LONG', message: 'Name is too long' };
  return undefined;
}

function checkPassword(password: string): AuthValidationError | undefined {
  const problem = passwordProblem(password);
  if (problem === 'tooShort')
    return { code: 'PASSWORD_TOO_SHORT', message: 'Password is too short' };
  if (problem === 'tooLong') return { code: 'PASSWORD_TOO_LONG', message: 'Password is too long' };
  // An empty password is left to Better Auth, which rejects it with its own error.
  return undefined;
}

/**
 * Returns the first rule the request breaks, or undefined when it may continue.
 * Only `/sign-up/email`, `/reset-password` and `/update-user` (when a name is
 * sent) are checked; every other path passes through untouched.
 */
export function authRequestProblem(
  path: string,
  rawBody: unknown,
): AuthValidationError | undefined {
  const body = bodyRecord(rawBody);
  if (path === '/sign-up/email') {
    if (emailProblem(normalizeEmail(bodyString(body, 'email'))))
      return {
        code: 'INVALID_EMAIL_FORMAT',
        message: 'Enter a valid email address, for example name@example.com',
      };
    return checkName(bodyString(body, 'name')) ?? checkPassword(bodyString(body, 'password'));
  }
  if (path === '/reset-password') return checkPassword(bodyString(body, 'newPassword'));
  if (path === '/update-user' && 'name' in body && body.name !== undefined)
    return checkName(bodyString(body, 'name'));
  return undefined;
}
