'use server';

import { revalidatePath } from 'next/cache';
import sharp from 'sharp';

import type { ActionResult } from '@/lib/action-result';
import { requireAdmin } from '@/lib/auth-guards';
import { deleteObject, putObject } from '@/lib/object-storage';
import { prisma } from '@/lib/prisma';
import { demoToolsEnabled, formatDemoCounts, type DemoCounts } from '@/features/demo/demo-config';
import { createDemoData, deleteDemoData, type DemoDeps } from '@/features/demo/demo-service';

export interface DemoRunResult {
  message: string;
  counts: DemoCounts;
}

async function renderImage(color: string) {
  const png = await sharp({ create: { width: 640, height: 420, channels: 3, background: color } })
    .png()
    .toBuffer();
  return new Uint8Array(png);
}

async function run(
  work: (deps: DemoDeps) => Promise<DemoCounts>,
  verb: 'created' | 'deleted',
): Promise<ActionResult<DemoRunResult>> {
  // The flag comes first: with the tools off, nothing else (not even the session) is consulted.
  if (!demoToolsEnabled()) return { ok: false, formError: 'เครื่องมือข้อมูลตัวอย่างปิดอยู่' };
  const session = await requireAdmin();
  try {
    const counts = await work({
      db: prisma,
      now: new Date(),
      actorId: session.user.id,
      storage: { put: putObject, remove: deleteObject },
      renderImage,
      demoUserEmail: process.env.SEED_USER_EMAIL,
    });
    for (const path of ['/admin', '/meetups', '/my-meetups', '/notifications'])
      revalidatePath(path);
    return { ok: true, data: { message: formatDemoCounts(counts, verb), counts } };
  } catch (error) {
    if (error instanceof Error && error.message === 'DEMO_NO_PLACES')
      return {
        ok: false,
        formError: 'ยังไม่มีสถานที่ในระบบ กรุณานำเข้าสถานที่ก่อนสร้างข้อมูลตัวอย่าง',
      };
    return { ok: false, formError: 'ทำรายการไม่สำเร็จ กรุณาลองใหม่' };
  }
}

/** Admin only, and only while DEMO_TOOLS_ENABLED=true. Idempotent. */
export async function createDemoDataAction() {
  return run(createDemoData, 'created');
}

/** Admin only, and only while DEMO_TOOLS_ENABLED=true. Removes only rows marked as demo data. */
export async function deleteDemoDataAction() {
  return run(deleteDemoData, 'deleted');
}
