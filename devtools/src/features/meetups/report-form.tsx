'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n';
import { MESSAGE_REPORT_REASONS } from '@/lib/report-labels';

/** Asks for a reason before a message is reported. Escape cancels; the reason list gets focus on open. */
export function ReportForm({
  locale,
  pending,
  onSubmit,
  onCancel,
}: {
  locale: Locale;
  pending: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const th = locale === 'th';
  const [reason, setReason] = useState<string>('SPAM');
  const select = useRef<HTMLSelectElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => select.current?.focus(), []);

  // A listener on the form element (not a JSX handler): Escape cancels from any field in it.
  useEffect(() => {
    const element = form.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };
    element?.addEventListener('keydown', onKeyDown);
    return () => element?.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <form
      ref={form}
      className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
      aria-label={th ? 'รายงานข้อความ' : 'Report message'}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(reason);
      }}
    >
      <label htmlFor="meetup-report-reason" className="text-sm font-semibold">
        {th ? 'เหตุผลที่รายงาน' : 'Reason for the report'}
      </label>
      <select
        ref={select}
        id="meetup-report-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="min-h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
      >
        {MESSAGE_REPORT_REASONS.map(([value, thLabel, enLabel]) => (
          <option key={value} value={value}>
            {th ? thLabel : enLabel}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {th ? 'ส่งรายงาน' : 'Report'}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        {th ? 'ยกเลิก' : 'Cancel'}
      </Button>
    </form>
  );
}
