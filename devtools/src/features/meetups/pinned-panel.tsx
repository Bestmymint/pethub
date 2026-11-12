'use client';

import { Pin, PinOff, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import type { Locale } from '@/lib/i18n';
import { MAX_PINNED_MESSAGES, pinPreview } from './chat-pins';
import type { ChatMessage } from './chat-types';

/**
 * Modal list of every pinned message. Picking one asks the chat to scroll to it. It is a native
 * dialog, so focus moves into it, Tab stays inside, and Escape closes it; the caller puts focus back.
 */
export function PinnedPanel({
  locale,
  open,
  pins,
  total,
  canModerate,
  busy,
  onClose,
  onJump,
  onUnpin,
}: {
  locale: Locale;
  open: boolean;
  /** Newest pin first. */
  pins: ChatMessage[];
  total: number;
  canModerate: boolean;
  busy: boolean;
  onClose: () => void;
  onJump: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
}) {
  const th = locale === 'th';
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[80dvh] w-[min(32rem,calc(100%-2rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-[#181c1a]/50"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
        <h2 id={titleId} className="flex items-center gap-2 text-lg font-bold">
          <Pin className="size-5 text-[var(--forest)]" aria-hidden="true" />
          {th ? 'ข้อความที่ปักหมุด' : 'Pinned messages'}
          <span className="text-sm font-normal text-[var(--text-muted)]">
            {total}/{MAX_PINNED_MESSAGES}
          </span>
        </h2>
        <button
          type="button"
          className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-[var(--surface-soft)]"
          aria-label={th ? 'ปิด' : 'Close'}
          onClick={onClose}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <ul className="grid max-h-[calc(80dvh-4.5rem)] gap-1 overflow-y-auto p-2">
        {pins.map((message) => (
          <li key={message.id} className="flex items-stretch gap-1">
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
              onClick={() => onJump(message.id)}
            >
              <span className="block text-xs font-semibold text-[var(--forest)]">
                {message.author?.name ?? (th ? 'สมาชิก' : 'Member')} ·{' '}
                {new Intl.DateTimeFormat(th ? 'th-TH' : 'en-GB', {
                  timeZone: 'Asia/Bangkok',
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(message.createdAt))}
              </span>
              <span className="mt-0.5 line-clamp-2 block break-words text-sm">
                {pinPreview(message, locale, 240)}
              </span>
            </button>
            {canModerate && (
              <button
                type="button"
                className="grid w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--terracotta)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={th ? 'เลิกปักหมุดข้อความนี้' : 'Unpin this message'}
                disabled={busy}
                onClick={() => onUnpin(message.id)}
              >
                <PinOff className="size-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
        {pins.length === 0 && (
          <li className="p-4 text-center text-sm text-[var(--text-muted)]">
            {th ? 'ยังไม่มีข้อความที่ปักหมุด' : 'No pinned messages yet.'}
          </li>
        )}
      </ul>
    </dialog>
  );
}
