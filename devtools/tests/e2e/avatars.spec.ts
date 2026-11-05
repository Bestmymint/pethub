import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedBrowserSession } from './helpers/session';
import { createPublicPlaceFixture } from '../helpers/place-fixture';

const prisma = new PrismaClient();
const prefix = `avatar-browser-${randomUUID()}`;
const users = { host: `${prefix}-host`, member: `${prefix}-member` };
let meetupId = '',
  placeId = '';

test.beforeAll(async () => {
  await prisma.user.createMany({
    data: Object.entries(users).map(([role, id]) => ({
      id,
      name: role === 'member' ? 'Bestmymint Avatar Fixture' : 'Avatar Host',
      email: `${id}@example.invalid`,
      emailVerified: true,
    })),
  });
  const place = await createPublicPlaceFixture(prisma, prefix);
  placeId = place.id;
  meetupId = (
    await prisma.meetup.create({
      data: {
        title: 'Avatar browser group',
        description: 'Temporary chat avatar browser fixture',
        hostId: users.host,
        placeId,
        maxMembers: 5,
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        members: { create: [users.host, users.member].map((userId) => ({ userId })) },
        messages: {
          create: [
            { authorId: users.member, kind: 'TEXT', text: 'Hello from Bestmymint' },
            { authorId: users.host, kind: 'TEXT', text: 'Hi, welcome to our group!' },
          ],
        },
      },
    })
  ).id;
  await prisma.pet.create({
    data: { ownerId: users.member, name: 'Milo Avatar Fixture', species: 'dog' },
  });
});

test.afterAll(async () => {
  if (meetupId) await prisma.meetup.deleteMany({ where: { id: meetupId } });
  if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
  await prisma.rateLimitBucket.deleteMany({ where: { bucketKey: { in: Object.values(users) } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});

test('profile picture uploads persist and update clickable chat avatars live', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const context = await browser.newContext();
  try {
    await seedBrowserSession(prisma, context, users.host);
    const chat = await context.newPage();
    await chat.goto(`/en/meetups/${meetupId}/chat`);
    const avatar = chat.getByRole('link', { name: 'Open Bestmymint Avatar Fixture’s profile' });
    await expect(avatar).toBeVisible();
    await expect(avatar.locator('img')).toHaveCount(0);
    await seedBrowserSession(prisma, page.context(), users.member);
    await page.goto('/en/profile');
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/profile/avatar') && response.request().method() === 'POST',
      ),
      page.getByLabel('Choose profile picture').setInputFiles('public/images/pawspace/golden.jpg'),
    ]);
    await expect(
      page.getByRole('status').filter({ hasText: 'Profile picture saved.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    await expect(avatar.locator('img')).toBeVisible({ timeout: 20_000 });
    const first = await avatar.locator('img').getAttribute('src');
    expect(first).toContain(`/api/avatars/${users.member}?v=`);
    await expect
      .poll(() => avatar.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBe(256);
    await page.reload();
    await expect(
      page.getByRole('img', { name: 'Bestmymint Avatar Fixture', exact: true }).first(),
    ).toBeVisible();
    await avatar.click();
    await expect(
      chat.getByRole('heading', { name: 'Milo Avatar Fixture', exact: true }),
    ).toBeVisible();
    await expect(
      chat.getByRole('img', { name: 'Bestmymint Avatar Fixture', exact: true }),
    ).toBeVisible();
    await chat.getByRole('link', { name: 'Back to group chat' }).click();
    for (const [width, theme] of [
      [1440, 'light'],
      [390, 'dark'],
    ] as const) {
      await chat.setViewportSize({ width, height: 900 });
      await chat.evaluate(
        (theme) => document.documentElement.setAttribute('data-theme', theme),
        theme,
      );
      await expect(avatar.locator('img')).toBeVisible();
      const incoming = chat.locator('[data-message-side="left"]').first();
      const outgoing = chat.locator('[data-message-side="right"]').first();
      const pictureBox = await avatar.boundingBox();
      const textBox = await incoming
        .getByText('Hello from Bestmymint', { exact: true })
        .boundingBox();
      expect(pictureBox!.x + pictureBox!.width).toBeLessThan(textBox!.x);
      await expect(outgoing.locator('img')).toHaveCount(0);
      expect(await chat.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      const axe = await new AxeBuilder({ page: chat }).analyze();
      expect(
        axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')),
      ).toEqual([]);
      await testInfo.attach(`avatar-chat-${width}-${theme}`, {
        body: await chat.screenshot({
          fullPage: true,
          path: testInfo.outputPath(`avatar-chat-${width}-${theme}.png`),
        }),
        contentType: 'image/png',
      });
    }
    await page.getByLabel('Choose profile picture').setInputFiles('public/images/pawspace/cat.jpg');
    await expect(
      page.getByRole('status').filter({ hasText: 'Profile picture saved.' }),
    ).toBeVisible();
    await expect(avatar.locator('img')).not.toHaveAttribute('src', first!);
    const response = await context.request.get(`/api/meetups/${meetupId}/messages`);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain('data:image');
    expect(
      body.items.find((m: { authorId: string }) => m.authorId === users.member).author.image,
    ).toContain('/api/avatars/');
    await page.getByRole('button', { name: 'Remove picture', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Profile picture removed.' }),
    ).toBeVisible();
    await expect(avatar.locator('img')).toHaveCount(0, { timeout: 20_000 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: users.member } })).image).toBeNull();
  } finally {
    await context.close();
  }
});

test('profile picture errors are localized and do not change display name editing', async ({
  page,
}) => {
  await seedBrowserSession(prisma, page.context(), users.member);
  await page.goto('/profile');
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().includes('/api/profile/avatar') && response.request().method() === 'POST',
  );
  await page.getByLabel('เลือกรูปโปรไฟล์').setInputFiles({
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
  });
  await uploaded;
  await expect(
    page.getByRole('alert').filter({ hasText: 'กรุณาใช้รูป JPG, PNG หรือ WebP ที่เปิดได้' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง' })).toBeDisabled();
  await page.getByLabel('ชื่อที่แสดง', { exact: true }).fill('Bestmymint Edited');
  await page.getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง' }).click();
  await expect(page.getByRole('heading', { name: 'Bestmymint Edited', exact: true })).toBeVisible();
});
