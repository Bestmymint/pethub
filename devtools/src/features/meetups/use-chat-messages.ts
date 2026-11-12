'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { markMeetupChatRead } from './actions';
import type { ChatMessage, ChatMessagePage, ChatPinnedList } from './chat-types';

/** How many older pages a jump to a pinned message may load (50 messages each) before it gives up. */
export const MAX_JUMP_PAGES = 10;

function byTime(a: ChatMessage, b: ChatMessage) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/**
 * Loads the chat of one meetup: the newest page and the pinned list (refreshed whenever the server
 * says something changed), older pages on demand, and a bounded "load until this message is here".
 */
export function useChatMessages({
  id,
  locale,
  onBeforePrepend,
}: {
  id: string;
  locale: Locale;
  /** Called right before older messages are added at the top, so the view can keep its scroll position. */
  onBeforePrepend: () => void;
}) {
  const th = locale === 'th';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pins, setPins] = useState<ChatMessage[]>([]);
  const [pinTotal, setPinTotal] = useState(0);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [before, setBefore] = useState<string | null>(null);
  const [error, setError] = useState('');
  const loaded = useRef<ChatMessage[]>([]);
  const cursor = useRef<string | null>(null);
  const initialPageLoaded = useRef(false);

  useEffect(() => {
    loaded.current = messages;
  }, [messages]);

  const reload = useCallback(async () => {
    const [messagesResponse, pinsResponse] = await Promise.all([
      fetch(`/api/meetups/${id}/messages`, { cache: 'no-store' }),
      fetch(`/api/meetups/${id}/messages/pinned`, { cache: 'no-store' }),
    ]);
    if (messagesResponse.status === 401 || messagesResponse.status === 404) {
      window.location.href = withLocale(locale, `/meetups/${id}`);
      return;
    }
    if (!messagesResponse.ok) {
      setError(th ? 'โหลดแชตไม่สำเร็จ' : 'Could not load chat');
      return;
    }
    const data = (await messagesResponse.json()) as ChatMessagePage;
    setMessages((current) => {
      if (!current.length) return data.items;
      const merged = new Map(current.map((message) => [message.id, message]));
      for (const message of data.items) merged.set(message.id, message);
      return [...merged.values()].sort(byTime);
    });
    if (!initialPageLoaded.current) {
      cursor.current = data.before;
      setBefore(data.before);
      initialPageLoaded.current = true;
    }
    if (pinsResponse.ok) {
      const list = (await pinsResponse.json()) as ChatPinnedList;
      setPins(list.items);
      setPinTotal(list.total);
      setPinsLoaded(true);
    }
    void markMeetupChatRead(id);
    setError('');
  }, [id, locale, th]);

  useEffect(() => {
    queueMicrotask(() => void reload());
    const events = new EventSource(`/api/meetups/${id}/events`);
    events.addEventListener('refresh', () => void reload());
    events.addEventListener('revoked', () => {
      events.close();
      window.location.href = withLocale(locale, `/meetups/${id}`);
    });
    events.onerror = () =>
      setError(th ? 'การเชื่อมต่อขัดข้อง กำลังเชื่อมต่อใหม่…' : 'Connection lost; reconnecting…');
    return () => events.close();
  }, [id, locale, reload, th]);

  /** Fetches one older page and adds it at the top. Returns the page, or null when it failed. */
  const loadPage = useCallback(async () => {
    if (!cursor.current) return null;
    const response = await fetch(
      `/api/meetups/${id}/messages?before=${encodeURIComponent(cursor.current)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as ChatMessagePage;
    onBeforePrepend();
    setMessages((current) => {
      const known = new Set(current.map((message) => message.id));
      return [...data.items.filter((message) => !known.has(message.id)), ...current];
    });
    cursor.current = data.before;
    setBefore(data.before);
    return data;
  }, [id, onBeforePrepend]);

  /** Makes sure a message is in the list, loading older pages if needed. False when it was not found. */
  const ensureLoaded = useCallback(
    async (messageId: string) => {
      if (loaded.current.some((message) => message.id === messageId)) return true;
      for (let pages = 0; pages < MAX_JUMP_PAGES; pages += 1) {
        const page = await loadPage();
        if (!page) return false;
        if (page.items.some((message) => message.id === messageId)) return true;
        if (!page.before) return false;
      }
      return false;
    },
    [loadPage],
  );

  return {
    messages,
    pins,
    pinTotal,
    pinsLoaded,
    hasMore: Boolean(before),
    error,
    setError,
    reload,
    loadPage,
    ensureLoaded,
  };
}
