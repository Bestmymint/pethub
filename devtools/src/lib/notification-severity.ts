import type { NotificationType } from '@prisma/client';

/**
 * One central place that gives every notification its severity.
 *
 * `severityForType` is exhaustive over the `NotificationType` enum: adding a new
 * type to `prisma/schema.prisma` makes this file fail to typecheck until the new
 * type is classified.
 *
 * `MEETUP` is a single enum value for many different Meetup events, so it is
 * refined by `severityForMeetup` — using only the data already stored on the row
 * (metadata and the localized titles). Anything unrecognised stays `info`, so a
 * notification is never labelled as a failure or an approval by accident.
 */

export type NotificationSeverity = 'success' | 'attention' | 'negative' | 'info';

export const notificationSeverities: readonly NotificationSeverity[] = [
  'success',
  'attention',
  'negative',
  'info',
];

export function severityForType(type: NotificationType): NotificationSeverity {
  switch (type) {
    case 'SUBMISSION_APPROVED':
      return 'success';
    case 'SUBMISSION_REJECTED':
      return 'negative';
    case 'SUBMISSION_NEEDS_REVISION':
      return 'attention';
    case 'FAVORITE_UPDATED':
    case 'SYSTEM':
    case 'MEETUP':
      return 'info';
    default: {
      // Makes an unclassified NotificationType a compile error.
      const unclassified: never = type;
      return unclassified;
    }
  }
}

export interface NotificationLike {
  type: NotificationType;
  titleTh?: string | null;
  titleEn?: string | null;
  metadata?: unknown;
}

/** Titles are matched in this order so "not approved" never reads as "approved". */
const negativePhrases = [
  'ไม่ผ่านการอนุมัติ',
  'ยกเลิก',
  'ถูกแบน',
  'ถูกนำออก',
  'declined',
  'cancelled',
  'canceled',
  'banned',
  'removed',
];
const successPhrases = ['อนุมัติ', 'หัวกลุ่ม', 'approved', 'host'];
const attentionPhrases = [
  'ขอเข้าร่วม',
  'ใกล้เริ่ม',
  'เปลี่ยนแปลง',
  'request',
  'starting soon',
  'changed',
  'reminder',
];

function metadataKind(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const kind = (metadata as { kind?: unknown }).kind;
  return typeof kind === 'string' ? kind : undefined;
}

function severityForMeetup(item: NotificationLike): NotificationSeverity {
  if (metadataKind(item.metadata) === 'MEETUP_CHAT') return 'info';
  const text = `${item.titleTh ?? ''} ${item.titleEn ?? ''}`.toLowerCase();
  if (negativePhrases.some((phrase) => text.includes(phrase))) return 'negative';
  if (successPhrases.some((phrase) => text.includes(phrase))) return 'success';
  if (attentionPhrases.some((phrase) => text.includes(phrase))) return 'attention';
  return 'info';
}

export function severityForNotification(item: NotificationLike): NotificationSeverity {
  const base = severityForType(item.type);
  if (item.type === 'MEETUP') return severityForMeetup(item);
  return base;
}

/** Text for screen readers, so the severity does not rely on colour or shape alone. */
export function severityLabel(severity: NotificationSeverity, locale: 'th' | 'en'): string {
  switch (severity) {
    case 'success':
      return locale === 'th' ? 'การแจ้งเตือน: สำเร็จ' : 'Notification: success';
    case 'attention':
      return locale === 'th' ? 'การแจ้งเตือน: ต้องดำเนินการ' : 'Notification: action needed';
    case 'negative':
      return locale === 'th'
        ? 'การแจ้งเตือน: ไม่ผ่านหรือถูกยกเลิก'
        : 'Notification: rejected or cancelled';
    case 'info':
      return locale === 'th' ? 'การแจ้งเตือน: ข้อมูลข่าวสาร' : 'Notification: information';
  }
}
