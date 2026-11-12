import { ImageOff, MessageSquareOff, UserRoundX } from 'lucide-react';
import Image from 'next/image';

import type { ReportTargetView } from './meetup-report-targets';

const missingBox =
  'mt-3 flex items-center gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-muted)]';

function Thumbnail({ src, alt }: { src: string; alt: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="mt-3 inline-block">
      <Image
        unoptimized
        src={src}
        alt={alt}
        width={96}
        height={96}
        className="size-24 rounded-lg border border-[var(--border)] object-cover"
      />
    </a>
  );
}

/** What was reported, shown inside a Meetup report card. Deleted or vanished items say so in words. */
export function ReportTargetPreview({
  view,
  meetupId,
}: {
  view: ReportTargetView;
  meetupId: string;
}) {
  if (view.kind === 'MEETUP') return null;

  if (view.kind === 'USER') {
    if (view.state === 'missing')
      return (
        <p className={missingBox}>
          <UserRoundX className="size-4 shrink-0" aria-hidden="true" />
          ไม่พบผู้ใช้ที่ถูกรายงานแล้ว
        </p>
      );
    return (
      <p className="mt-3 text-sm">
        ผู้ใช้ที่ถูกรายงาน: <strong>{view.name}</strong>
        {view.state === 'deleted' && (
          <span className="text-[var(--text-muted)]"> (บัญชีถูกลบแล้ว)</span>
        )}
      </p>
    );
  }

  if (view.kind === 'MESSAGE') {
    if (view.state !== 'ok')
      return (
        <p className={missingBox}>
          <MessageSquareOff className="size-4 shrink-0" aria-hidden="true" />
          {view.state === 'deleted'
            ? `ข้อความถูกลบแล้ว${view.senderName ? ` (ผู้ส่ง: ${view.senderName})` : ''}`
            : 'ไม่พบข้อความที่ถูกรายงานแล้ว'}
        </p>
      );
    return (
      <div className="mt-3 rounded-xl border-l-4 border-[var(--terracotta)] bg-[var(--surface-soft)] px-3 py-2">
        <p className="text-xs font-semibold text-[var(--text-muted)]">
          ข้อความจาก {view.senderName ?? 'สมาชิกที่ถูกลบ'}
        </p>
        {view.text && <p className="mt-1 text-sm [overflow-wrap:anywhere]">{view.text}</p>}
        {view.imageSrc && <Thumbnail src={view.imageSrc} alt="รูปในข้อความที่ถูกรายงาน" />}
        <a
          href={`/meetups/${meetupId}/chat`}
          className="mt-2 inline-block text-xs font-semibold text-[var(--forest)] hover:underline"
        >
          เปิดแชตของ Meetup
        </a>
      </div>
    );
  }

  if (view.state === 'ok' && view.src)
    return (
      <div>
        <Thumbnail
          src={view.src}
          alt={view.source === 'cover' ? 'รูปปกที่ถูกรายงาน' : 'รูปที่ถูกรายงาน'}
        />
      </div>
    );
  return (
    <p className={missingBox}>
      <ImageOff className="size-4 shrink-0" aria-hidden="true" />
      {view.state === 'deleted' ? 'รูปถูกลบแล้ว' : 'ไม่พบรูปที่ถูกรายงานแล้ว'}
    </p>
  );
}
