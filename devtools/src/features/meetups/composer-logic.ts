/** Pure behaviour of the chat composer, kept apart from React so it can be unit tested. */

/** Same limit as `sendMeetupMessage` (1..2000 characters after trimming). */
export const CHAT_MAX_LENGTH = 2000;
export const COMPOSER_MAX_LINES = 6;

export interface ComposerKeyEvent {
  key: string;
  shiftKey: boolean;
  keyCode?: number;
  isComposing?: boolean;
  nativeEvent?: { isComposing?: boolean; keyCode?: number };
}

/**
 * True while an input method (Thai, Japanese, Korean, ...) is composing text. Enter then confirms the
 * candidate and must not send. Some browsers report this only through keyCode 229.
 */
export function isImeComposing(event: ComposerKeyEvent) {
  return (
    event.isComposing === true ||
    event.nativeEvent?.isComposing === true ||
    event.keyCode === 229 ||
    event.nativeEvent?.keyCode === 229
  );
}

/** Enter sends; Shift+Enter inserts a newline; Enter during IME composition does neither. */
export function shouldSendOnKey(event: ComposerKeyEvent) {
  return event.key === 'Enter' && !event.shiftKey && !isImeComposing(event);
}

/** Send is allowed for non-blank text within the length limit, and not while a send is in flight. */
export function canSend(text: string, sending: boolean) {
  return !sending && text.trim().length > 0 && text.length <= CHAT_MAX_LENGTH;
}

export type SendOutcome =
  | { ok: true; draft: '' }
  /** `error` is the server's code or message, to be shown by the caller; the draft is kept. */
  | { ok: false; draft: string; error: string | undefined };

/**
 * Sends the draft. The draft is cleared only when the send succeeds; a failed or thrown send keeps
 * it, so nothing the user typed is lost.
 */
export async function submitDraft(
  draft: string,
  send: (text: string) => Promise<{ ok: boolean; formError?: string }>,
): Promise<SendOutcome> {
  try {
    const result = await send(draft);
    return result.ok ? { ok: true, draft: '' } : { ok: false, draft, error: result.formError };
  } catch {
    return { ok: false, draft, error: undefined };
  }
}

/** Height for an auto-growing textarea: grows with its content up to `maxLines`, then scrolls. */
export function composerHeight({
  scrollHeight,
  lineHeight,
  verticalPadding,
  maxLines = COMPOSER_MAX_LINES,
}: {
  scrollHeight: number;
  lineHeight: number;
  verticalPadding: number;
  maxLines?: number;
}) {
  const max = lineHeight * maxLines + verticalPadding;
  return { height: Math.min(scrollHeight, max), scrollable: scrollHeight > max };
}
