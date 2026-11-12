'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { meetupActionError } from './action-errors';
import {
  deleteMeetupMessage,
  pinMeetupMessage,
  reportMeetup,
  sendMeetupMessage,
  setUserBlocked,
} from './actions';
import { ChatComposer } from './chat-composer';
import { pinLimitReached } from './chat-pins';
import type { ChatMessage } from './chat-types';
import type { MessageActionId } from './message-actions';
import { MessageItem } from './message-item';
import { PinnedBar } from './pinned-bar';
import { PinnedPanel } from './pinned-panel';
import { ReportForm } from './report-form';
import { useChatMessages } from './use-chat-messages';

const HIGHLIGHT_MS = 2000;

export function MeetupChatRoom({
  locale,
  id,
  title,
  viewerId,
  canModerate,
  writable,
}: {
  locale: Locale;
  id: string;
  /** The meetup's name, shown as the chat title. */
  title: string;
  viewerId: string;
  canModerate: boolean;
  writable: boolean;
}) {
  const th = locale === 'th';
  const scrollArea = useRef<HTMLElement>(null);
  const nearBottom = useRef(true);
  const preservedHeight = useRef<number | null>(null);
  const previousLength = useRef(0);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reportOpener = useRef<HTMLElement | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [hasNew, setHasNew] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [jump, setJump] = useState<{ id: string } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const keepScrollPosition = useCallback(() => {
    preservedHeight.current = scrollArea.current?.scrollHeight ?? null;
  }, []);
  const chat = useChatMessages({ id, locale, onBeforePrepend: keepScrollPosition });
  const { messages, pins, pinTotal, pinsLoaded } = chat;

  const pinnedIds = useMemo(() => new Set(pins.map((pin) => pin.id)), [pins]);
  const isPinned = (message: ChatMessage) =>
    pinsLoaded ? pinnedIds.has(message.id) : message.pinned;

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  useLayoutEffect(() => {
    const area = scrollArea.current;
    if (!area) return;
    if (preservedHeight.current !== null) {
      area.scrollTop += area.scrollHeight - preservedHeight.current;
      preservedHeight.current = null;
    } else if (nearBottom.current) {
      area.scrollTop = area.scrollHeight;
      setHasNew(false);
    } else if (messages.length > previousLength.current) {
      setHasNew(true);
    }
    previousLength.current = messages.length;
  }, [messages]);

  // Scrolls the list (not the page) to the message picked in the pinned list and moves focus to it.
  useEffect(() => {
    if (!jump) return;
    const area = scrollArea.current;
    const element = area?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(jump.id)}"]`);
    if (!area || !element) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const areaBox = area.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    area.scrollTo({
      top: area.scrollTop + box.top - areaBox.top - (area.clientHeight - box.height) / 2,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
    element.focus({ preventScroll: true });
  }, [jump]);

  async function jumpTo(messageId: string) {
    const found = await chat.ensureLoaded(messageId);
    if (!found) {
      toast.info(
        th
          ? 'ข้อความนี้เก่าเกินกว่าจะโหลดมาแสดงในแชตได้ในตอนนี้ แต่ยังอ่านได้ในรายการปักหมุด'
          : 'This message is too old to load into the chat right now, but you can still read it in the pinned list.',
      );
      return;
    }
    setPanelOpen(false);
    setJump({ id: messageId });
    // Flash the message for a moment so the eye finds it.
    setHighlightId(messageId);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
  }

  async function run(task: () => Promise<{ ok: boolean; formError?: string }>) {
    setPending(true);
    const result = await task();
    setPending(false);
    if (!result.ok) toast.error(meetupActionError(result.formError, locale));
    else await chat.reload();
    return result.ok;
  }

  async function send(text: string) {
    const result = await sendMeetupMessage(id, text, replyTo?.id);
    if (!result.ok) return { ok: false, formError: result.formError };
    setReplyTo(null);
    nearBottom.current = true;
    await chat.reload();
    return { ok: true };
  }

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.set('scope', 'chat');
    form.set('file', file);
    const response = await fetch(`/api/meetups/${id}/upload`, { method: 'POST', body: form });
    setUploading(false);
    if (!response.ok) {
      toast.error(
        th
          ? 'ส่งรูปไม่สำเร็จ (JPEG/PNG/WebP ไม่เกิน 5 MB)'
          : 'Image failed (JPEG/PNG/WebP, up to 5 MB)',
      );
      return;
    }
    nearBottom.current = true;
    await chat.reload();
  }

  function onAction(action: MessageActionId, message: ChatMessage) {
    if (action === 'reply') {
      setReplyTo(message);
      document.getElementById('meetup-chat-input')?.focus();
    } else if (action === 'delete') {
      if (window.confirm(th ? 'ลบข้อความ?' : 'Delete message?'))
        void run(() => deleteMeetupMessage(id, message.id));
    } else if (action === 'pin' || action === 'unpin') {
      void run(() => pinMeetupMessage(id, message.id, action === 'pin'));
    } else {
      reportOpener.current = document.activeElement as HTMLElement | null;
      setReportId(message.id);
    }
  }

  function closeReport() {
    setReportId(null);
    reportOpener.current?.focus();
  }

  async function submitReport(reason: string) {
    if (!reportId) return;
    const ok = await run(() => reportMeetup(id, { target: 'MESSAGE', targetId: reportId, reason }));
    if (ok) toast.success(th ? 'ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน' : 'Report sent. Thank you.');
    closeReport();
  }

  return (
    <main className="container-shell max-w-3xl py-8">
      <a
        href={withLocale(locale, `/meetups/${id}`)}
        className="text-sm text-[var(--forest)] underline"
      >
        ← {th ? 'รายละเอียด Meetup' : 'Meetup details'}
      </a>
      <p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">
        {th ? 'แชตกลุ่ม' : 'Group chat'}
      </p>
      <h1 className="mt-0.5 break-words text-2xl font-semibold [overflow-wrap:anywhere]">
        {title}
      </h1>
      <PinnedBar locale={locale} pins={pins} total={pinTotal} onOpen={() => setPanelOpen(true)} />
      <PinnedPanel
        locale={locale}
        open={panelOpen}
        pins={pins}
        total={pinTotal}
        canModerate={canModerate}
        busy={pending}
        onClose={() => setPanelOpen(false)}
        onJump={(messageId) => void jumpTo(messageId)}
        onUnpin={(messageId) => void run(() => pinMeetupMessage(id, messageId, false))}
      />
      {chat.error && (
        <p role="alert" className="mt-3 text-sm text-[var(--terracotta)]">
          {chat.error}
        </p>
      )}
      <section
        ref={scrollArea}
        role="log"
        aria-live="polite"
        onScroll={(event) => {
          const area = event.currentTarget;
          nearBottom.current = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
          if (nearBottom.current) setHasNew(false);
        }}
        className="mt-3 h-[min(62dvh,680px)] min-h-80 space-y-3 overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
        aria-label={th ? 'ข้อความในแชต' : 'Chat messages'}
      >
        {chat.hasMore && (
          <Button variant="ghost" onClick={() => void chat.loadPage()}>
            {th ? 'ข้อความก่อนหน้า' : 'Earlier messages'}
          </Button>
        )}
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            locale={locale}
            meetupId={id}
            viewerId={viewerId}
            canModerate={canModerate}
            pinned={isPinned(message)}
            pinLimitReached={pinLimitReached(pinTotal)}
            highlighted={highlightId === message.id}
            onAction={onAction}
            onUnblock={(userId) => void run(() => setUserBlocked(userId, false))}
          />
        ))}
      </section>
      {hasNew && (
        <Button
          variant="secondary"
          className="mt-2"
          onClick={() => {
            if (scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
            nearBottom.current = true;
            setHasNew(false);
          }}
        >
          {th ? 'ไปยังข้อความใหม่' : 'Jump to new messages'}
        </Button>
      )}
      {reportId && (
        <ReportForm
          locale={locale}
          pending={pending}
          onSubmit={(reason) => void submitReport(reason)}
          onCancel={closeReport}
        />
      )}
      {writable ? (
        <ChatComposer
          locale={locale}
          onSend={send}
          onUpload={upload}
          busy={uploading}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      ) : (
        <p className="mt-4 rounded-xl border bg-[var(--surface)] p-4 text-sm" role="status">
          {th ? 'แชตนี้อยู่ในโหมดอ่านอย่างเดียว' : 'This chat is read-only.'}
        </p>
      )}
    </main>
  );
}
