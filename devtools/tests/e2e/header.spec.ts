import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { seedBrowserSession } from './helpers/session';

const prisma = new PrismaClient();
const prefix = `header-test-${randomUUID()}`;
test.beforeAll(async () => {
  for (const role of ['ADMIN', 'USER'] as const) {
    await prisma.user.create({
      data: {
        id: `${prefix}-${role}`,
        email: `${prefix}-${role.toLowerCase()}@example.invalid`,
        name: 'PetHub Administrator with a very long display name',
        role,
      },
    });
  }
});
test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
});

for (const role of ['ADMIN', 'USER', 'GUEST'] as const) {
  test(`${role} header keeps navigation and account controls separated in both languages`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    if (role !== 'GUEST') await seedBrowserSession(prisma, page.context(), `${prefix}-${role}`);
    await page.addInitScript(() => sessionStorage.setItem('pawmap:intro-seen:v2', '1'));
    for (const locale of ['th', 'en'] as const) {
      await page.goto(locale === 'th' ? '/' : '/en');
      if (role !== 'GUEST')
        await expect(page.locator('.header-actions a[href$="/profile"]')).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      for (const width of [320, 390, 768, 1024, 1279, 1280, 1440, 1499, 1500, 1536, 1884, 2560]) {
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(
            () =>
              page.locator('.site-header').evaluate((header) => {
                const errors: string[] = [];
                const row = header.querySelector('.header-row')!.getBoundingClientRect();
                const nav = header
                  .querySelector('nav[aria-label="Main navigation"]')!
                  .getBoundingClientRect();
                const controls = [...header.querySelector('.header-actions')!.children]
                  .filter((element) => getComputedStyle(element).position !== 'fixed')
                  .map((element) => element.getBoundingClientRect())
                  .filter((rect) => rect.width && rect.height);
                if (row.height > 81) errors.push('header row grew taller than 80px');
                if (document.documentElement.scrollWidth > innerWidth)
                  errors.push('horizontal page overflow');
                if (nav.width && Math.abs(nav.x + nav.width / 2 - innerWidth / 2) > 2)
                  errors.push('main navigation moved off center');
                if (nav.width && controls[0]!.left < nav.right + 8)
                  errors.push('account controls overlap main navigation');
                for (const [index, rect] of controls.entries()) {
                  if (rect.height > 42) errors.push(`control ${index} wrapped onto another line`);
                  if (rect.left < row.left - 1 || rect.right > row.right + 1)
                    errors.push(`control ${index} escaped the header`);
                  if (index && rect.left < controls[index - 1]!.right + 3)
                    errors.push(`control ${index} overlaps its neighbour`);
                }
                for (const label of header.querySelectorAll(
                  '.header-admin-label, .header-profile-name',
                )) {
                  const rect = label.getBoundingClientRect();
                  const lineHeight = Number.parseFloat(getComputedStyle(label).lineHeight);
                  if (rect.width && rect.height > lineHeight + 1)
                    errors.push('account label wrapped onto multiple lines');
                }
                return errors;
              }),
            { message: `${role}, ${locale}, ${width}px` },
          )
          .toEqual([]);
        if (role === 'ADMIN' && locale === 'th' && width === 1884)
          await testInfo.attach('admin-header-wide', {
            body: await page.locator('.site-header').screenshot(),
            contentType: 'image/png',
          });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .getByRole('button', { name: locale === 'th' ? 'เปิดเมนู' : 'Open menu', exact: true })
        .click();
      const menu = page.getByRole('navigation', { name: 'Mobile navigation' });
      await expect(menu).toBeVisible();
      await expect(menu.locator('a[href="/admin"]')).toHaveCount(role === 'ADMIN' ? 1 : 0);
      await expect(menu.locator('a[href$="/profile"]')).toHaveCount(role === 'GUEST' ? 0 : 1);
      await page
        .getByRole('button', { name: locale === 'th' ? 'ปิดเมนู' : 'Close menu', exact: true })
        .click();
      await expect(menu).toHaveCount(0);
    }
  });
}
