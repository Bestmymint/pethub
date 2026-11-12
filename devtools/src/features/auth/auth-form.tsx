'use client';

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { authClient } from '@/lib/auth-client';
import {
  authFieldsForMode,
  confirmPasswordProblem,
  emailProblem,
  firstInvalidField,
  nameProblem,
  normalizeEmail,
  passwordProblem,
  shouldShowFieldError,
  touchAll,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type AuthFieldName,
  type AuthFormMode,
  type TouchedFields,
} from '@/lib/form-validation';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';

type AuthMode = AuthFormMode;

type FieldErrors = Partial<Record<AuthFieldName, string>>;

/** Field values that the inline validators read. Inputs are controlled so the
 * error clears on the keystroke that fixes it. */
type FieldValues = Record<AuthFieldName, string>;

const emptyValues: FieldValues = { name: '', email: '', password: '', confirmPassword: '' };

function fieldMessages(isThai: boolean) {
  return {
    nameRequired: isThai ? 'กรุณากรอกชื่อที่แสดง' : 'Display name is required',
    nameTooShort: isThai
      ? `ชื่อที่แสดงต้องมีอย่างน้อย ${NAME_MIN_LENGTH} ตัวอักษร`
      : `Display name must be at least ${NAME_MIN_LENGTH} characters`,
    nameTooLong: isThai
      ? `ชื่อที่แสดงต้องไม่เกิน ${NAME_MAX_LENGTH} ตัวอักษร`
      : `Display name must be at most ${NAME_MAX_LENGTH} characters`,
    emailRequired: isThai ? 'กรุณากรอกอีเมล' : 'Email is required',
    emailFormat: isThai
      ? 'รูปแบบอีเมลไม่ถูกต้อง ต้องมี @ และโดเมน เช่น name@example.com'
      : 'Enter a valid email address, for example name@example.com',
    passwordRequired: isThai ? 'กรุณากรอกรหัสผ่าน' : 'Password is required',
    passwordTooShort: isThai
      ? `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`
      : `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    passwordTooLong: isThai
      ? `รหัสผ่านต้องไม่เกิน ${PASSWORD_MAX_LENGTH} ตัวอักษร`
      : `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
    confirmRequired: isThai ? 'กรุณากรอกรหัสผ่านอีกครั้ง' : 'Confirm your password',
    confirmMismatch: isThai ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : 'Passwords do not match',
    emailTaken: isThai ? 'อีเมลนี้มีบัญชีอยู่แล้ว' : 'This email is already registered',
    invalidCredentials: isThai ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : 'Incorrect email or password',
    showPassword: isThai ? 'แสดงรหัสผ่าน' : 'Show password',
    hidePassword: isThai ? 'ซ่อนรหัสผ่าน' : 'Hide password',
  };
}

type AuthFieldMessage = 'emailTaken' | 'invalidEmail' | 'invalidCredentials';

/** Maps the better-auth error codes this app can surface to readable messages. */
function authErrorKey(code: string | undefined): AuthFieldMessage | undefined {
  switch (code) {
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'emailTaken';
    case 'INVALID_EMAIL':
    case 'INVALID_EMAIL_FORMAT':
      return 'invalidEmail';
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_PASSWORD':
      return 'invalidCredentials';
    default:
      return undefined;
  }
}

/**
 * Password input with the app's password styling: lock icon, an independent
 * show/hide toggle and an inline error that the caller controls.
 */
function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  errorId,
  autoComplete,
  showLabel,
  hideLabel,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  errorId: string;
  autoComplete: 'current-password' | 'new-password';
  showLabel: string;
  hideLabel: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="grid gap-1.5 text-sm font-bold">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <LockKeyhole className="absolute top-3.5 left-3.5 size-4 text-[var(--text-muted)]" />
        <Input
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          className="px-10"
          autoComplete={autoComplete}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        <button
          type="button"
          // Keep the caret in the input: toggling visibility must not blur (and
          // therefore validate) the field or any other field.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setShown((current) => !current)}
          className="absolute top-2 right-2 grid size-9 place-items-center rounded-full hover:bg-[var(--forest-soft)]"
          aria-pressed={shown}
          aria-controls={id}
          aria-label={shown ? hideLabel : showLabel}
        >
          {shown ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <span id={errorId} role="alert" className="text-xs font-semibold text-[var(--terracotta)]">
          {error}
        </span>
      )}
    </div>
  );
}

