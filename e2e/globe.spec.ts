import { expect, test, type Page } from '@playwright/test';
import { CONTINENT_VIEWS, GLOBE_VFOV_DEG } from '../src/domain/view';
import { at, camera, screenPoint, seedRound, settle, startRound, target, verdict } from './fixtures';

/**
 * The globe in a real browser (plan, Phase 2 item 9): WebGL, and clicks on
 * the canvas resolved by the real globe. Each test plays a round on Europe
 * with a long timer, and reads what a click picked from the verdict.
 */

const seed = (page: Page, ids: string[]) =>
  seedRound(page, { continent: 'europe', secondsPerQuestion: 60 }, ids);

test('renders the globe with the camera the tap-ring rule assumes', async ({ page }) => {
  await seed(page, ['FRA']);
  await page.goto('/');
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  expect(webgl, 'no WebGL in this browser: see the launch flags in playwright.config.ts').toBe(true);
  await startRound(page);
  await expect(page.getByTestId('globe').locator('canvas').first()).toBeVisible();

  const view = await camera(page);
  // Phase 1 set GLOBE_VFOV_DEG from globe.gl's published sources; this is
  // the installed globe's camera.
  expect(view.fov).toBe(GLOBE_VFOV_DEG);
  expect(view.lat).toBeCloseTo(CONTINENT_VIEWS.europe.lat, 3);
  expect(view.lng).toBeCloseTo(CONTINENT_VIEWS.europe.lng, 3);
  expect(view.altitude).toBeCloseTo(CONTINENT_VIEWS.europe.altitude, 3);
});

test('screenPoint returns a point on the canvas for a country', async ({ page }) => {
  await seed(page, ['FRA']);
  await startRound(page);
  const box = await page.getByTestId('globe').locator('canvas').first().boundingBox();
  if (!box) throw new Error('no canvas');
  const p = await at(page, 'CHE');
  expect(p.x).toBeGreaterThan(box.x);
  expect(p.x).toBeLessThan(box.x + box.width);
  expect(p.y).toBeGreaterThan(box.y);
  expect(p.y).toBeLessThan(box.y + box.height);
  // New Zealand is on the far side of the globe from Europe.
  expect(await screenPoint(page, 'NZL')).toBeNull();
});

test('a click on the sea picks nothing', async ({ page }) => {
  await seed(page, ['FRA']);
  await startRound(page);
  const fra = await at(page, 'FRA');
  // 250 px west of France at this zoom is the Atlantic.
  await page.mouse.click(fra.x - 250, fra.y);
  await page.waitForTimeout(500);
  await expect(verdict(page)).toHaveCount(0);
});

test('a drag turns the globe and picks nothing', async ({ page }) => {
  await seed(page, ['DEU']);
  await startRound(page);
  const p = await at(page, 'DEU');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 150, p.y + 20, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await camera(page)).lng).not.toBeCloseTo(CONTINENT_VIEWS.europe.lng, 0);
  await expect(verdict(page)).toHaveCount(0);
});

test("a ring wins in its bullseye, over the sea, but not elsewhere over a large country", async ({ page }) => {
  // The owner's rule of 2026-11-21 (src/domain/pick.ts).
  await seed(page, ['VAT', 'ITA', 'MLT']);
  await startRound(page);
  await expect(page.locator('[data-testid="globe-ring"][data-id="VAT"]')).toBeVisible();

  // 5 px from Vatican City's centre: its bullseye.
  await expect(target(page)).toHaveAttribute('data-id', 'VAT');
  const vat = await at(page, 'VAT');
  await page.mouse.click(vat.x + 5, vat.y);
  await expect(verdict(page)).toHaveAttribute('data-picked', 'VAT');

  // 15 px east of it: inside the drawn ring, but Italy's.
  await expect(target(page)).toHaveAttribute('data-id', 'ITA');
  await page.mouse.click(vat.x + 15, vat.y);
  await expect(verdict(page)).toHaveAttribute('data-picked', 'ITA');

  // 20 px south of Malta is the sea: the ring keeps its full reach there.
  await expect(target(page)).toHaveAttribute('data-id', 'MLT');
  const mlt = await at(page, 'MLT');
  await page.mouse.click(mlt.x, mlt.y + 20);
  await expect(verdict(page)).toHaveAttribute('data-picked', 'MLT');
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a tap picks the country under the finger', async ({ page }) => {
    await seed(page, ['SWE', 'ROU']);
    await startRound(page);
    for (const id of ['SWE', 'ROU']) {
      await expect(target(page)).toHaveAttribute('data-id', id);
      await settle(page);
      const p = await at(page, id);
      await page.touchscreen.tap(p.x, p.y);
      await expect(verdict(page)).toHaveAttribute('data-picked', id);
    }
  });
});
