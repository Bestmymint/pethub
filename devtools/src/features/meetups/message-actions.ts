export type MessageActionId = 'reply' | 'pin' | 'unpin' | 'delete' | 'report';

export interface MessageAction {
  id: MessageActionId;
  /** Shown but not usable (for example pinning when the pin limit is reached). */
  disabled?: boolean;
}

/**
 * The actions the "⋯" menu offers for one message, in display order.
 *
 * Mirrors the server rules: only the host or an admin (`canModerate`) can pin and unpin, the author
 * or a moderator can delete, and there is exactly one report entry. Reporting your own message makes
 * no sense, so it is left out.
 */
export function messageActions({
  isOwn,
  canModerate,
  pinned,
  pinLimitReached,
}: {
  isOwn: boolean;
  canModerate: boolean;
  pinned: boolean;
  pinLimitReached: boolean;
}): MessageAction[] {
  const actions: MessageAction[] = [{ id: 'reply' }];
  if (canModerate) {
    actions.push(pinned ? { id: 'unpin' } : { id: 'pin', disabled: pinLimitReached });
  }
  if (isOwn || canModerate) actions.push({ id: 'delete' });
  if (!isOwn) actions.push({ id: 'report' });
  return actions;
}
