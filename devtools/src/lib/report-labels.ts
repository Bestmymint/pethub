/**
 * Readable names for report reasons and for what a Meetup report points at. Pure data, safe for
 * server and client components: the report forms, and the admin report lists, share these.
 */
import type { Locale } from '@/lib/i18n';

type Label = readonly [value: string, th: string, en: string];

/** The reasons the place report form offers (a subset of `ReportReason`), in its order. */
export const PLACE_REPORT_REASONS = [
  ['INCORRECT_INFORMATION', 'ข้อมูลไม่ถูกต้อง', 'Incorrect information'],
  ['TEMPORARILY_CLOSED', 'ปิดชั่วคราว', 'Temporarily closed'],
  ['PERMANENTLY_CLOSED', 'ปิดกิจการ', 'Permanently closed'],
  ['DUPLICATE', 'ข้อมูลซ้ำ', 'Duplicate'],
  ['OTHER', 'อื่น ๆ', 'Other'],
] as const satisfies readonly Label[];

/** Every `ReportReason`, for showing reports that were filed before or outside the form. */
const PLACE_REPORT_REASON_LABELS: readonly Label[] = [
  ...PLACE_REPORT_REASONS,
  ['INAPPROPRIATE_CONTENT', 'เนื้อหาไม่เหมาะสม', 'Inappropriate content'],
];

/** Reasons a Meetup, a user, a message or an image can be reported for (`MeetupReportReason`). */
export const MEETUP_REPORT_REASONS = [
  ['SPAM', 'สแปม', 'Spam'],
  ['HARASSMENT', 'คุกคามหรือรังแก', 'Harassment'],
  ['INAPPROPRIATE_CONTENT', 'เนื้อหาไม่เหมาะสม', 'Inappropriate content'],
  ['SCAM', 'หลอกลวง', 'Scam'],
  ['FAKE_MEETUP', 'Meetup ปลอม', 'Fake Meetup'],
  ['DANGEROUS_BEHAVIOR', 'พฤติกรรมอันตราย', 'Dangerous behavior'],
  ['OTHER', 'อื่น ๆ', 'Other'],
] as const satisfies readonly Label[];

/** What the chat's "report message" form offers: everything except a fake-Meetup claim. */
export const MESSAGE_REPORT_REASONS = MEETUP_REPORT_REASONS.filter(
  ([value]) => value !== 'FAKE_MEETUP',
);

export const MEETUP_REPORT_TARGETS = [
  ['MEETUP', 'Meetup', 'Meetup'],
  ['USER', 'ผู้ใช้', 'User'],
  ['MESSAGE', 'ข้อความ', 'Message'],
  ['IMAGE', 'รูปภาพ', 'Image'],
] as const satisfies readonly Label[];

function lookup(labels: readonly Label[], value: string, locale: Locale) {
  const found = labels.find(([key]) => key === value);
  // An unknown value (a reason added later) is shown as it is rather than hidden.
  return found ? found[locale === 'th' ? 1 : 2] : value;
}

export function placeReportReasonLabel(reason: string, locale: Locale = 'th') {
  return lookup(PLACE_REPORT_REASON_LABELS, reason, locale);
}

export function meetupReportReasonLabel(reason: string, locale: Locale = 'th') {
  return lookup(MEETUP_REPORT_REASONS, reason, locale);
}

export function meetupReportTargetLabel(target: string, locale: Locale = 'th') {
  return lookup(MEETUP_REPORT_TARGETS, target, locale);
}
