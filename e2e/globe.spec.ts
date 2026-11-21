import { expect, test, type Page } from '@playwright/test';
import type {} from '../src/components/geoQuizzHook';
import { CONTINENT_VIEWS, GLOBE_VFOV_DEG } from '../src/domain/view';

/**
 * The globe in a real browser (plan, Phase 2 item 9): WebGL, and clicks on
 * the canvas resolved by the real globe. Runs against the Phase 2 preview
 * page, which starts on Europe and shows the last pick in `picked`.
 */

const open = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByTestId('globe')).toHaveAttribute('data-state', 'ready', { timeout: 45_000 });
};

const screenPoint = async (page: Page, id: string) => {
  const point = await page.evaluate((i) => window.__geoQuizz?.screenPoint(i), id);
  if (point === undefined) throw new Error('window.__geoQuizz is missing: is the globe mounted?');
  return point;
};

const at = async (page: Page, id: string) => {
  const point = await screenPoint(page, id);
  if (!point) throw new Error(`${id} is behind the globe`);
  return point;
};

const picked = (page: Page) => page.getByTestId('picked');

test('renders the globe with the camera the tap-ring rule assumes', async ({ page }) => {
  await page.goto('/');
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  expect(webgl, 'no WebGL in this browser: see the launch flags in playwright.config.ts').toBe(true);
  await open(page);
  await expect(page.getByTestId('globe').locator('canvas').first()).toBeVisible();

  const camera = await page.evaluate(() => window.__geoQuizz?.camera());
  // Phase 1 set GLOBE_VFOV_DEG from globe.gl's published sources; this is
  // the installed globe's camera.
  expect(camera?.fov).toBe(GLOBE_VFOV_DEG);
  const europe = CONTINENT_VIEWS.europe;
  expect(camera?.lat).toBeCloseTo(europe.lat, 3);
  expect(camera?.lng).toBeCloseTo(europe.lng, 3);
  expect(camera?.altitude).toBeCloseTo(europe.altitude, 3);
});

test('screenPoint returns a point on the canvas for a country', async ({ page }) => {
  await open(page);
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

test('a click picks the country under it, right after another one', async ({ page }) => {
  // Instant clicks, one country after another: what globe.gl's
  // onPolygonClick got wrong when frames were fast (docs/plan.md, Phase 2).
  await open(page);
  // Countries whose anchor is clear of every tap ring: Italy's, for one, is
  // within San Marino's ring at this view, and the ring wins.
  for (const id of ['FRA', 'DEU', 'ESP', 'POL', 'SWE']) {
    const p = await at(page, id);
    await page.mouse.click(p.x, p.y);
    await expect(picked(page)).toHaveAttribute('data-id', id);
  }
});

test('a click on the sea picks nothing', async ({ page }) => {
  await open(page);
  const fra = await at(page, 'FRA');
  // 250 px west of France at this zoom is the Atlantic.
  await page.mouse.click(fra.x - 250, fra.y);
  await page.waitForTimeout(300);
  await expect(picked(page)).toHaveAttribute('data-id', '');
});

test('a drag turns the globe and picks nothing', async ({ page }) => {
  await open(page);
  const p = await at(page, 'DEU');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 150, p.y + 20, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(async () => (await page.evaluate(() => window.__geoQuizz?.camera()))?.lng)
    .not.toBeCloseTo(CONTINENT_VIEWS.europe.lng, 0);
  await expect(picked(page)).toHaveAttribute('data-id', '');
});

test('a click inside a ring picks the tiny country, not the one under it', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-testid="globe-ring"][data-id="VAT"]')).toBeVisible();
  const vat = await at(page, 'VAT');
  // 15 px east of the Vatican is Italy, but inside Vatican City's ring.
  await page.mouse.click(vat.x + 15, vat.y);
  await expect(picked(page)).toHaveAttribute('data-id', 'VAT');
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a tap picks the country under the finger', async ({ page }) => {
    await open(page);
    for (const id of ['SWE', 'ROU']) {
      const p = await at(page, id);
      await page.touchscreen.tap(p.x, p.y);
      await expect(picked(page)).toHaveAttribute('data-id', id);
    }
  });
});
