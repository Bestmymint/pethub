import { CalendarClock, MapPin, UserRound, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { AdminShell } from '@/features/admin/admin-shell';
import { prisma } from '@/lib/prisma';

const statusLabels = {
  OPEN: ['เปิดรับ', 'emerald'],
  CLOSED: ['ปิดรับ', 'neutral'],
  ONGOING: ['กำลังดำเนินการ', 'blue'],
  COMPLETED: ['เสร็จสิ้น', 'blue'],
  CANCELLED: ['ยกเลิก', 'red'],
} as const;

export default async function AdminMeetupsPage() {
  const meetups = await prisma.meetup.findMany({
    include: {
      host: { select: { name: true } },
      place: { select: { nameTh: true } },
      _count: { select: { members: { where: { state: 'ACTIVE' } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return (
    <AdminShell
      title="จัดการ Meetup"
      description="กิจกรรมนัดพบล่าสุด 100 รายการ รวมรายการที่ถูกซ่อน เลือกรายการเพื่อเปิดหน้ารายละเอียด"
    >
      <div className="grid gap-4">
        {meetups.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-[var(--surface)]/50 p-10 text-center">
            ยังไม่มี Meetup
          </p>
        ) : (
          meetups.map((meetup) => {
            const [statusLabel, statusTone] = statusLabels[meetup.status];
            return (
              <a
                key={meetup.id}
                href={`/meetups/${meetup.id}`}
                className="surface flex flex-col justify-between gap-3 p-5 transition hover:border-[var(--forest)] sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <h2 className="font-black [overflow-wrap:anywhere]">{meetup.title}</h2>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                      {meetup.place.nameTh}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="size-4 shrink-0" aria-hidden="true" />
                      หัวกลุ่ม: {meetup.host.name}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <UsersRound className="size-4 shrink-0" aria-hidden="true" />
                      <span className="sr-only">ผู้เข้าร่วม</span>
                      {meetup._count.members}/{meetup.maxMembers} คน
                    </span>
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                    {meetup.startsAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Badge tone={statusTone}>{statusLabel}</Badge>
                  {meetup.deletedAt && <Badge tone="red">ซ่อนแล้ว</Badge>}
                </div>
              </a>
            );
          })
        )}
      </div>
    </AdminShell>
  );
}
