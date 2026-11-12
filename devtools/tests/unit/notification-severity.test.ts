import { NotificationType } from '@prisma/client';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NotificationSeverityIcon } from '@/components/notification-severity-icon';
import {
  notificationSeverities,
  severityForNotification,
  severityForType,
  severityLabel,
} from '@/lib/notification-severity';

describe('severityForType', () => {
  it('classifies every value of the Prisma NotificationType enum', () => {
    const values = Object.values(NotificationType);
    expect(values.length).toBeGreaterThan(0);
    for (const type of values) {
      const severity = severityForType(type);
      // An unclassified enum member would fall through the exhaustive switch.
      expect(notificationSeverities, `unclassified notification type: ${type}`).toContain(severity);
    }
  });

  it('maps the submission types to their severity', () => {
    expect(severityForType('SUBMISSION_APPROVED')).toBe('success');
    expect(severityForType('SUBMISSION_REJECTED')).toBe('negative');
    expect(severityForType('SUBMISSION_NEEDS_REVISION')).toBe('attention');
    expect(severityForType('FAVORITE_UPDATED')).toBe('info');
    expect(severityForType('SYSTEM')).toBe('info');
  });
});

describe('severityForNotification', () => {
  const meetup = (titleTh: string, titleEn: string, metadata?: unknown) =>
    severityForNotification({ type: 'MEETUP', titleTh, titleEn, metadata });

  it('keeps the submission types unchanged', () => {
    expect(
      severityForNotification({
        type: 'SUBMISSION_REJECTED',
        titleTh: 'ข้อมูลได้รับการอนุมัติแล้ว',
        titleEn: 'Submission approved',
      }),
    ).toBe('negative');
  });

  it('reads every Meetup notification the app creates', () => {
    // Titles copied from src/features/meetups/actions.ts, chat-notifications.ts and the worker.
    expect(meetup('มีคำขอเข้าร่วม Meetup', 'New Meetup join request')).toBe('attention');
    expect(meetup('คำขอเข้าร่วมได้รับอนุมัติ', 'Meetup request approved')).toBe('success');
    expect(meetup('คำขอเข้าร่วมไม่ผ่านการอนุมัติ', 'Meetup request declined')).toBe('negative');
    expect(meetup('สมาชิกออกจาก Meetup', 'A member left your Meetup')).toBe('info');
    expect(meetup('คุณเป็นหัวกลุ่ม Meetup', 'You are the Meetup host')).toBe('success');
    expect(meetup('Meetup ถูกยกเลิก', 'Meetup cancelled')).toBe('negative');
    expect(meetup('รายละเอียด Meetup เปลี่ยนแปลง', 'Meetup details changed')).toBe('attention');
    expect(meetup('คุณถูกแบนจาก Meetup', 'You were banned from a Meetup')).toBe('negative');
    expect(meetup('คุณถูกนำออกจาก Meetup', 'You were removed from a Meetup')).toBe('negative');
    expect(meetup('Meetup ใกล้เริ่มแล้ว', 'Meetup starting soon')).toBe('attention');
    expect(
      meetup('ข้อความใหม่ในแชต Meetup', 'New Meetup chat message', { kind: 'MEETUP_CHAT' }),
    ).toBe('info');
    expect(meetup('ประกาศจากหัวกลุ่ม', 'Host announcement', { kind: 'MEETUP_CHAT' })).toBe('info');
  });

  it('leaves unknown titles neutral instead of guessing', () => {
    expect(meetup('ประกาศทั่วไป', 'General update')).toBe('info');
    expect(meetup('', '')).toBe('info');
  });
});

describe('severity icon and label', () => {
  const render = (severity: 'success' | 'attention' | 'negative' | 'info', locale: 'th' | 'en') =>
    renderToStaticMarkup(createElement(NotificationSeverityIcon, { severity, locale }));

  it('renders a different icon shape per severity', () => {
    expect(render('success', 'th')).toContain('lucide-circle-check');
    expect(render('attention', 'th')).toContain('lucide-circle-alert');
    expect(render('negative', 'th')).toContain('lucide-circle-x');
    expect(render('info', 'th')).toContain('lucide-info');
  });

  it('uses the shared design tokens, not raw colours', () => {
    expect(render('success', 'th')).toContain('var(--sage)');
    expect(render('attention', 'th')).toContain('var(--warning-soft)');
    expect(render('negative', 'th')).toContain('var(--terracotta-soft)');
    expect(render('info', 'th')).toContain('var(--surface-soft)');
  });

  it('adds a screen-reader label per severity and locale', () => {
    expect(severityLabel('success', 'th')).toContain('สำเร็จ');
    expect(severityLabel('attention', 'en')).toBe('Notification: action needed');
    expect(render('negative', 'th')).toContain('ไม่ผ่านหรือถูกยกเลิก');
    expect(render('attention', 'en')).toContain('Notification: action needed');
  });

  it('keeps the label in the plain variant used by the bell popup', () => {
    const html = renderToStaticMarkup(
      createElement(NotificationSeverityIcon, { severity: 'info', locale: 'th', plain: true }),
    );
    expect(html).toContain('lucide-info');
    expect(html).toContain('การแจ้งเตือน: ข้อมูลข่าวสาร');
    expect(html).not.toContain('rounded-full');
  });
});
