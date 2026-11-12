/**
 * Small validation helpers shared by the browser forms and the auth server hooks.
 * No React, Prisma or zod imports so both sides can use the same rules.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;

export type EmailProblem = 'required' | 'format';
export type PasswordProblem = 'required' | 'tooShort' | 'tooLong';
export type ConfirmPasswordProblem = 'required' | 'mismatch';
export type NameProblem = 'required' | 'tooShort' | 'tooLong';

/** RFC 5321 limit for a whole address; also keeps the checks below cheap. */
export const EMAIL_MAX_LENGTH = 254;

/** Local part: anything except whitespace and "@". */
const localPartPattern = /^[^\s@]+$/u;
/**
 * One domain label: Unicode letters, digits and hyphens (covers punycode such
 * as "xn--o3cw4h" and Unicode labels such as "ไทย"), no leading/trailing hyphen.
 * Combining marks (\p{M}) are allowed too, because Thai vowel and tone marks
 * such as "ั" and "่" in "ตัวอย่าง" are marks, not letters.
 * A single character class with one quantifier, so matching stays linear.
 */
const domainLabelPattern = /^[\p{L}\p{M}\p{N}-]+$/u;
const allDigitsPattern = /^\p{N}+$/u;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Requires a local part, exactly one "@" and a domain with at least one dot.
 * Every label uses letters/digits/hyphens without a hyphen at either end, and
 * the top-level label has 2+ characters and is not all digits:
 * "user@example.com", "user@example.xn--o3cw4h" and "user@ตัวอย่าง.ไทย" pass,
 * "user@example" and "user@example.123" do not.
 */
export function emailProblem(value: string): EmailProblem | undefined {
  const email = value.trim();
  if (!email) return 'required';
  if (email.length > EMAIL_MAX_LENGTH) return 'format';
  const at = email.indexOf('@');
  if (at !== email.lastIndexOf('@')) return 'format';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (at <= 0 || !localPartPattern.test(local) || !domain) return 'format';
  const labels = domain.split('.');
  if (labels.length < 2) return 'format';
  for (const label of labels) {
    if (!domainLabelPattern.test(label) || label.startsWith('-') || label.endsWith('-'))
      return 'format';
  }
  const tld = labels[labels.length - 1]!;
  if ([...tld].length < 2 || allDigitsPattern.test(tld)) return 'format';
  return undefined;
}

export function passwordProblem(value: string): PasswordProblem | undefined {
  if (!value) return 'required';
  if (value.length < PASSWORD_MIN_LENGTH) return 'tooShort';
  if (value.length > PASSWORD_MAX_LENGTH) return 'tooLong';
  return undefined;
}

export function confirmPasswordProblem(
  password: string,
  confirmation: string,
): ConfirmPasswordProblem | undefined {
  if (!confirmation) return 'required';
  return password === confirmation ? undefined : 'mismatch';
}

/** Same window as the display name input: required, 2..80 characters after trimming. */
export function nameProblem(value: string): NameProblem | undefined {
  const name = value.trim();
  if (!name) return 'required';
  if (name.length < NAME_MIN_LENGTH) return 'tooShort';
  if (name.length > NAME_MAX_LENGTH) return 'tooLong';
  return undefined;
}

export type AuthFormMode = 'login' | 'register' | 'forgot' | 'reset';
export type AuthFieldName = 'name' | 'email' | 'password' | 'confirmPassword';
export type TouchedFields = Partial<Record<AuthFieldName, boolean>>;

/** Fields the current mode actually renders, in DOM order. */
export function authFieldsForMode(mode: AuthFormMode): AuthFieldName[] {
  const fields: AuthFieldName[] = [];
  if (mode === 'register') fields.push('name');
  if (mode !== 'reset') fields.push('email');
  if (mode === 'login' || mode === 'register' || mode === 'reset') fields.push('password');
  if (mode === 'register' || mode === 'reset') fields.push('confirmPassword');
  return fields;
}

/** First field, in form order, that still has a message. Used to move focus on submit. */
export function firstInvalidField(
  fields: readonly AuthFieldName[],
  problems: Partial<Record<AuthFieldName, string | undefined>>,
): AuthFieldName | undefined {
  return fields.find((field) => Boolean(problems[field]));
}

/** Inline errors stay hidden until the field was touched or the form was submitted. */
export function shouldShowFieldError(
  touched: TouchedFields,
  submitted: boolean,
  field: AuthFieldName,
): boolean {
  return submitted || touched[field] === true;
}

/** Everything is marked touched on submit so every invalid field reports at once. */
export function touchAll(fields: readonly AuthFieldName[]): TouchedFields {
  return Object.fromEntries(fields.map((field) => [field, true]));
}

/** The subset of HTML form controls this module needs, so test doubles work too. */
export interface ValidatableControl {
  name: string;
  disabled: boolean;
  checkValidity(): boolean;
}

/** First enabled, named control that fails native constraint validation. */
export function firstInvalidControl<T extends ValidatableControl>(
  controls: Iterable<T>,
): T | undefined {
  for (const control of controls) {
    if (!control.name || control.disabled) continue;
    if (!control.checkValidity()) return control;
  }
  return undefined;
}

/** Only the last step of the multi-step form may submit it. */
export function canSubmitFromStep(step: number, stepCount: number) {
  return stepCount > 0 && step === stepCount - 1;
}
