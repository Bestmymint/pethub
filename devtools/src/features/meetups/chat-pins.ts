import type { Locale } from '@/lib/i18n';
import type { ChatMessage } from './chat-types';

/** At most this many messages can be pinned in one meetup (enforced in `pinMeetupMessage`). */
export const MAX_PINNED_MESSAGES = 10;

/** Upper bound for the pinned endpoint, so old data above the limit cannot make it unbounded. */
export const PINNED_LIST_CAP = 50;

/** True when pinning one more message would exceed the limit. Re-pinning a pinned message never does. */
export function pinLimitReached(pinnedCount: number, alreadyPinned = false) {
  return !alreadyPinned && pinnedCount >= MAX_PINNED_MESSAGES;
}

function truncateGraphemes(value: string, max: number) {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const parts = [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(value)];
    return parts.length <= max
      ? value
      : `${parts
          .slice(0, max - 1)
          .map((part) => part.segment)
          .join('')}…`;
  }
  const chars = [...value];
  return chars.length <= max ? value : `${chars.slice(0, max - 1).join('')}…`;
}

/** One-line text for the pinned bar and list: whitespace collapsed, images described, long text cut. */
export function pinPreview(
  message: Pick<ChatMessage, 'text' | 'kind'>,
  locale: Locale,
  maxLength = 120,
) {
  const text = (message.text ?? '').replace(/\s+/gu, ' ').trim();
  if (text) return truncateGraphemes(text, maxLength);
  if (message.kind === 'IMAGE') return locale === 'th' ? 'รูปภาพ' : 'Photo';
  return '…';
}
