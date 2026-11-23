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
 * The oceans in a real browser (docs/plan.md, Phase 7): clicks on the
 * canvas, resolved by the real globe, pick an ocean's disc; a click on land
 * picks nothing, even where land lies over a disc. At the oceans' view the
 * Atlantic's and the Indian Ocean's first discs face the camera.
 */

test('an oceans round: a click on a disc answers, a click on land does nothing', async ({ page }) => {
  await seedRound(page, { continent: 'oceans', secondsPerQuestion: 60 }, ['atlantic', 'indian']);
  await watchFeedback(page);
  await startRound(page);
  await expect(page.getByTestId('game-counter')).toHaveText('1 / 2');
  await expect(page.getByTestId('switch-tiny')).toHaveCount(0);

  await expect(target(page)).toHaveAttribute('data-id', 'atlantic');
  await settle(page);
  const atlantic = await at(page, 'atlantic');
  await page.mouse.click(atlantic.x, atlantic.y);
  await expect.poll(async () => (await feedbackOn(page, 'atlantic'))?.picked).toBe('atlantic');

  await expect(target(page)).toHaveAttribute('data-id', 'indian', { timeout: 15_000 });
  await expect(verdict(page)).toHaveCount(0);
  await settle(page);
  // The Democratic Republic of the Congo: grey land, not an answer.
  const congo = await at(page, 'COD');
  await page.mouse.click(congo.x, congo.y);
  await page.waitForTimeout(500);
  await expect(verdict(page)).toHaveCount(0);
  // A wrong ocean: the answer is outlined and marked ✅, the pick ❌.
  const again = await at(page, 'atlantic');
  await page.mouse.click(again.x, again.y);
  await expect.poll(async () => (await feedbackOn(page, 'indian'))?.picked).toBe('atlantic');

  await expect(page.getByTestId('results-score')).toHaveText('1 / 2', { timeout: 15_000 });
  expect(await feedbackOn(page, 'atlantic')).toEqual({
    verdict: 'correct',
    picked: 'atlantic',
    outline: 'atlantic',
    outlined: true,
    marks: { atlantic: 'right' },
  });
  expect(await feedbackOn(page, 'indian')).toEqual({
    verdict: 'wrong',
    picked: 'atlantic',
    outline: 'indian',
    outlined: true,
    marks: { indian: 'right', atlantic: 'wrong' },
  });
});

test('Explore on the oceans names the ocean of a disc, and land keeps the name', async ({ page }) => {
  await seedSettings(page, { continent: 'oceans' });
  await openExplore(page);
  const name = page.getByTestId('explore-name');
  await expect(name).toHaveCount(0);

  const indian = await at(page, 'indian');
  await page.mouse.click(indian.x, indian.y);
  await expect(name).toHaveAttribute('data-id', 'indian');
  await expect(page.getByTestId('globe-selected-outline')).toHaveAttribute('data-id', 'indian');

  const congo = await at(page, 'COD');
  await page.mouse.click(congo.x, congo.y);
  await page.waitForTimeout(500);
  await expect(name).toHaveAttribute('data-id', 'indian');
});
