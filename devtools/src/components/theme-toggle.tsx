'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Toaster } from 'sonner';
import type { Locale } from '@/lib/i18n';
import { getServerTheme, getTheme, setTheme, subscribeTheme } from '@/lib/theme';

export function ThemeToggle({ locale = 'th' }: { locale?: Locale }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={locale === 'th' ? 'สลับโหมดสว่าง/มืด' : 'Toggle light/dark mode'}
      aria-pressed={theme === 'dark'}
      title={
        locale === 'th'
          ? theme === 'dark'
            ? 'ใช้โหมดสว่าง'
            : 'ใช้โหมดมืด'
          : theme === 'dark'
            ? 'Use light mode'
            : 'Use dark mode'
      }
      onClick={() => setTheme(getTheme() === 'dark' ? 'light' : 'dark')}
    >
      <Moon className="theme-icon-moon" size={18} aria-hidden="true" />
      <Sun className="theme-icon-sun" size={18} aria-hidden="true" />
    </button>
  );
}

export function ThemeToaster() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  return <Toaster theme={theme} richColors position="top-center" />;
}
