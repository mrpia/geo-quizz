import { expect, test } from '@playwright/test';
import {
  at,
  feedbackOn,
  openExplore,
  seedRound,
  seedSettings,
  settle,
  startRound,
  target,
  verdict,
  watchFeedback,
} from './fixtures';

/**
 * The seas in a real browser (docs/plan.md, Phase 8): with "Seas" on, a
 * click on a sea's disc answers, a small sea is ringed at the whole-globe
 * view and its ring takes the click, and land still picks nothing. At the
 * oceans' view the seas around Europe, Arabia and India face the camera.
 *
 * At that view Europe is small, and a ring reaches 26 px over land
 * (src/domain/pick.ts): Italy's anchor is within the North Sea's ring, so
 * a click there picks the North Sea. The land click is in Congo, away from
 * every ring, as in oceans.spec.ts.
 */

test('an oceans round with the seas: a disc answers, a ring answers, land does nothing', async ({ page }) => {
  await seedRound(page, { continent: 'oceans', includeSeas: true, secondsPerQuestion: 60 }, [
    'mediterranean-sea',
    'arabian-sea',
  ]);
  await watchFeedback(page);
  await startRound(page);
  await expect(page.getByTestId('game-counter')).toHaveText('1 / 2');
  await expect(page.getByTestId('switch-seas')).toHaveCount(0);

  await expect(target(page)).toHaveAttribute('data-id', 'mediterranean-sea');
  await settle(page);
  // Too small to tap at this zoom: a ring, as for the tiny countries.
  await expect(page.locator('[data-testid="globe-ring"][data-id="baltic-sea"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="globe-ring"][data-id="mediterranean-sea"]')).toHaveCount(0);
  // The Democratic Republic of the Congo: grey land, not an answer.
  const congo = await at(page, 'COD');
  await page.mouse.click(congo.x, congo.y);
  await page.waitForTimeout(500);
  await expect(verdict(page)).toHaveCount(0);
  const mediterranean = await at(page, 'mediterranean-sea');
  await page.mouse.click(mediterranean.x, mediterranean.y);
  await expect.poll(async () => (await feedbackOn(page, 'mediterranean-sea'))?.picked).toBe('mediterranean-sea');

  await expect(target(page)).toHaveAttribute('data-id', 'arabian-sea', { timeout: 15_000 });
  await settle(page);
  // The Persian Gulf's ring: a wrong sea, named, with the answer marked.
  const gulf = await at(page, 'persian-gulf');
  await page.mouse.click(gulf.x, gulf.y);
  await expect.poll(async () => (await feedbackOn(page, 'arabian-sea'))?.picked).toBe('persian-gulf');

  await expect(page.getByTestId('results-score')).toHaveText('1 / 2', { timeout: 15_000 });
  expect(await feedbackOn(page, 'arabian-sea')).toEqual({
    verdict: 'wrong',
    picked: 'persian-gulf',
    outline: 'arabian-sea',
    outlined: true,
    marks: { 'arabian-sea': 'right', 'persian-gulf': 'wrong' },
  });
});

test('Explore on the oceans with the seas names the sea of a disc', async ({ page }) => {
  await seedSettings(page, { continent: 'oceans', includeSeas: true });
  await openExplore(page);
  await settle(page);
  const name = page.getByTestId('explore-name');
  const north = await at(page, 'north-sea');
  await page.mouse.click(north.x, north.y);
  await expect(name).toHaveAttribute('data-id', 'north-sea');
  await expect(name).toHaveText('North Sea');
});

test('without the seas an oceans round draws no sea and rings nothing', async ({ page }) => {
  await seedRound(page, { continent: 'oceans', secondsPerQuestion: 60 }, ['indian']);
  await startRound(page);
  await settle(page);
  await expect(page.getByTestId('globe-ring')).toHaveCount(0);
  const mediterranean = await at(page, 'mediterranean-sea');
  await page.mouse.click(mediterranean.x, mediterranean.y);
  await page.waitForTimeout(500);
  await expect(verdict(page)).toHaveCount(0);
});
