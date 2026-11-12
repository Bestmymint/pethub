import { describe, expect, it } from 'vitest';

import { MAX_PINNED_MESSAGES, pinLimitReached, pinPreview } from '@/features/meetups/chat-pins';
import { messageActions } from '@/features/meetups/message-actions';

describe('pin limit', () => {
  it('allows ten pins per meetup', () => {
    expect(MAX_PINNED_MESSAGES).toBe(10);
  });

  it('blocks the eleventh pin but allows the tenth', () => {
    expect(pinLimitReached(0)).toBe(false);
    expect(pinLimitReached(MAX_PINNED_MESSAGES - 1)).toBe(false);
    expect(pinLimitReached(MAX_PINNED_MESSAGES)).toBe(true);
    expect(pinLimitReached(MAX_PINNED_MESSAGES + 3)).toBe(true);
  });

  it('never blocks pinning a message that is already pinned', () => {
    expect(pinLimitReached(MAX_PINNED_MESSAGES, true)).toBe(false);
  });
});

describe('pinPreview', () => {
  it('collapses whitespace into one line', () => {
    expect(pinPreview({ text: '  นัดเจอ\n\nสวนลุม   17:00 ', kind: 'TEXT' }, 'th')).toBe(
      'นัดเจอ สวนลุม 17:00',
    );
  });

  it('describes an image without text', () => {
    expect(pinPreview({ text: null, kind: 'IMAGE' }, 'th')).toBe('รูปภาพ');
    expect(pinPreview({ text: null, kind: 'IMAGE' }, 'en')).toBe('Photo');
  });

  it('cuts long text with an ellipsis without splitting Thai characters', () => {
    const preview = pinPreview({ text: 'สวัสดีครับ'.repeat(30), kind: 'TEXT' }, 'th', 20);
    expect([
      ...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(preview),
    ]).toHaveLength(20);
    expect(preview.endsWith('…')).toBe(true);
    expect(pinPreview({ text: 'short', kind: 'TEXT' }, 'en', 20)).toBe('short');
  });
});

describe('messageActions', () => {
  const ids = (input: Parameters<typeof messageActions>[0]) =>
    messageActions(input).map((action) => action.id);
  const member = { canModerate: false, pinned: false, pinLimitReached: false };

  it('offers exactly one report entry on other people’s messages', () => {
    expect(ids({ ...member, isOwn: false }).filter((id) => id === 'report')).toHaveLength(1);
    expect(ids({ ...member, isOwn: false })).toEqual(['reply', 'report']);
  });

  it('hides report on the user’s own messages and lets them delete', () => {
    expect(ids({ ...member, isOwn: true })).toEqual(['reply', 'delete']);
  });

  it('gives pin, unpin and delete only to moderators', () => {
    expect(ids({ ...member, isOwn: false, canModerate: true })).toEqual([
      'reply',
      'pin',
      'delete',
      'report',
    ]);
    expect(ids({ ...member, isOwn: false, canModerate: true, pinned: true })).toEqual([
      'reply',
      'unpin',
      'delete',
      'report',
    ]);
    expect(ids({ ...member, isOwn: false })).not.toContain('pin');
  });

  it('shows pin as disabled at the limit, but unpin stays usable', () => {
    const atLimit = messageActions({
      ...member,
      isOwn: false,
      canModerate: true,
      pinLimitReached: true,
    });
    expect(atLimit.find((action) => action.id === 'pin')?.disabled).toBe(true);
    const pinned = messageActions({
      ...member,
      isOwn: false,
      canModerate: true,
      pinned: true,
      pinLimitReached: true,
    });
    expect(pinned.find((action) => action.id === 'unpin')?.disabled).toBeUndefined();
  });
});
