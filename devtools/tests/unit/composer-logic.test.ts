import { describe, expect, it, vi } from 'vitest';

import {
  CHAT_MAX_LENGTH,
  canSend,
  composerHeight,
  isImeComposing,
  shouldSendOnKey,
  submitDraft,
} from '@/features/meetups/composer-logic';

const key = (overrides: Partial<Parameters<typeof shouldSendOnKey>[0]> = {}) => ({
  key: 'Enter',
  shiftKey: false,
  ...overrides,
});

describe('Enter handling', () => {
  it('sends on a plain Enter', () => {
    expect(shouldSendOnKey(key())).toBe(true);
  });

  it('inserts a newline on Shift+Enter instead of sending', () => {
    expect(shouldSendOnKey(key({ shiftKey: true }))).toBe(false);
  });

  it('ignores other keys', () => {
    expect(shouldSendOnKey(key({ key: 'a' }))).toBe(false);
    expect(shouldSendOnKey(key({ key: 'Tab' }))).toBe(false);
  });

  it('does not send while an IME composition is active (Thai, Japanese, Korean)', () => {
    expect(shouldSendOnKey(key({ isComposing: true }))).toBe(false);
    expect(shouldSendOnKey(key({ nativeEvent: { isComposing: true } }))).toBe(false);
  });

  it('treats keyCode 229 as composition, as Safari reports it after compositionend', () => {
    expect(shouldSendOnKey(key({ keyCode: 229 }))).toBe(false);
    expect(shouldSendOnKey(key({ nativeEvent: { keyCode: 229 } }))).toBe(false);
    expect(isImeComposing(key({ keyCode: 13 }))).toBe(false);
  });

  it('sends again once composition has ended', () => {
    expect(shouldSendOnKey(key({ isComposing: false, nativeEvent: { isComposing: false } }))).toBe(
      true,
    );
  });
});

describe('canSend', () => {
  it('rejects empty and whitespace-only drafts', () => {
    expect(canSend('', false)).toBe(false);
    expect(canSend('   \n\t ', false)).toBe(false);
  });

  it('rejects while a send is in flight', () => {
    expect(canSend('hello', true)).toBe(false);
    expect(canSend('hello', false)).toBe(true);
  });

  it('respects the maximum message length', () => {
    expect(CHAT_MAX_LENGTH).toBe(2000);
    expect(canSend('a'.repeat(CHAT_MAX_LENGTH), false)).toBe(true);
    expect(canSend('a'.repeat(CHAT_MAX_LENGTH + 1), false)).toBe(false);
  });
});

describe('submitDraft', () => {
  it('clears the draft after a successful send', async () => {
    const send = vi.fn(async () => ({ ok: true }));
    expect(await submitDraft('สวัสดี', send)).toEqual({ ok: true, draft: '' });
    expect(send).toHaveBeenCalledWith('สวัสดี');
  });

  it('keeps the draft and reports the error when the server refuses', async () => {
    const send = async () => ({ ok: false, formError: 'MEETUP_CHAT_READ_ONLY' });
    expect(await submitDraft('keep me', send)).toEqual({
      ok: false,
      draft: 'keep me',
      error: 'MEETUP_CHAT_READ_ONLY',
    });
  });

  it('keeps the draft when the send throws (network failure)', async () => {
    const send = async () => {
      throw new Error('network down');
    };
    expect(await submitDraft('still here', send)).toEqual({
      ok: false,
      draft: 'still here',
      error: undefined,
    });
  });
});

describe('composerHeight', () => {
  const sizes = { lineHeight: 20, verticalPadding: 16 };

  it('grows with the content', () => {
    expect(composerHeight({ ...sizes, scrollHeight: 36 })).toEqual({
      height: 36,
      scrollable: false,
    });
    expect(composerHeight({ ...sizes, scrollHeight: 76 })).toEqual({
      height: 76,
      scrollable: false,
    });
  });

  it('stops at six lines and then scrolls', () => {
    expect(composerHeight({ ...sizes, scrollHeight: 136 })).toEqual({
      height: 136,
      scrollable: false,
    });
    expect(composerHeight({ ...sizes, scrollHeight: 400 })).toEqual({
      height: 136,
      scrollable: true,
    });
  });
});
