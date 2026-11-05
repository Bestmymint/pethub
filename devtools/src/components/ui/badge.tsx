import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Badge({
  children,
  tone = 'emerald',
  className,
}: {
  children: ReactNode;
  tone?: 'emerald' | 'coral' | 'red' | 'blue' | 'neutral';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold',
        tone === 'emerald' && 'bg-[var(--forest-soft)] text-[var(--forest)]',
        tone === 'coral' && 'bg-[var(--peach)] text-[var(--accent-ink)]',
        tone === 'red' && 'bg-[var(--terracotta-soft)] text-[var(--terracotta)]',
        tone === 'blue' && 'bg-[var(--sage)] text-[var(--forest)]',
        tone === 'neutral' && 'bg-[var(--surface-soft)] text-[var(--text-muted)]',
        className,
      )}
    >
      {children}
    </span>
  );
}
