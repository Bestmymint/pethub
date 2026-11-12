'use client';

import { DatabaseZap, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { createDemoDataAction, deleteDemoDataAction } from './demo-actions';

/** Admin overview card with the two demo-data buttons. The page only renders it when the tools are enabled. */
export function DemoToolsCard() {
  const [pending, setPending] = useState<'create' | 'delete' | null>(null);

  async function run(kind: 'create' | 'delete') {
    if (
      kind === 'delete' &&
      !window.confirm('ลบข้อมูลตัวอย่างทั้งหมดที่สร้างด้วยปุ่มนี้? ข้อมูลจริงจะไม่ถูกลบ')
    )
      return;
    setPending(kind);
    try {
      const result = await (kind === 'create' ? createDemoDataAction() : deleteDemoDataAction());
      if (result.ok) toast.success(result.data.message);
      else toast.error(result.formError ?? 'ทำรายการไม่สำเร็จ');
    } catch {
      toast.error('ทำรายการไม่สำเร็จ');
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="mt-8 surface p-6" aria-labelledby="demo-tools-title">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Demo</p>
          <h2 id="demo-tools-title" className="mt-1 text-xl font-black">
            ข้อมูลตัวอย่าง (Demo)
          </h2>
        </div>
        <DatabaseZap className="size-6 shrink-0 text-[var(--forest)]" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        สร้าง Meetup แชต รีวิว รายการที่ส่ง การแจ้งเตือน และรายงานตัวอย่างสำหรับสาธิตระบบ
        ปุ่มสร้างกดซ้ำได้ไม่ซ้ำซ้อน ปุ่มลบจะลบเฉพาะข้อมูลที่สร้างจากปุ่มนี้ ไม่แตะสถานที่ที่นำเข้า
        ผู้ใช้จริง หรือบัญชีสาธิต
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={() => void run('create')} disabled={pending !== null}>
          <DatabaseZap className="size-4" aria-hidden="true" />
          {pending === 'create' ? 'กำลังสร้าง…' : 'สร้างข้อมูลตัวอย่าง'}
        </Button>
        <Button variant="secondary" onClick={() => void run('delete')} disabled={pending !== null}>
          <Trash2 className="size-4" aria-hidden="true" />
          {pending === 'delete' ? 'กำลังลบ…' : 'ลบข้อมูลตัวอย่าง'}
        </Button>
      </div>
    </section>
  );
}
