import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

import { seedBrowserSession } from './helpers/session';
import { testCredentials } from '../test-credentials';

const credentials = testCredentials();

/** Submissions this spec may have created, matched by the unique Thai name. */
function byName(name: string) {
  return { proposedData: { path: ['nameTh'], equals: name } };
}

async function fillFirstThreeSteps(page: Page, name: string) {
  await page.goto('/submit');
  await page.getByLabel('ชื่อภาษาไทย *').fill(name);
  await page.getByLabel('หมวดหมู่ *').selectOption('CAFE');
  await page
    .getByLabel('คำอธิบาย *')
    .fill('สถานที่สำหรับทดสอบว่าปุ่มถัดไปไม่ส่งฟอร์มก่อนถึงขั้นตอนสุดท้าย');
  await page.getByRole('button', { name: 'ถัดไป' }).click();

  await page.getByLabel('ที่อยู่ *').fill('แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร');
  await page.getByLabel('จังหวัด *').selectOption('10');
  await page.getByLabel('Latitude').fill('13.7563');
  await page.getByLabel('Longitude').fill('100.5018');
  // Enter in a single-line field must not submit the form or skip a step.
  await page.getByLabel('Longitude').press('Enter');
  await expect(page.getByLabel('ที่อยู่ *')).toBeVisible();
  await page.getByRole('button', { name: 'ถัดไป' }).click();

  await page.getByText('สุนัข', { exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'สุนัข' })).toBeChecked();
}

test('Next on step 3 opens step 4 and never submits the form', async ({ page }) => {
  const name = `สถานที่ทดสอบขั้นตอน E2E ${Date.now()}`;
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: credentials.user.email },
    });
    await seedBrowserSession(prisma, page.context(), user.id);

    await fillFirstThreeSteps(page, name);
    // The Next button sits where Submit appears; one click must only change the step.
    await page.getByRole('button', { name: 'ถัดไป' }).click();

    await expect(page.getByText('ก่อนส่งข้อมูล', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ส่งให้ตรวจสอบ' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'บันทึกฉบับร่าง' })).toBeVisible();
    await expect(page).toHaveURL(/\/submit$/u);
    // Give a stray submit time to reach the server before checking nothing was saved.
    await page.waitForTimeout(1_000);
    await expect(page).toHaveURL(/\/submit$/u);
    expect(await prisma.submission.count({ where: byName(name) })).toBe(0);
  } finally {
    await prisma.submission.deleteMany({ where: byName(name) });
    await prisma.$disconnect();
  }
});
