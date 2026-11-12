import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AdminShell is the only place that calls requireAdmin() and draws the admin header and tabs,
// so these pages must always render inside it.
vi.mock('@/features/admin/admin-shell', () => ({ AdminShell: () => null }));
vi.mock('@/features/meetups/admin-report-action', () => ({ AdminMeetupReportAction: () => null }));

const data = vi.hoisted(() => ({ meetups: [] as unknown[], reports: [] as unknown[] }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    meetup: { findMany: async () => data.meetups },
    meetupReport: { findMany: async () => data.reports },
  },
}));

import AdminMeetupReportsPage from '@/app/admin/meetup-reports/page';
import AdminMeetupsPage from '@/app/admin/meetups/page';
import { AdminShell } from '@/features/admin/admin-shell';

async function render(page: () => Promise<ReactElement>) {
  const element = await page();
  const props = element.props as { title: string; children: ReactElement };
  return { element, props, html: renderToStaticMarkup(createElement('div', null, props.children)) };
}

const meetup = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  title: 'เดินเล่นสวนลุม',
  status: 'OPEN',
  maxMembers: 30,
  startsAt: new Date('2026-12-01T10:00:00Z'),
  deletedAt: null,
  host: { name: 'พี่ฟ้า' },
  place: { nameTh: 'สวนลุมพินี' },
  _count: { members: 1 },
  ...overrides,
});

beforeEach(() => {
  data.meetups = [];
  data.reports = [];
});

describe('admin Meetup tab', () => {
  it('renders inside AdminShell so the admin guard, header and tabs apply', async () => {
    const { element, props } = await render(AdminMeetupsPage);
    expect(element.type).toBe(AdminShell);
    expect(props.title).toBe('จัดการ Meetup');
  });

  it('shows a styled empty state', async () => {
    const { html } = await render(AdminMeetupsPage);
    expect(html).toContain('ยังไม่มี Meetup');
    expect(html).toContain('border-dashed');
  });

  it('shows title, place, host, participants and a status badge instead of the raw status', async () => {
    data.meetups = [meetup(), meetup({ id: 'm2', status: 'CANCELLED', deletedAt: new Date() })];
    const { html } = await render(AdminMeetupsPage);
    expect(html).toContain('เดินเล่นสวนลุม');
    expect(html).toContain('สวนลุมพินี');
    expect(html).toContain('หัวกลุ่ม: พี่ฟ้า');
    expect(html).toContain('1/30 คน');
    expect(html).toContain('เปิดรับ');
    expect(html).toContain('ยกเลิก');
    expect(html).toContain('ซ่อนแล้ว');
    expect(html).not.toContain('OPEN');
    expect(html).not.toContain('CANCELLED');
    expect(html).toContain('href="/meetups/m1"');
  });
});

describe('admin Meetup reports tab', () => {
  it('renders inside AdminShell so the admin guard, header and tabs apply', async () => {
    const { element, props } = await render(AdminMeetupReportsPage);
    expect(element.type).toBe(AdminShell);
    expect(props.title).toBe('รายงาน Meetup');
  });

  it('shows a styled empty state', async () => {
    const { html } = await render(AdminMeetupReportsPage);
    expect(html).toContain('ไม่มีรายงานที่รอตรวจ');
    expect(html).toContain('border-dashed');
  });

  it('shows each report like the community reports tab', async () => {
    data.reports = [
      {
        id: 'r1',
        reason: 'SPAM',
        target: 'MESSAGE',
        details: 'ส่งลิงก์ซ้ำ ๆ',
        createdAt: new Date('2026-11-01T00:00:00Z'),
        meetup: { id: 'm1', title: 'เดินเล่นสวนลุม' },
        reporter: { name: 'น้องบี' },
      },
    ];
    const { html } = await render(AdminMeetupReportsPage);
    expect(html).toContain('เดินเล่นสวนลุม');
    expect(html).toContain('SPAM');
    expect(html).toContain('ข้อความ');
    expect(html).toContain('ส่งลิงก์ซ้ำ ๆ');
    expect(html).toContain('โดย น้องบี');
    expect(html).toContain('href="/meetups/m1"');
  });
});
