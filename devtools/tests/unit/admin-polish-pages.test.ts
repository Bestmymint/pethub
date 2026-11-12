import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: unknown }) =>
    createElement('a', { href }, children as never),
}));
vi.mock('@/features/admin/admin-shell', () => ({ AdminShell: () => null }));
vi.mock('@/features/admin/report-action', () => ({ ReportAction: () => null }));
vi.mock('@/features/admin/user-action', () => ({ UserAction: () => null }));
vi.mock('@/features/admin/reference-editor', () => ({ ReferenceEditor: () => null }));
vi.mock('@/features/admin/import-bulk-review', () => ({ ImportBulkReview: () => null }));
vi.mock('@/features/admin/import-auth', () => ({ requireImportAdmin: async () => undefined }));

const data = vi.hoisted(() => ({
  reports: [] as unknown[],
  users: [] as unknown[],
  audits: [] as unknown[],
  imports: [] as unknown[],
  categories: [] as unknown[],
  provinces: [] as unknown[],
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    report: { findMany: async () => data.reports },
    user: { findMany: async () => data.users },
    auditLog: { findMany: async () => data.audits },
    importedPlace: { findMany: async () => data.imports, count: async () => data.imports.length },
    category: { findMany: async () => data.categories },
    province: { findMany: async () => data.provinces },
  },
}));

import AuditLogsPage from '@/app/admin/audit-logs/page';
import CategoriesPage from '@/app/admin/categories/page';
import ImportsPage from '@/app/admin/imports/page';
import ProvincesPage from '@/app/admin/provinces/page';
import ReportsPage from '@/app/admin/reports/page';
import UsersPage from '@/app/admin/users/page';
import { AdminShell } from '@/features/admin/admin-shell';

async function render(page: () => Promise<ReactElement>) {
  const element = await page();
  const props = element.props as { children: ReactElement };
  return { element, html: renderToStaticMarkup(createElement('div', null, props.children)) };
}

beforeEach(() => {
  for (const key of Object.keys(data) as (keyof typeof data)[]) data[key] = [];
});

describe('community reports tab', () => {
  it('shows a readable reason instead of the enum', async () => {
    data.reports = [
      {
        id: 'r1',
        reason: 'PERMANENTLY_CLOSED',
        details: 'ปิดแล้วจริง ๆ',
        createdAt: new Date('2026-11-01T00:00:00Z'),
        place: { nameTh: 'คาเฟ่ทดสอบ' },
        reporter: { name: 'น้องบี' },
      },
    ];
    const { element, html } = await render(ReportsPage);
    expect(element.type).toBe(AdminShell);
    expect(html).toContain('ปิดกิจการ');
    expect(html).not.toContain('PERMANENTLY_CLOSED');
  });
});

describe('users tab', () => {
  it('shows role and status as badges, not raw enum text', async () => {
    data.users = [
      { id: 'u1', name: 'แอดมิน', email: 'a@pawmap.local', role: 'ADMIN', suspendedAt: null },
      { id: 'u2', name: 'สมาชิก', email: 'b@pawmap.local', role: 'USER', suspendedAt: new Date() },
    ];
    const { html } = await render(UsersPage);
    expect(html).toContain('ผู้ดูแลระบบ');
    expect(html).toContain('ใช้งานอยู่');
    expect(html).toContain('ถูกระงับ');
    for (const raw of ['ADMIN', 'ACTIVE', 'SUSPENDED']) expect(html).not.toContain(`>${raw}<`);
    expect(html).toContain('rounded-md px-2.5 py-1 text-xs font-semibold');
  });
});

describe('audit log tab', () => {
  it('puts the empty state in a dashed card outside the table', async () => {
    const { html } = await render(() => AuditLogsPage({ searchParams: Promise.resolve({}) }));
    const tableEnd = html.indexOf('</table>');
    expect(tableEnd).toBeGreaterThan(-1);
    const empty = html.indexOf('ไม่พบ AuditLog ตามตัวกรอง');
    expect(empty).toBeGreaterThan(tableEnd);
    expect(html.slice(tableEnd)).toContain('border-dashed');
  });
});

describe('imports tab', () => {
  it('uses the shared field components and a dashed empty-state card', async () => {
    data.provinces = [{ code: '10', nameTh: 'กรุงเทพมหานคร' }];
    const { html } = await render(() => ImportsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('min-h-11 w-full rounded-md border border-[var(--field-border)]');
    expect(html).toContain('type="submit"');
    expect(html).toContain('ไม่มีรายการในตัวกรองนี้');
    expect(html).toContain('border-dashed');
    expect(html).not.toContain('rounded-lg border p-2');
  });
});

describe('reference tables', () => {
  it('gives every header cell the same padding on categories and provinces', async () => {
    for (const page of [CategoriesPage, ProvincesPage]) {
      const { html } = await render(page);
      const headers = html.match(/<th(?=[\s>])[^>]*>/g) ?? [];
      expect(headers.length).toBeGreaterThan(2);
      expect(headers.every((tag) => tag.includes('class="p-3"'))).toBe(true);
    }
  });
});
