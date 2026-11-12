import { AdminShell } from '@/features/admin/admin-shell';
import { loadReportTargets } from '@/features/admin/meetup-report-targets';
import { ReportTargetPreview } from '@/features/admin/report-target-preview';
import { AdminMeetupReportAction } from '@/features/meetups/admin-report-action';
import { prisma } from '@/lib/prisma';
import { meetupReportReasonLabel, meetupReportTargetLabel } from '@/lib/report-labels';

export default async function AdminMeetupReportsPage() {
  const reports = await prisma.meetupReport.findMany({
    where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
    include: {
      meetup: { select: { id: true, title: true, coverObjectKey: true } },
      reporter: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const targets = await loadReportTargets(
    prisma,
    reports.map((report) => ({
      id: report.id,
      target: report.target,
      targetId: report.targetId,
      meetupId: report.meetupId,
      meetupCoverKey: report.meetup.coverObjectKey,
    })),
  );
  return (
    <AdminShell
      title="รายงาน Meetup"
      description="รายงาน Meetup ข้อความ รูป และผู้ใช้ที่สมาชิกส่งเข้ามา รอผู้ดูแลตรวจสอบ"
    >
      <div className="grid gap-4">
        {reports.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-[var(--surface)]/50 p-10 text-center">
            ไม่มีรายงานที่รอตรวจ
          </p>
        ) : (
          reports.map((report) => (
            <article
              key={report.id}
              className="surface flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <h2 className="font-black [overflow-wrap:anywhere]">
                    <a
                      href={`/meetups/${report.meetup.id}`}
                      className="text-[var(--forest)] hover:underline"
                    >
                      {report.meetup.title}
                    </a>
                  </h2>
                  <span className="rounded-full bg-[var(--terracotta-soft)] px-2 py-1 text-xs font-bold text-[var(--terracotta)]">
                    {meetupReportReasonLabel(report.reason)}
                  </span>
                  <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1 text-xs font-bold text-[var(--text-muted)]">
                    {meetupReportTargetLabel(report.target)}
                  </span>
                </div>
                <ReportTargetPreview view={targets.get(report.id)!} meetupId={report.meetup.id} />
                {report.details && (
                  <p className="mt-2 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                    {report.details}
                  </p>
                )}
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  โดย {report.reporter.name} · {report.createdAt.toLocaleString('th-TH')}
                </p>
              </div>
              <AdminMeetupReportAction id={report.id} />
            </article>
          ))
        )}
      </div>
    </AdminShell>
  );
}
