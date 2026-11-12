'use client';

import { MoreHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import type { Locale } from '@/lib/i18n';
import { MAX_PINNED_MESSAGES } from './chat-pins';
import type { MessageAction, MessageActionId } from './message-actions';

const MENU_WIDTH = 192;
const ITEM_HEIGHT = 40;

function actionLabel(action: MessageAction, locale: Locale) {
  const th = locale === 'th';
  switch (action.id) {
    case 'reply':
      return th ? 'ตอบกลับ' : 'Reply';
    case 'pin':
      return action.disabled
        ? th
          ? `ปักหมุด (ครบ ${MAX_PINNED_MESSAGES} ข้อความแล้ว)`
          : `Pin (limit of ${MAX_PINNED_MESSAGES} reached)`
        : th
          ? 'ปักหมุด'
          : 'Pin';
    case 'unpin':
      return th ? 'เลิกปักหมุด' : 'Unpin';
    case 'delete':
      return th ? 'ลบ' : 'Delete';
    case 'report':
      return th ? 'รายงาน' : 'Report';
  }
}

/**
 * The "⋯" menu of one message. It is positioned with `position: fixed`, so the scrolling message
 * list cannot clip it, and it opens upwards near the bottom of the screen. Keyboard: Enter or Space
 * opens it, the arrow keys, Home and End move, Escape closes and returns focus to the button.
 */
export function MessageMenu({
  locale,
  actions,
  onSelect,
}: {
  locale: Locale;
  actions: MessageAction[];
  onSelect: (id: MessageActionId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function openMenu() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const height = actions.length * ITEM_HEIGHT + 8;
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    const fitsBelow = rect.bottom + 4 + height <= window.innerHeight - 8;
    setPosition({ left, top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - 4 - height) });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const close = () => setOpen(false);
    const closeOutside = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        close();
    };
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(items.length - 1);
    else if (event.key === 'Tab') setOpen(false);
  }

  function select(action: MessageAction) {
    if (action.disabled) return;
    setOpen(false);
    trigger.current?.focus();
    onSelect(action.id);
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={locale === 'th' ? 'การทำงานกับข้อความ' : 'Message actions'}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--forest)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label={locale === 'th' ? 'การทำงานกับข้อความ' : 'Message actions'}
          style={{ position: 'fixed', top: position.top, left: position.left, width: MENU_WIDTH }}
          className="z-[70] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg"
          onKeyDown={onKeyDown}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              aria-disabled={action.disabled || undefined}
              className={`flex min-h-10 w-full cursor-pointer items-center rounded-lg px-3 text-left text-sm hover:bg-[var(--surface-soft)] focus-visible:bg-[var(--surface-soft)] focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${action.id === 'delete' ? 'text-[var(--terracotta)]' : ''}`}
              onClick={() => select(action)}
            >
              {actionLabel(action, locale)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
