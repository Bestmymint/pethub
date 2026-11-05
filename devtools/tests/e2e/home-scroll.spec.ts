import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`cover follows forward and backward scrolling at ${viewport.width}px and can be skipped`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const hero = page.locator('.paw-scroll-hero');
    const stage = page.locator('.paw-story-stage');
    const puppy = page.locator('.paw-story-puppy img');
    await puppy.evaluate((image: HTMLImageElement) => image.decode());
    const geometry = await hero.evaluate((element: HTMLElement) => ({
      start: element.getBoundingClientRect().top + scrollY - 80,
      distance: element.offsetHeight - (element.firstElementChild as HTMLElement).offsetHeight,
    }));
    const initialTransform = await puppy.evaluate((element) => getComputedStyle(element).transform);
    for (const [progress, chapter] of [
      [0.5, 1],
      [0.95, 2],
      [0, 0],
    ]) {
      await page.evaluate(
        (y) => scrollTo({ top: y, behavior: 'instant' }),
        geometry.start + geometry.distance * progress!,
      );
      await expect(hero).toHaveAttribute('data-chapter', String(chapter));
      const bounds = await stage.boundingBox();
      expect(Math.abs(bounds!.y - 80)).toBeLessThan(2);
      if (chapter === 1) {
        expect(await puppy.evaluate((element) => getComputedStyle(element).transform)).not.toBe(
          initialTransform,
        );
        await expect(page.getByRole('heading', { level: 1 })).toContainText('รักเขาให้ดี');
      }
    }
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ทุกที่ที่ไป');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.getByRole('link', { name: 'เลื่อนลง แล้วไปด้วยกัน' }).click();
    await expect
      .poll(async () => (await page.locator('#home-features').boundingBox())!.y)
      .toBeLessThan(130);
    await expect(page.getByRole('heading', { name: /ทุกเรื่องของน้อง/ })).toBeInViewport();
  });
}

test('reduced motion shows a static cover and both requested fonts work without Google requests', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 667 });
  const externalFonts: string[] = [];
  page.on('request', (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFonts.push(request.url());
  });
  await page.goto('/');
  const hero = page.locator('.paw-scroll-hero');
  await expect(hero).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('.paw-story-stage')).toHaveCSS('position', 'relative');
  await expect(page.locator('.paw-story-puppy img')).toHaveCSS('transform', 'none');
  expect((await hero.boundingBox())!.height).toBeLessThan(800);
  const fonts = await page.evaluate(async () => {
    await document.fonts.load('600 16px Poppins', 'Little moments');
    await document.fonts.load('600 16px Anuphan', 'เพื่อนตัวโปรด');
    return {
      english: document.fonts.check('600 16px Poppins', 'Little moments'),
      thai: document.fonts.check('600 16px Anuphan', 'เพื่อนตัวโปรด'),
      family: getComputedStyle(document.body).fontFamily,
    };
  });
  expect(fonts.english).toBe(true);
  expect(fonts.thai).toBe(true);
  expect(fonts.family).toContain('Poppins');
  expect(fonts.family).toContain('Anuphan');
  expect(externalFonts).toEqual([]);
  await page.getByRole('link', { name: 'เลื่อนลง แล้วไปด้วยกัน' }).click();
  await expect(page.getByRole('heading', { name: /ทุกเรื่องของน้อง/ })).toBeInViewport();
});
