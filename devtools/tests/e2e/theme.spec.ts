import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedBrowserSession } from './helpers/session';

const prisma = new PrismaClient();
const userId = `theme-test-${randomUUID()}`;
test.beforeAll(async () => {
  await prisma.user.create({
    data: { id: userId, email: `${userId}@example.invalid`, name: 'Theme review', role: 'ADMIN' },
  });
  await prisma.pet.create({
    data: {
      ownerId: userId,
      name: 'Milo',
      species: 'dog',
      breed: 'Golden Retriever',
      color: 'peach',
      sex: 'male',
      weight: 12.5,
      records: {
        create: [
          { category: 'weight', title: 'Weight record', value: 12, date: new Date('2025-01-01') },
          { category: 'weight', title: 'Latest weight', value: 12.5, date: new Date('2025-02-01') },
        ],
      },
    },
  });
});
test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

test('follows system preference, persists a manual choice, and synchronizes tabs', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'สลับโหมดสว่าง/มืด' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/meetups');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const other = await context.newPage();
  await other.goto('/en');
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await other.getByRole('button', { name: 'Toggle light/dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.close();
});

test('saved dark preference is applied before client bundles hydrate', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pawmap:theme', 'dark'));
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    'rgb(28, 34, 41)',
  );
});

test('dark palette stays readable across public, pet, account and admin pages on desktop and mobile', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await seedBrowserSession(prisma, page.context(), userId);
  await page.addInitScript(() => {
    localStorage.setItem('pawmap:theme', 'dark');
    sessionStorage.setItem('pawmap:intro-seen:v2', '1');
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/',
      '/en',
      '/pets',
      '/en/pets',
      '/meetups',
      '/emergency',
      '/en/emergency',
      '/favorites',
      '/profile',
      '/notifications',
      '/my-submissions',
      '/submit',
      '/admin',
      '/admin/users',
      '/login',
    ]) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
        `${path} at ${width}`,
      ).toBe(false);
      if (['/', '/pets', '/meetups', '/emergency', '/admin', '/login'].includes(path)) {
        const result = await new AxeBuilder({ page }).analyze();
        const violations = result.violations.filter((v) =>
          ['serious', 'critical'].includes(v.impact ?? ''),
        );
        expect(
          violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({ target: n.target, message: n.failureSummary })),
          })),
          `${path} at ${width}`,
        ).toEqual([]);
      }
      if (path === '/' || path === '/pets')
        await testInfo.attach(`dark-${path === '/' ? 'home' : 'pets'}-${width}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
    }
  }
  expect(errors).toEqual([]);
});

test('switches the live 3D canvas and street-map fallback without reloading the model', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/explore');
  const model = page.getByLabel('แผนที่ประเทศไทยแบบโต้ตอบ');
  await expect(model).toHaveAttribute('data-model-ready', 'true', { timeout: 30_000 });
  await expect(model).toHaveAttribute('data-model-theme', 'light');
  await page.getByRole('button', { name: 'สลับโหมดสว่าง/มืด' }).click();
  await expect(model).toHaveAttribute('data-model-theme', 'dark');
  await expect(model).toHaveAttribute('data-model-ready', 'true');
  await page.getByRole('button', { name: 'แผนที่ถนน', exact: true }).click();
  const street = page.getByLabel('แผนที่ถนนประเทศไทย');
  await expect(street).toHaveAttribute('data-osm-ready', 'true', { timeout: 30_000 });
  await expect(street).toHaveAttribute('data-osm-theme', 'dark');
  await expect(street).toHaveAttribute('data-osm-fallback', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'สลับโหมดสว่าง/มืด' }).click();
  await expect(street).toHaveAttribute('data-osm-theme', 'light');
});

test('theme toggle still works when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', {
      value() {
        throw new Error('Storage unavailable');
      },
    });
    Object.defineProperty(Storage.prototype, 'setItem', {
      value() {
        throw new Error('Storage unavailable');
      },
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'สลับโหมดสว่าง/มืด' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
