/** Message as the chat API sends it (see `message-dto.ts`). Safe to import from client components. */
export interface ChatMessage {
  id: string;
  kind: 'TEXT' | 'IMAGE' | 'SYSTEM';
  text: string | null;
  mediaUrl: string | null;
  author: { id: string; name: string; image?: string | null } | null;
  authorId: string | null;
  /** The viewer blocked the sender: text, image and author are withheld. */
  blocked: boolean;
  deleted: boolean;
  pinned: boolean;
  /** ISO time of the pin; null when the message is not pinned. */
  pinnedAt: string | null;
  createdAt: string;
  replyTo: { id: string; text: string | null } | null;
}

export interface ChatMessagePage {
  items: ChatMessage[];
  /** Cursor for the next older page, or null when there is none. */
  before: string | null;
}

export interface ChatPinnedList {
  /** Newest pin first. */
  items: ChatMessage[];
  /** Number of pinned messages in the meetup (may exceed items.length only for old data above the limit). */
  total: number;
}
