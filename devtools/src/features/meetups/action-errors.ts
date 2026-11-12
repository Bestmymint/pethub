import type { Locale } from '@/lib/i18n';
import { MAX_PINNED_MESSAGES } from './chat-pins';

const messages: Record<string, [string, string]> = {
  MEETUP_LOGIN_REQUIRED: ['กรุณาเข้าสู่ระบบก่อน', 'Please sign in first.'],
  MEETUP_ADMIN_CANNOT_JOIN: [
    'ผู้ดูแลไม่ต้องส่งคำขอเข้าร่วม',
    'Admins do not need to request joining.',
  ],
  MEETUP_NOT_FOUND: ['ไม่พบกิจกรรมนี้', 'Meetup not found.'],
  MEETUP_NOT_OPEN: ['กิจกรรมนี้ไม่เปิดรับคำขอแล้ว', 'This Meetup is no longer accepting requests.'],
  MEETUP_PLACE_UNAVAILABLE: ['สถานที่นี้ไม่พร้อมใช้งาน', 'The place is unavailable.'],
  MEETUP_USER_UNAVAILABLE: ['ผู้ใช้รายนี้ไม่พร้อมใช้งาน', 'This user is unavailable.'],
  MEETUP_BANNED: ['คุณถูกแบนจากกิจกรรมนี้', 'You are banned from this Meetup.'],
  MEETUP_ALREADY_JOINED: ['คุณเป็นสมาชิกแล้ว', 'You are already a member.'],
  MEETUP_FULL: ['กิจกรรมนี้เต็มแล้ว', 'This Meetup is full.'],
  MEETUP_REQUEST_PENDING: ['คุณมีคำขอที่รออนุมัติอยู่แล้ว', 'Your request is already pending.'],
  MEETUP_REQUEST_NOT_FOUND: ['ไม่พบคำขอที่รออนุมัติ', 'Pending request not found.'],
  MEETUP_REQUEST_RATE_LIMITED: [
    'ส่งคำขอครบ 3 ครั้งต่อวันแล้ว',
    'You have reached 3 requests today.',
  ],
  MEETUP_REQUEST_CONFLICT: ['คำขอขัดแย้ง กรุณาลองใหม่', 'Request conflict. Please retry.'],
  MEETUP_FORBIDDEN: ['คุณไม่มีสิทธิ์ทำรายการนี้', 'You cannot perform this action.'],
  MEETUP_PIN_LIMIT: [
    `ปักหมุดได้สูงสุด ${MAX_PINNED_MESSAGES} ข้อความ กรุณาเลิกปักหมุดข้อความอื่นก่อน`,
    `You can pin up to ${MAX_PINNED_MESSAGES} messages. Unpin another one first.`,
  ],
  MEETUP_MESSAGE_NOT_FOUND: ['ไม่พบข้อความนี้', 'Message not found.'],
  MEETUP_CHAT_READ_ONLY: ['แชตนี้อยู่ในโหมดอ่านอย่างเดียว', 'This chat is read-only.'],
  MEETUP_REPLY_NOT_FOUND: ['ไม่พบข้อความที่ตอบกลับ', 'The message you replied to was not found.'],
  MEETUP_INVALID_TARGET: ['รายงานรายการนี้ไม่ได้', 'This item cannot be reported.'],
};

export function meetupActionError(error: string | undefined, locale: Locale) {
  if (!error) return locale === 'th' ? 'ทำรายการไม่สำเร็จ' : 'Action failed';
  const known = messages[error];
  return known ? known[locale === 'th' ? 0 : 1] : error;
}
