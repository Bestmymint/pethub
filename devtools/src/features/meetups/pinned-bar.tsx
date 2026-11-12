'use client';

import { ChevronRight, Pin } from 'lucide-react';

import type { Locale } from '@/lib/i18n';
import { pinPreview } from './chat-pins';
import type { ChatMessage } from './chat-types';

/** Compact bar under the chat title: the latest pinned message on one line and how many are pinned. */
export function PinnedBar({
  locale,
  pins,
  total,
  onOpen,
}: {
  locale: Locale;
  /** Newest pin first. */
  pins: ChatMessage[];
  total: number;
  onOpen: () => void;
}) {
  const latest = pins[0];
  if (!latest) return null;
  const th = locale === 'th';
  const preview = pinPreview(latest, locale, 200);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={
        th
          ? `ข้อความที่ปักหมุด ${total} ข้อความ ล่าสุด: ${preview} เปิดรายการทั้งหมด`
          : `${total} pinned ${total === 1 ? 'message' : 'messages'}, latest: ${preview}. Open the list`
      }
      className="mt-3 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-left text-sm hover:bg-[var(--forest-soft)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
      onClick={onOpen}
    >
      <Pin className="size-4 shrink-0 text-[var(--forest)]" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate" aria-hidden="true">
        {preview}
      </span>
      <span
        className="shrink-0 rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--forest)]"
        aria-hidden="true"
      >
        {total}
      </span>
      <ChevronRight className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
    </button>
  );
}