export function AuthForm({ mode, locale }: { mode: AuthMode; locale: Locale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [values, setValues] = useState<FieldValues>(emptyValues);
  const [touched, setTouched] = useState<TouchedFields>({});
  const [submitted, setSubmitted] = useState(false);
  /** Errors returned by the server (better-auth), shown next to the field. */
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const isThai = locale === 'th';
  const messages = fieldMessages(isThai);
  const fields = authFieldsForMode(mode);

  /** Inline validation of the current values; recomputed on every render. */
  function problemsFor(current: FieldValues): FieldErrors {
    const problems: FieldErrors = {};
    if (mode === 'register') {
      const problem = nameProblem(current.name);
      if (problem === 'required') problems.name = messages.nameRequired;
      else if (problem === 'tooShort') problems.name = messages.nameTooShort;
      else if (problem === 'tooLong') problems.name = messages.nameTooLong;
    }
    if (mode === 'login') {
      // Sign-in only needs a non-empty value: an existing account must never be
      // blocked by a format rule that is stricter than when it was created.
      if (!current.email.trim()) problems.email = messages.emailRequired;
    } else if (mode !== 'reset') {
      const problem = emailProblem(current.email);
      if (problem === 'required') problems.email = messages.emailRequired;
      else if (problem === 'format') problems.email = messages.emailFormat;
    }
    if (mode === 'login') {
      if (!current.password) problems.password = messages.passwordRequired;
    } else if (mode === 'register' || mode === 'reset') {
      const problem = passwordProblem(current.password);
      if (problem === 'required') problems.password = messages.passwordRequired;
      else if (problem === 'tooShort') problems.password = messages.passwordTooShort;
      else if (problem === 'tooLong') problems.password = messages.passwordTooLong;
      const confirmation = confirmPasswordProblem(current.password, current.confirmPassword);
      if (confirmation === 'required') problems.confirmPassword = messages.confirmRequired;
      else if (confirmation === 'mismatch') problems.confirmPassword = messages.confirmMismatch;
    }
    return problems;
  }

  const problems = problemsFor(values);

  function errorFor(field: AuthFieldName) {
    if (!shouldShowFieldError(touched, submitted, field)) return undefined;
    return serverErrors[field] ?? problems[field];
  }

  function change(field: AuthFieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  function blur(field: AuthFieldName) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function passwordMessageForCode(code: string | undefined) {
    if (code === 'PASSWORD_TOO_SHORT') return messages.passwordTooShort;
    if (code === 'PASSWORD_TOO_LONG') return messages.passwordTooLong;
    return undefined;
  }

  function nameMessageForCode(code: string | undefined) {
    if (code === 'NAME_REQUIRED') return messages.nameRequired;
    if (code === 'NAME_TOO_SHORT') return messages.nameTooShort;
    if (code === 'NAME_TOO_LONG') return messages.nameTooLong;
    return undefined;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitted(true);
    setTouched(touchAll(fields));

    // Read the DOM: browser autofill can change inputs without a React change event.
    const form = new FormData(event.currentTarget);
    const current: FieldValues = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      confirmPassword: String(form.get('confirmPassword') ?? ''),
    };
    setValues(current);
    const currentProblems = problemsFor(current);
    const invalid = firstInvalidField(
      fields,
      serverErrors.email ? { ...currentProblems, ...serverErrors } : currentProblems,
    );
    if (invalid) {
      setPending(false);
      const control = event.currentTarget.elements.namedItem(invalid);
      if (control instanceof HTMLElement) control.focus();
      return;
    }

    setPending(true);
    const email = normalizeEmail(current.email);
    const password = current.password;
    const name = current.name.trim();

    try {
      if (mode === 'login') {
        const result = await authClient.signIn.email({
          email,
          password,
          rememberMe: form.get('remember') === 'on',
        });
        if (result.error) {
          const key = authErrorKey(result.error.code);
          if (key === 'emailTaken') setServerErrors({ email: messages.emailTaken });
          else if (key === 'invalidEmail') setServerErrors({ email: messages.emailFormat });
          else if (key === 'invalidCredentials') setError(messages.invalidCredentials);
          else throw new Error(result.error.message);
          return;
        }
        const next = searchParams.get('next');
        router.push(
          next?.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
            ? next
            : withLocale(locale, '/explore'),
        );
        router.refresh();
      } else if (mode === 'register') {
        const result = await authClient.signUp.email({ email, password, name });
        if (result.error) {
          const key = authErrorKey(result.error.code);
          const emailMessage =
            key === 'emailTaken'
              ? messages.emailTaken
              : key === 'invalidEmail'
                ? messages.emailFormat
                : undefined;
          if (emailMessage) {
            setServerErrors({ email: emailMessage });
            return;
          }
          const nameMessage = nameMessageForCode(result.error.code);
          if (nameMessage) {
            setServerErrors({ name: nameMessage });
            return;
          }
          const passwordMessage = passwordMessageForCode(result.error.code);
          if (passwordMessage) {
            setServerErrors({ password: passwordMessage });
            return;
          }
          throw new Error(result.error.message);
        }
        toast.success(isThai ? 'สร้างบัญชีสำเร็จ' : 'Account created');
        router.push(withLocale(locale, '/profile'));
        router.refresh();
      } else if (mode === 'forgot') {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}${withLocale(locale, '/reset-password')}`,
        });
        if (result.error) throw new Error(result.error.message);
        toast.success(
          isThai
            ? 'หากอีเมลนี้มีบัญชี เราได้ส่งลิงก์รีเซ็ตแล้ว'
            : 'If the account exists, a reset link has been sent.',
        );
        // The inputs are controlled, so clearing state is what empties the form.
        setValues(emptyValues);
        setTouched({});
        setSubmitted(false);
      } else {
        const token = searchParams.get('token');
        if (!token) throw new Error(isThai ? 'ลิงก์รีเซ็ตไม่สมบูรณ์' : 'The reset link is invalid');
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) {
          const passwordMessage =
            passwordMessageForCode(result.error.code) ??
            (passwordProblem(password) === 'tooShort' ? messages.passwordTooShort : undefined);
          if (passwordMessage) {
            setServerErrors({ password: passwordMessage });
            return;
          }
          throw new Error(result.error.message);
        }
        toast.success(
          isThai ? 'ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ' : 'Password reset. Please sign in.',
        );
        router.push(withLocale(locale, '/login'));
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : isThai
            ? 'เกิดข้อผิดพลาด'
            : 'Something went wrong',
      );
    } finally {
      setPending(false);
    }
  }

  const titles: Record<AuthMode, [string, string]> = {
    login: ['ยินดีต้อนรับกลับมา', 'Welcome back'],
    register: ['เริ่มสำรวจไปด้วยกัน', 'Start exploring together'],
    forgot: ['ลืมรหัสผ่าน', 'Forgot password'],
    reset: ['ตั้งรหัสผ่านใหม่', 'Set a new password'],
  };
  const descriptions: Record<AuthMode, [string, string]> = {
    login: [
      'เข้าสู่ระบบเพื่อดูแลน้องและสำรวจสถานที่ด้วยกัน',
      'Sign in to care for your pet and explore together.',
    ],
    register: ['สร้างบัญชีผู้ใช้ทั่วไปอย่างปลอดภัย', 'Create a secure community account.'],
    forgot: ['เราจะส่งลิงก์ทดสอบไปยัง Mailpit', 'We will send a test link to Mailpit.'],
    reset: ['การรีเซ็ตจะยกเลิก session เดิมทั้งหมด', 'Resetting revokes all previous sessions.'],
  };

  return (
    <main
      lang={locale}
      className="page-shell relative grid min-h-screen bg-[var(--background)] lg:grid-cols-[0.9fr_1.1fr]"
    >
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle locale={locale} />
      </div>
      <aside className="relative hidden overflow-hidden border-r border-[var(--border)] bg-[var(--surface-soft)] p-12 text-[var(--forest)] lg:flex lg:flex-col lg:justify-between">
        <a href={withLocale(locale, '/')} className="inline-flex w-fit" aria-label="PetHub">
          <BrandLogo />
        </a>
        <div className="relative z-10 max-w-lg">
          <p className="text-xs font-semibold tracking-[0.1em] text-[var(--text-muted)] uppercase">
            PetHub
          </p>
          <p className="mt-5 text-4xl leading-[1.18] font-bold tracking-[-0.03em]">
            {isThai
              ? 'ทุกการเดินทาง เริ่มจากข้อมูลที่ไว้ใจได้'
              : 'Every journey starts with information you can trust.'}
          </p>
          <p className="mt-6 max-w-md leading-8 text-[var(--text-muted)]">
            {isThai
              ? 'บันทึกสถานที่ ช่วยยืนยันข้อมูล และสร้างแผนที่ที่ดีกว่าไปด้วยกัน'
              : 'Save places, verify details, and build a better map together.'}
          </p>
        </div>
      </aside>
      <section className="grid place-items-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-7 sm:p-9">
          <a href={withLocale(locale, '/')} className="inline-flex lg:hidden" aria-label="PetHub">
            <BrandLogo />
          </a>
          <h1 className="mt-8 text-3xl font-bold tracking-[-0.025em] text-[var(--forest)]">
            {titles[mode][isThai ? 0 : 1]}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {descriptions[mode][isThai ? 0 : 1]}
          </p>
          <form className="mt-7 grid gap-4" onSubmit={submit} noValidate>
            {mode === 'register' && (
              <label className="grid gap-1.5 text-sm font-bold">
                {isThai ? 'ชื่อที่แสดง' : 'Display name'}
                <span className="relative">
                  <UserRound className="absolute top-3.5 left-3.5 size-4 text-[var(--text-muted)]" />
                  <Input
                    name="name"
                    required
                    minLength={NAME_MIN_LENGTH}
                    maxLength={NAME_MAX_LENGTH}
                    className="pl-10"
                    autoComplete="name"
                    value={values.name}
                    aria-invalid={Boolean(errorFor('name'))}
                    aria-describedby={errorFor('name') ? 'name-error' : undefined}
                    onChange={(event) => change('name', event.target.value)}
                    onBlur={() => blur('name')}
                  />
                </span>
                {errorFor('name') && (
                  <span
                    id="name-error"
                    role="alert"
                    className="text-xs font-semibold text-[var(--terracotta)]"
                  >
                    {errorFor('name')}
                  </span>
                )}
              </label>
            )}
            {mode !== 'reset' && (
              <label className="grid gap-1.5 text-sm font-bold">
                {isThai ? 'อีเมล' : 'Email'}
                <span className="relative">
                  <Mail className="absolute top-3.5 left-3.5 size-4 text-[var(--text-muted)]" />
                  <Input
                    name="email"
                    type="email"
                    required
                    className="pl-10"
                    autoComplete="email"
                    value={values.email}
                    aria-invalid={Boolean(errorFor('email'))}
                    aria-describedby={errorFor('email') ? 'email-error' : undefined}
                    onChange={(event) => change('email', event.target.value)}
                    onBlur={() => blur('email')}
                  />
                </span>
                {errorFor('email') && (
                  <span
                    id="email-error"
                    role="alert"
                    className="text-xs font-semibold text-[var(--terracotta)]"
                  >
                    {errorFor('email')}
                  </span>
                )}
              </label>
            )}
            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <PasswordField
                id={`${mode}-password`}
                name="password"
                label={isThai ? 'รหัสผ่าน' : 'Password'}
                value={values.password}
                onChange={(value) => change('password', value)}
                onBlur={() => blur('password')}
                error={errorFor('password')}
                errorId="password-error"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                showLabel={messages.showPassword}
                hideLabel={messages.hidePassword}
              />
            )}
            {(mode === 'register' || mode === 'reset') && (
              <PasswordField
                id={`${mode}-confirm-password`}
                name="confirmPassword"
                label={isThai ? 'ยืนยันรหัสผ่าน' : 'Confirm password'}
                value={values.confirmPassword}
                onChange={(value) => change('confirmPassword', value)}
                onBlur={() => blur('confirmPassword')}
                error={errorFor('confirmPassword')}
                errorId="confirm-password-error"
                autoComplete="new-password"
                showLabel={messages.showPassword}
                hideLabel={messages.hidePassword}
              />
            )}
            {mode === 'login' && (
              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex items-center gap-2 font-semibold">
                  <input
                    name="remember"
                    type="checkbox"
                    className="size-4 accent-[var(--forest-bright)]"
                  />
                  {isThai ? 'จดจำฉัน' : 'Remember me'}
                </label>
                <a
                  className="font-bold text-[var(--forest-bright)] hover:underline"
                  href={withLocale(locale, '/forgot-password')}
                >
                  {isThai ? 'ลืมรหัสผ่าน?' : 'Forgot password?'}
                </a>
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-2xl border border-[var(--terracotta)] bg-[var(--terracotta-soft)] px-4 py-3 text-sm font-semibold text-[var(--terracotta)]"
              >
                {error}
              </p>
            )}
            <Button type="submit" className="mt-1 w-full" disabled={pending}>
              {pending
                ? isThai
                  ? 'กำลังดำเนินการ…'
                  : 'Working…'
                : mode === 'login'
                  ? isThai
                    ? 'เข้าสู่ระบบ'
                    : 'Sign in'
                  : mode === 'register'
                    ? isThai
                      ? 'สร้างบัญชี'
                      : 'Create account'
                    : mode === 'forgot'
                      ? isThai
                        ? 'ส่งลิงก์รีเซ็ต'
                        : 'Send reset link'
                      : isThai
                        ? 'บันทึกรหัสผ่านใหม่'
                        : 'Save new password'}
              {!pending && <ArrowRight className="size-4" />}
            </Button>
          </form>
          {(mode === 'login' || mode === 'register') && (
            <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
              {mode === 'login'
                ? isThai
                  ? 'ยังไม่มีบัญชี? '
                  : 'New here? '
                : isThai
                  ? 'มีบัญชีแล้ว? '
                  : 'Already registered? '}
              <a
                className="font-extrabold text-[var(--forest-bright)] hover:underline"
                href={withLocale(locale, mode === 'login' ? '/register' : '/login')}
              >
                {mode === 'login'
                  ? isThai
                    ? 'สมัครสมาชิก'
                    : 'Create an account'
                  : isThai
                    ? 'เข้าสู่ระบบ'
                    : 'Sign in'}
              </a>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
