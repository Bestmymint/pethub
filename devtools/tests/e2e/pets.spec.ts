import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { seedBrowserSession } from './helpers/session';

const prisma = new PrismaClient();
const userId = `pet-browser-${randomUUID()}`;
test.beforeAll(async () => {
  await prisma.user.create({
    data: { id: userId, name: 'Pet workspace test', email: `${userId}@example.invalid` },
  });
});
test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

test('pet profile, health, weight, daily care, archive and restore persist through the browser', async ({
  page,
}) => {
  await seedBrowserSession(prisma, page.context(), userId);
  await page.goto('/pets');
  await page.getByRole('button', { name: 'เพิ่มสัตว์เลี้ยง', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('ชื่อน้อง').fill('Milo E2E');
  await form.getByLabel('สายพันธุ์').fill('Golden Retriever');
  await form.getByLabel('วันเกิด').fill('2023-03-01');
  await form.getByLabel('น้ำหนัก (กก.)').fill('10.5');
  await form.getByRole('button', { name: 'บันทึกโปรไฟล์' }).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Milo E2E', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'แก้ไข Milo E2E', exact: true }).click();
  await form.getByLabel('เรื่องเล็ก ๆ ของน้อง').fill('ชอบเดินเล่นในสวน');
  await form.getByRole('button', { name: 'บันทึกโปรไฟล์' }).click();
  await expect(page.getByText('ชอบเดินเล่นในสวน')).toBeVisible();
  await page.getByRole('button', { name: 'สมุดสุขภาพ', exact: true }).click();
  await page.getByRole('button', { name: 'เพิ่มบันทึกสุขภาพ', exact: true }).first().click();
  await form.getByLabel('ประเภทบันทึก').selectOption('weight');
  await form.getByLabel('หัวข้อ').fill('น้ำหนักประจำเดือน');
  await form.getByLabel('น้ำหนัก (กก.)').fill('11.2');
  await form.getByRole('button', { name: 'บันทึกสุขภาพ', exact: true }).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByRole('img', { name: 'กราฟน้ำหนักของ Milo E2E' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /น้ำหนักประจำเดือน/ })).toBeVisible();
  await page.getByRole('button', { name: 'การดูแลประจำวัน', exact: true }).click();
  const task = page.getByRole('checkbox', { name: 'Milo E2E: มื้อเช้าและน้ำสะอาด' });
  await task.check();
  await expect(task).toBeChecked();
  await page.reload();
  await page.getByRole('button', { name: 'การดูแลประจำวัน', exact: true }).click();
  await expect(task).toBeChecked();
  await page.getByRole('button', { name: /^เพื่อนตัวโปรด/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'เก็บ Milo E2E เข้าคลัง' }).click();
  await expect(page.getByRole('heading', { name: 'Milo E2E', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^คลังโปรไฟล์/ }).click();
  await page.getByRole('button', { name: 'นำ Milo E2E กลับมา' }).click();
  await page.getByRole('button', { name: /^ทั้งหมด/ }).click();
  await expect(page.getByRole('heading', { name: 'Milo E2E', exact: true })).toBeVisible();
});

test('new home and pet workspace fit desktop and mobile and expose no booking navigation', async ({
  page,
}) => {
  await seedBrowserSession(prisma, page.context(), userId);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/en', '/pets', '/en/pets']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false);
      await expect(page.locator('a[href*="appointments"]')).toHaveCount(0);
    }
  }
});

test('pet workspace redirects guests to sign in and preserves the destination', async ({
  page,
}) => {
  await page.goto('/pets');
  await expect(page).toHaveURL(/\/login\?next=%2Fpets/);
});
