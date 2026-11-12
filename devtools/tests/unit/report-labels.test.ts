import { describe, expect, it } from 'vitest';

import {
  MEETUP_REPORT_REASONS,
  MESSAGE_REPORT_REASONS,
  PLACE_REPORT_REASONS,
  meetupReportReasonLabel,
  meetupReportTargetLabel,
  placeReportReasonLabel,
} from '@/lib/report-labels';

describe('report labels', () => {
  it('names every Meetup report reason in Thai and English', () => {
    expect(meetupReportReasonLabel('SPAM')).toBe('สแปม');
    expect(meetupReportReasonLabel('SPAM', 'en')).toBe('Spam');
    expect(meetupReportReasonLabel('FAKE_MEETUP')).toBe('Meetup ปลอม');
    expect(meetupReportReasonLabel('DANGEROUS_BEHAVIOR', 'en')).toBe('Dangerous behavior');
  });

  it('names every place report reason, including the one the form does not offer', () => {
    expect(placeReportReasonLabel('PERMANENTLY_CLOSED')).toBe('ปิดกิจการ');
    expect(placeReportReasonLabel('INCORRECT_INFORMATION', 'en')).toBe('Incorrect information');
    expect(placeReportReasonLabel('INAPPROPRIATE_CONTENT')).toBe('เนื้อหาไม่เหมาะสม');
    expect(PLACE_REPORT_REASONS.map(([value]) => value)).not.toContain('INAPPROPRIATE_CONTENT');
  });

  it('shows an unknown value as it is instead of hiding it', () => {
    expect(meetupReportReasonLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
    expect(placeReportReasonLabel('SOMETHING_NEW', 'en')).toBe('SOMETHING_NEW');
    expect(meetupReportTargetLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  it('names the report targets', () => {
    expect(['MEETUP', 'USER', 'MESSAGE', 'IMAGE'].map((t) => meetupReportTargetLabel(t))).toEqual([
      'Meetup',
      'ผู้ใช้',
      'ข้อความ',
      'รูปภาพ',
    ]);
  });

  it('keeps the chat report form to the six reasons it always offered', () => {
    expect(MESSAGE_REPORT_REASONS.map(([value]) => value)).toEqual([
      'SPAM',
      'HARASSMENT',
      'INAPPROPRIATE_CONTENT',
      'SCAM',
      'DANGEROUS_BEHAVIOR',
      'OTHER',
    ]);
    expect(MEETUP_REPORT_REASONS).toHaveLength(7);
  });
});
