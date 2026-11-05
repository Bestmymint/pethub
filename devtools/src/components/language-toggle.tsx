'use client';

import { Languages } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function LanguageToggle({ locale }: { locale: 'th' | 'en' }) {
  const pathname = usePathname();
  const target =
    locale === 'th'
      ? `/en${pathname === '/' ? '' : pathname}`
      : pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  return (
    <a
      href={target}
      className="language-toggle inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--forest)] hover:bg-[var(--sage)]"
      aria-label={locale === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
    >
      <Languages className="size-4" aria-hidden="true" />
      {locale === 'th' ? 'EN' : 'ไทย'}
    </a>
  );
}
