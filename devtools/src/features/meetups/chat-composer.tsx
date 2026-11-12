'use client';

import { Paperclip, SendHorizontal, Smile, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';

import type { Locale } from '@/lib/i18n';
import { meetupActionError } from './action-errors';
import { pinPreview } from './chat-pins';
import type { ChatMessage } from './chat-types';
import {
  CHAT_MAX_LENGTH,
  canSend,
  composerHeight,
  shouldSendOnKey,
  submitDraft,
} from './composer-logic';

const EMOJIS = ['🙂', '🐕', '🐈', '❤️'];

const iconButton =
  'grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--forest)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Message box of the group chat: a rounded, auto-growing field (up to about six lines, then it
 * scrolls), icon buttons for attaching a photo and for emoji, and a round send button.
 * Enter sends, Shift+Enter starts a new line, and Enter never sends while an input method is
 * composing text. A message that fails to send stays in the box.
 */
export function ChatComposer({
  locale,
  onSend,
  onUpload,
  busy = false,
  replyTo,
  onCancelReply,
}: {
  locale: Locale;
  onSend: (text: string) => Promise<{ ok: boolean; formError?: string }>;
  onUpload: (file: File) => Promise<void>;
  /** Something else (a photo upload) is in progress. */
  busy?: boolean;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
}) {
  const th = locale === 'th';
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const sendingNow = useRef(false);

  // Grow with the content, then scroll after the sixth line.
  useLayoutEffect(() => {
    const field = textarea.current;
    if (!field) return;
    field.style.height = 'auto';
    const style = getComputedStyle(field);
    const { height, scrollable } = composerHeight({
      scrollHeight: field.scrollHeight,
      lineHeight: Number.parseFloat(style.lineHeight) || 20,
      verticalPadding: Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom),
    });
    field.style.height = `${height}px`;
    field.style.overflowY = scrollable ? 'auto' : 'hidden';
  }, [text]);

  async function send() {
    // The ref closes the gap between two quick Enter presses and the re-render that disables sending.
    if (sendingNow.current || !canSend(text, sending || busy)) return;
    sendingNow.current = true;
    setSending(true);
    const outcome = await submitDraft(text, onSend);
    sendingNow.current = false;
    setSending(false);
    if (outcome.ok) {
      setText('');
      setEmojiOpen(false);
    } else {
      toast.error(meetupActionError(outcome.error, locale));
    }
    textarea.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!shouldSendOnKey(event)) return;
    event.preventDefault();
    void send();
  }

  function addEmoji(emoji: string) {
    const field = textarea.current;
    if (!field) return;
    field.setRangeText(emoji, field.selectionStart, field.selectionEnd, 'end');
    setText(field.value.slice(0, CHAT_MAX_LENGTH));
    field.focus();
  }

  function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void onUpload(file);
  }

  const disabled = sending || busy;
  return (
    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-1.5 text-xs">
          <span className="min-w-0 flex-1 truncate">
            {th ? 'ตอบกลับ' : 'Replying to'}: {pinPreview(replyTo, locale, 80)}
          </span>
          <button
            type="button"
            className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-[var(--surface)]"
            aria-label={th ? 'ยกเลิกการตอบกลับ' : 'Cancel reply'}
            onClick={onCancelReply}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1">
        <button
          type="button"
          className={iconButton}
          aria-label={th ? 'ส่งรูป' : 'Send image'}
          disabled={disabled}
          onClick={() => fileInput.current?.click()}
        >
          <Paperclip className="size-5" aria-hidden="true" />
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          onChange={onFileChosen}
        />
        <button
          type="button"
          className={iconButton}
          aria-label={th ? 'เพิ่มอีโมจิ' : 'Add emoji'}
          aria-expanded={emojiOpen}
          aria-controls="meetup-chat-emoji"
          onClick={() => setEmojiOpen((open) => !open)}
        >
          <Smile className="size-5" aria-hidden="true" />
        </button>
        <label htmlFor="meetup-chat-input" className="sr-only">
          {th ? 'ข้อความ' : 'Message'}
        </label>
        <textarea
          ref={textarea}
          id="meetup-chat-input"
          rows={1}
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={th ? 'พิมพ์ข้อความ…' : 'Write a message…'}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-10 min-w-0 flex-1 resize-none rounded-2xl bg-[var(--surface-soft)] px-4 py-2.5 text-sm leading-5 outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        />
        <button
          type="button"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--action)] text-[var(--on-action)] transition hover:bg-[var(--action-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={th ? 'ส่งข้อความ' : 'Send'}
          disabled={!canSend(text, disabled)}
          onClick={() => void send()}
        >
          <SendHorizontal className="size-5" aria-hidden="true" />
        </button>
      </div>
      {text.length > CHAT_MAX_LENGTH * 0.9 && (
        <p className="mt-1 text-right text-xs text-[var(--text-muted)]">
          {text.length}/{CHAT_MAX_LENGTH}
        </p>
      )}
      {emojiOpen && (
        <div id="meetup-chat-emoji" className="mt-2 flex gap-1 px-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="grid size-9 cursor-pointer place-items-center rounded-full text-lg hover:bg-[var(--surface-soft)]"
              aria-label={`${th ? 'เพิ่มอีโมจิ' : 'Add emoji'} ${emoji}`}
              onClick={() => addEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
