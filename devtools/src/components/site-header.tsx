'use client';

import { Heart, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

import { BrandLogo } from '@/components/brand-logo';
import { LanguageToggle } from '@/components/language-toggle';
import { NotificationBell } from '@/components/notification-bell';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignOutButton } from '@/features/user/sign-out-button';
import { authClient } from '@/lib/auth-client';
import type { Locale } from '@/lib/i18n';
import { t, withLocale } from '@/lib/i18n';

export function SiteHeader({ locale = 'th' }: { locale?: Locale }) {
  const copy = t(locale);
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    [withLocale(locale, '/explore'), copy.explore],
    [withLocale(locale, '/pets'), locale === 'th' ? 'สัตว์เลี้ยงของฉัน' : 'My pets'],
    [withLocale(locale, '/meetups'), locale === 'th' ? 'Meetup' : 'Meetups'],
    [withLocale(locale, '/my-submissions'), copy.submissions],
  ] as const;
  return (
    <header className="site-header sticky top-0 z-50 border-b border-[var(--border)]">
      <div className="header-row container-shell grid min-h-20 grid-cols-[1fr_auto] items-center gap-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <a href={withLocale(locale, '/')} className="shrink-0 justify-self-start">
          <BrandLogo />
        </a>
        <nav className="hidden items-center gap-1 xl:flex" aria-label="Main navigation">
          {links.map(([href, label]) => (
            <a
              key={href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--forest)]"
              href={href}
              aria-current={
                pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined
              }
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions flex min-w-0 items-center justify-self-end gap-2">
          <a
            className="hidden rounded-md p-2.5 text-[var(--forest)] transition hover:bg-[var(--surface-soft)] sm:inline-flex"
            href={withLocale(locale, '/favorites')}
            aria-label={copy.favorites}
          >
            <Heart className="size-5" aria-hidden="true" />
          </a>
          <NotificationBell locale={locale} enabled={Boolean(session)} />
          <ThemeToggle locale={locale} />
          <LanguageToggle locale={locale} />
          {session?.user.role === 'ADMIN' && (
            <a
              className="hidden min-h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--forest)] hover:bg-[var(--forest-soft)] xl:inline-flex"
              href="/admin"
              aria-label={copy.admin}
              title={copy.admin}
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              <span className="header-admin-label">{copy.admin}</span>
            </a>
          )}
          {session ? (
            <a
              className="header-profile-link hidden min-h-10 items-center gap-2 rounded-md bg-[var(--action)] px-4 text-sm font-semibold text-[var(--on-action)] hover:bg-[var(--action-hover)] md:inline-flex"
              href={withLocale(locale, '/profile')}
              title={session.user.name}
              aria-label={`${copy.profile}: ${session.user.name}`}
            >
              <UserRound className="size-4" aria-hidden="true" />
              <span className="header-profile-name">{session.user.name}</span>
            </a>
          ) : (
            <a
              className="hidden min-h-10 items-center gap-2 rounded-md bg-[var(--action)] px-4 text-sm font-semibold text-[var(--on-action)] hover:bg-[var(--action-hover)] md:inline-flex"
              href={withLocale(locale, '/login')}
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              {copy.login}
            </a>
          )}
          <button
            onClick={() => setMenuOpen((value) => !value)}
            className="header-menu-toggle inline-grid size-10 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] xl:hidden"
            aria-label={
              menuOpen
                ? locale === 'th'
                  ? 'ปิดเมนู'
                  : 'Close menu'
                : locale === 'th'
                  ? 'เปิดเมนู'
                  : 'Open menu'
            }
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav
          className="container-shell grid gap-1 border-t border-[var(--border)] py-3 xl:hidden"
          aria-label="Mobile navigation"
        >
          {links.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-xl px-4 py-3 text-sm font-bold hover:bg-[var(--surface)]"
            >
              {label}
            </a>
          ))}
          {session ? (
            <>
              <a
                href={withLocale(locale, '/profile')}
                className="rounded-xl px-4 py-3 text-sm font-bold hover:bg-[var(--surface)]"
              >
                {copy.profile}
              </a>
              {session.user.role === 'ADMIN' && (
                <a
                  href="/admin"
                  className="rounded-xl px-4 py-3 text-sm font-bold hover:bg-[var(--surface)]"
                >
                  {copy.admin}
                </a>
              )}
              <SignOutButton
                locale={locale}
                variant="ghost"
                className="justify-start rounded-xl px-4 py-3 text-left text-[var(--terracotta)] hover:bg-[var(--surface)]"
              />
            </>
          ) : (
            <a
              href={withLocale(locale, '/login')}
              className="rounded-xl px-4 py-3 text-sm font-bold text-[var(--forest-bright)] hover:bg-[var(--surface)]"
            >
              {copy.login}
            </a>
          )}
        </nav>
      )}
    </header>
  );
}
