import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { MessageItem } from '@/features/meetups/message-item';
import { toMessageDto, type MessageRow } from '@/features/meetups/message-dto';
import type { ChatMessage } from '@/features/meetups/chat-types';

const message = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  kind: 'TEXT',
  text: 'สวัสดี',
  mediaUrl: null,
  author: { id: 'demo_user_5', name: 'กิตติพงษ์ ศรีสุข', image: null },
  authorId: 'demo_user_5',
  authorIsMember: true,
  blocked: false,
  deleted: false,
  pinned: false,
  pinnedAt: null,
  createdAt: '2026-11-12T16:13:00.000Z',
  replyTo: null,
  ...over,
});

const render = (m: ChatMessage) =>
  renderToStaticMarkup(
    createElement(MessageItem, {
      message: m,
      locale: 'th',
      meetupId: 'demo_meetup_1',
      viewerId: 'viewer',
      canModerate: false,
      pinned: false,
      pinLimitReached: false,
      highlighted: false,
      onAction: () => undefined,
      onUnblock: () => undefined,
    }),
  );

describe('message author link', () => {
  it('links the name and avatar of an active member to their profile', () => {
    const html = render(message());
    expect(html).toContain('/meetups/demo_meetup_1/members/demo_user_5');
    expect(html).toContain('กิตติพงษ์ ศรีสุข');
  });

  it('shows a former member’s name as plain text, with no profile link', () => {
    const html = render(message({ authorIsMember: false }));
    expect(html).not.toContain('/members/');
    expect(html).toContain('กิตติพงษ์ ศรีสุข');
  });
});

describe('toMessageDto authorIsMember', () => {
  const row = (authorId: string | null) =>
    ({
      id: 'm1',
      kind: 'TEXT',
      text: 'x',
      objectKey: null,
      authorId,
      author: authorId ? { id: authorId, name: 'n', image: null } : null,
      replyTo: null,
      pinnedAt: null,
      deletedAt: null,
      createdAt: new Date('2026-11-12T16:13:00Z'),
    }) as unknown as MessageRow;

  it('is true only for an active member', () => {
    const members = new Set(['a']);
    expect(toMessageDto(row('a'), new Set(), members).authorIsMember).toBe(true);
    expect(toMessageDto(row('b'), new Set(), members).authorIsMember).toBe(false);
    expect(toMessageDto(row(null), new Set(), members).authorIsMember).toBe(false);
  });
});
