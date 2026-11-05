import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { seedBrowserSession } from './helpers/session';
import { createPublicPlaceFixture } from '../helpers/place-fixture';

const prisma = new PrismaClient();
const prefix = `member-pets-${randomUUID()}`;
const users = {
  host: `${prefix}-host`,
  member: `${prefix}-member`,
  empty: `${prefix}-empty`,
  outsider: `${prefix}-outsider`,
};
let placeId = '';
let placeName = '';
let meetupId = '';

const bangkokInput = (date: Date) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(date)
    .replace(' ', 'T');

test.beforeAll(async () => {
  await prisma.user.createMany({
    data: Object.entries(users).map(([role, id]) => ({
      id,
      name: role === 'member' ? 'Bestmymint Fixture' : `Member ${role}`,
      email: `${id}@example.invalid`,
      emailVerified: true,
    })),
  });
  const place = await createPublicPlaceFixture(prisma, prefix);
  placeId = place.id;
  placeName = place.nameTh;
  await prisma.place.update({ where: { id: placeId }, data: { status: 'STALE' } });
  const meetup = await prisma.meetup.create({
    data: {
      title: prefix,
      description: 'Temporary browser test for chat member pets.',
      placeId,
      hostId: users.host,
      startsAt: new Date(Date.now() + 3 * 86_400_000),
      endsAt: new Date(Date.now() + 3 * 86_400_000 + 3_600_000),
      maxMembers: 8,
      members: { create: [users.host, users.member, users.empty].map((userId) => ({ userId })) },
      messages: { create: { kind: 'TEXT', authorId: users.member, text: 'Hello from my pets' } },
    },
  });
  meetupId = meetup.id;
  await prisma.pet.createMany({
    data: [
      {
        ownerId: users.member,
        name: 'Milo Fixture',
        species: 'dog',
        breed: 'Golden Retriever',
        sex: 'male',
        color: 'sage',
        notes: 'PRIVATE-PET-NOTE',
        weight: 9,
      },
      {
        ownerId: users.member,
        name: 'Luna Fixture',
        species: 'cat',
        breed: 'British Shorthair',
        sex: 'female',
        color: 'lavender',
      },
      { ownerId: users.member, name: 'Archived Fixture', species: 'cat', archivedAt: new Date() },
    ],
  });
});

test.afterAll(async () => {
  const ids = (
    await prisma.meetup.findMany({ where: { hostId: users.host }, select: { id: true } })
  ).map((m) => m.id);
  await prisma.auditLog.deleteMany({ where: { entityType: 'Meetup', entityId: { in: ids } } });
  await prisma.meetup.deleteMany({ where: { id: { in: ids } } });
  if (placeId) await prisma.place.deleteMany({ where: { id: placeId } });
  await prisma.rateLimitBucket.deleteMany({ where: { bucketKey: { in: Object.values(users) } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});

test('chat names open member pets in both languages and fit mobile and dark mode', async ({
  page,
}, testInfo) => {
  await seedBrowserSession(prisma, page.context(), users.host);
  await page.goto(`/meetups/${meetupId}/chat`);
  const author = page.getByRole('link', { name: 'ดูสัตว์เลี้ยงของ Bestmymint Fixture' });
  await expect(author).toBeVisible();
  await author.click();
  await expect(page).toHaveURL(new RegExp(`/meetups/${meetupId}/members/${users.member}$`));
  await expect(
    page.getByRole('heading', { name: 'Bestmymint Fixture', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Milo Fixture', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Luna Fixture', exact: true })).toBeVisible();
  await expect(page.getByText('Archived Fixture')).toHaveCount(0);
  await expect(page.getByText('PRIVATE-PET-NOTE')).toHaveCount(0);
  for (const [width, locale, theme] of [
    [1440, '', 'light'],
    [390, 'en/', 'dark'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/${locale}meetups/${meetupId}/members/${users.member}`);
    await page.evaluate(
      (value) => document.documentElement.setAttribute('data-theme', value),
      theme,
    );
    await expect(page.getByRole('heading', { name: 'Milo Fixture', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
      [],
    );
    await testInfo.attach(`member-pets-${width}-${theme}`, {
      body: await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`member-pets-${width}-${theme}.png`),
      }),
      contentType: 'image/png',
    });
  }
  await page.getByRole('link', { name: 'Back to group chat' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/meetups/${meetupId}/chat$`));
  await page.goto(`/en/meetups/${meetupId}/members/${users.empty}`);
  await expect(page.getByText('This member has not added any pets yet.')).toBeVisible();
});

test('Meetup picker reads the same imported places as the map and publishes the selected ID', async ({
  page,
}) => {
  await seedBrowserSession(prisma, page.context(), users.host);
  const optionsResponse = await page.request.get(`/api/meetups/places?q=${prefix}`);
  const mapResponse = await page.request.get(`/api/places/map?detail=compact&q=${prefix}`);
  expect(optionsResponse.ok()).toBe(true);
  expect(mapResponse.ok()).toBe(true);
  expect((await optionsResponse.json()).items.map((item: { id: string }) => item.id)).toEqual([
    placeId,
  ]);
  expect((await mapResponse.json()).features.map((item: { id: string }) => item.id)).toEqual([
    placeId,
  ]);
  await page.goto('/meetups/new');
  const input = page.locator('#meetup-place-query');
  await input.focus();
  await expect(page.getByRole('option').first()).toBeVisible();
  await input.fill(placeName);
  const result = page.getByRole('option').filter({ hasText: placeName });
  await expect(result).toBeVisible();
  await input.press('Enter');
  await expect(result).toHaveCount(0);
  await expect(page.getByText(placeName, { exact: true })).toBeVisible();
  const title = `Create ${prefix}`;
  await page.locator('input[name="title"]').fill(title);
  await page
    .locator('textarea[name="description"]')
    .fill('กิจกรรมที่เลือกสถานที่จากฐานข้อมูลเดียวกับแผนที่');
  const start = new Date(Date.now() + 4 * 86_400_000);
  await page.locator('input[name="startsAt"]').fill(bangkokInput(start));
  await page
    .locator('input[name="endsAt"]')
    .fill(bangkokInput(new Date(start.getTime() + 3_600_000)));
  await page.getByRole('button', { name: 'เผยแพร่ Meetup' }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible({
    timeout: 20_000,
  });
  const created = await prisma.meetup.findFirstOrThrow({ where: { hostId: users.host, title } });
  expect(created.placeId).toBe(placeId);
});

test('direct member URLs redirect guests and withhold pets from nonmembers', async ({ page }) => {
  const path = `/en/meetups/${meetupId}/members/${users.member}`;
  await page.goto(path);
  await expect(page).toHaveURL(/\/en\/login\?next=/);
  expect(new URL(page.url()).searchParams.get('next')).toBe(path);
  await seedBrowserSession(prisma, page.context(), users.outsider);
  const response = await page.goto(path);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Milo Fixture' })).toHaveCount(0);
  expect(await page.content()).not.toContain('PRIVATE-PET-NOTE');
});
