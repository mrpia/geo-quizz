import { expect, test, type Page } from '@playwright/test';
import { CONTINENT_VIEWS, GLOBE_VFOV_DEG } from '../src/domain/view';
import {
  at,
  camera,
  feedbackOn,
  screenPoint,
  seedRound,
  settle,
  startRound,
  target,
  verdict,
  watchFeedback,
} from './fixtures';

/**
 * The globe in a real browser (plan, Phase 2 item 9): WebGL, and clicks on
 * the canvas resolved by the real globe. Each test plays a round on Europe
 * with a long timer, and reads what a click picked from the verdict.
 */

const seed = async (page: Page, ids: string[]) => {
  await seedRound(page, { continent: 'europe', secondsPerQuestion: 60 }, ids);
  await watchFeedback(page);
};

/** What the tap on `asked` picked, from the page's own record (fixtures.ts). */
const pickedOn = (page: Page, asked: string) =>
  expect.poll(async () => (await feedbackOn(page, asked))?.picked);

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

test('asks the first country only once the map is drawn', async ({ page }) => {
  await seed(page, ['FRA']);
  // Watched from inside the page: what the globe said at the moment the
  // country's name entered the DOM. "ready" means every shape was drawn.
  await page.addInitScript(() => {
    const seen = { stateWhenAsked: '' };
    (window as unknown as { __asked: typeof seen }).__asked = seen;
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[data-testid="game-target"]')) return;
      seen.stateWhenAsked = document.querySelector<HTMLElement>('[data-testid="globe"]')?.dataset.state ?? 'none';
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await startRound(page);
  await expect(target(page)).toHaveAttribute('data-id', 'FRA');
  const asked = await page.evaluate(() => (window as unknown as { __asked: { stateWhenAsked: string } }).__asked);
  expect(asked.stateWhenAsked).toBe('ready');
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

test('the mouse outlines the country of the continent under it, and nothing else', async ({ page }) => {
  await seed(page, ['FRA']);
  await startRound(page);
  const hover = page.getByTestId('globe-hover-outline');
  const fra = await at(page, 'FRA');
  await page.mouse.move(fra.x, fra.y);
  await expect(hover).toHaveAttribute('data-id', 'FRA');
  await expect(hover.locator('path').first()).toHaveAttribute('d', /^M/);
  // The Atlantic, then Turkey (Asia in the data): not in the round, so
  // nothing lights up.
  await page.mouse.move(fra.x - 250, fra.y);
  await expect(hover).toHaveCount(0);
  const box = await page.getByTestId('globe').locator('canvas').first().boundingBox();
  const turkey = await at(page, 'TUR');
  expect(box && turkey.y < box.y + box.height && turkey.x < box.x + box.width).toBe(true);
  await page.mouse.move(turkey.x, turkey.y);
  await page.waitForTimeout(500);
  await expect(hover).toHaveCount(0);
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
  await pickedOn(page, 'VAT').toBe('VAT');

  // 15 px east of it: inside the drawn ring, but Italy's.
  await expect(target(page)).toHaveAttribute('data-id', 'ITA');
  await page.mouse.click(vat.x + 15, vat.y);
  await pickedOn(page, 'ITA').toBe('ITA');

  // 20 px south of Malta is the sea: the ring keeps its full reach there.
  await expect(target(page)).toHaveAttribute('data-id', 'MLT');
  const mlt = await at(page, 'MLT');
  await page.mouse.click(mlt.x, mlt.y + 20);
  await pickedOn(page, 'MLT').toBe('MLT');
});

test('without the tiny countries, they have no ring and a click on one picks nothing', async ({ page }) => {
  // docs/plan.md, Phase 5: a place left out acts like land outside the
  // continent. Malta is too small to hit at this zoom, so without the
  // switch its ring is what a click on it lands on (the test above).
  await seedRound(page, { continent: 'europe', timeLimitOn: false, skipTiny: true }, ['FRA']);
  await watchFeedback(page);
  await startRound(page);
  await expect(page.getByTestId('countdown')).toHaveCount(0);
  await expect(page.locator('[data-testid="globe-ring"][data-id="LUX"]')).toBeVisible();
  const ringed = await page
    .getByTestId('globe-ring')
    .evaluateAll((rings) => rings.map((ring) => (ring as HTMLElement).dataset.id));
  for (const id of ['VAT', 'MCO', 'SMR', 'LIE', 'AND', 'MLT']) expect(ringed).not.toContain(id);

  const mlt = await at(page, 'MLT');
  await page.mouse.click(mlt.x, mlt.y);
  await page.waitForTimeout(500);
  await expect(verdict(page)).toHaveCount(0);

  // The globe still takes clicks: France is the answer.
  const fra = await at(page, 'FRA');
  await page.mouse.click(fra.x, fra.y);
  await pickedOn(page, 'FRA').toBe('FRA');
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
      await pickedOn(page, id).toBe(id);
    }
  });
});
