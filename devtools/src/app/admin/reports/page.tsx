import { AdminShell } from '@/features/admin/admin-shell';
import { ReportAction } from '@/features/admin/report-action';
import { prisma } from '@/lib/prisma';

export default async function ReportsPage() {
  const reports = await prisma.report.findMany({
    where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
    include: { place: true, reporter: true },
    orderBy: { createdAt: 'asc' },
  });
  return (
    <AdminShell
      title="รายงานจากชุมชน"
      description="รายงานปิดกิจการ 3 ผู้ใช้ใน 30 วันจะเด่นในคิว แต่ระบบไม่ปิดสถานที่อัตโนมัติ"
    >
      <div className="grid gap-4">
        {reports.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-[var(--surface)]/50 p-10 text-center">
            ไม่มีรายงานเปิด
          </p>
        ) : (
          reports.map((report) => (
            <article
              key={report.id}
              className="surface flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center"
            >
              <div>
                <div className="flex gap-2">
                  <h2 className="font-black">{report.place.nameTh}</h2>
                  <span className="rounded-full bg-[var(--terracotta-soft)] px-2 py-1 text-xs font-bold text-[var(--terracotta)]">
                    {report.reason}
                  </span>
                </div>
                <p className="mt-2 text-sm">{report.details}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  โดย {report.reporter.name} · {report.createdAt.toLocaleString('th-TH')}
                </p>
              </div>
              <ReportAction id={report.id} />
            </article>
          ))
        )}
      </div>
    </AdminShell>
  );
}
