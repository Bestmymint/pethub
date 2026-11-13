'use client';

import { Pin } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import type { ChatMessage } from './chat-types';
import { messageActions, type MessageActionId } from './message-actions';
import { MessageMenu } from './message-menu';

/** One message in the chat list. A pinned message only gets a small pin icon; the actions live in the "⋯" menu. */
export function MessageItem({
  message,
  locale,
  meetupId,
  viewerId,
  canModerate,
  pinned,
  pinLimitReached,
  highlighted,
  onAction,
  onUnblock,
}: {
  message: ChatMessage;
  locale: Locale;
  meetupId: string;
  viewerId: string;
  canModerate: boolean;
  pinned: boolean;
  pinLimitReached: boolean;
  /** Briefly emphasised after the user jumped here from the pinned list. */
  highlighted: boolean;
  onAction: (action: MessageActionId, message: ChatMessage) => void;
  onUnblock: (userId: string) => void;
}) {
  const th = locale === 'th';
  const isSystem = message.kind === 'SYSTEM';
  const isOwn = message.authorId === viewerId;
  const profileHref =
    message.author && message.authorIsMember
      ? withLocale(locale, `/meetups/${meetupId}/members/${encodeURIComponent(message.author.id)}`)
      : undefined;
  const actions = messageActions({ isOwn, canModerate, pinned, pinLimitReached });
  const showMenu = !message.deleted && !isSystem && !message.blocked;

  return (
    <article
      data-message-id={message.id}
      data-message-side={isSystem ? 'center' : isOwn ? 'right' : 'left'}
      tabIndex={-1}
      className={`flex w-fit max-w-[95%] items-end gap-2 text-sm outline-none sm:max-w-[75%] ${isSystem ? 'mx-auto' : isOwn ? 'ml-auto' : 'mr-auto'}`}
    >
      {!isSystem && !isOwn && !message.blocked && message.author && profileHref && (
        <a
          href={profileHref}
          className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--forest)]"
          aria-label={
            th ? `เปิดโปรไฟล์ของ ${message.author.name}` : `Open ${message.author.name}’s profile`
          }
        >
          <UserAvatar
            src={message.author.image}
            name={message.author.name}
            decorative
            className="size-8 sm:size-9"
          />
        </a>
      )}
      <div
        className={`min-w-0 rounded-2xl p-3 transition-shadow duration-500 ${isSystem ? 'bg-[var(--surface-soft)] text-center text-xs text-[var(--text-muted)]' : isOwn ? 'bg-[var(--forest-soft)]' : 'border border-[var(--border)] bg-[var(--surface)]'} ${highlighted ? 'ring-4 ring-[var(--forest-bright)]' : ''}`}
      >
        {!isSystem && (
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--forest)]">
              {message.blocked ? (
                th ? (
                  'ข้อความที่ซ่อน'
                ) : (
                  'Hidden message'
                )
              ) : message.author && profileHref ? (
                <a
                  href={profileHref}
                  className="rounded-sm underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-current"
                  aria-label={
                    th
                      ? `ดูสัตว์เลี้ยงของ ${message.author.name}`
                      : `View ${message.author.name}’s pets`
                  }
                >
                  {message.author.name}
                </a>
              ) : message.author ? (
                message.author.name
              ) : th ? (
                'สมาชิก'
              ) : (
                'Member'
              )}{' '}
              ·{' '}
              {new Intl.DateTimeFormat(th ? 'th-TH' : 'en-GB', {
                timeZone: 'Asia/Bangkok',
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(message.createdAt))}
              {pinned && (
                <span
                  role="img"
                  aria-label={th ? 'ปักหมุดแล้ว' : 'Pinned'}
                  className="ml-1.5 inline-block align-[-2px]"
                >
                  <Pin className="size-3.5" aria-hidden="true" />
                </span>
              )}
            </p>
            {showMenu && (
              <MessageMenu
                locale={locale}
                actions={actions}
                onSelect={(action) => onAction(action, message)}
              />
            )}
          </div>
        )}
        {message.replyTo && (
          <p className="mt-1 border-l-2 pl-2 text-xs text-[var(--text-muted)]">
            ↪ {message.replyTo.text?.slice(0, 100) ?? '…'}
          </p>
        )}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">
          {message.deleted
            ? th
              ? 'ข้อความถูกลบแล้ว'
              : 'Message deleted'
            : message.blocked
              ? th
                ? 'คุณบล็อกผู้ส่งข้อความนี้'
                : 'You blocked this sender'
              : message.text}
        </p>
        {message.mediaUrl && (
          <Image
            unoptimized
            width={600}
            height={400}
            src={message.mediaUrl}
            alt={th ? 'รูปในแชต Meetup' : 'Meetup chat image'}
            className="mt-2 max-h-80 max-w-full rounded-lg object-contain"
          />
        )}
        {message.blocked && message.authorId && (
          <Button size="sm" variant="ghost" onClick={() => onUnblock(message.authorId!)}>
            {th ? 'เลิกบล็อก' : 'Unblock'}
          </Button>
        )}
      </div>
    </article>
  );
}
