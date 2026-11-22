import { expect, test } from '@playwright/test';
import { at, openExplore, seedSettings } from './fixtures';

/**
 * Explore mode in a real browser (docs/plan.md, Phase 6): clicks on the
 * canvas, resolved by the real globe, name a place of the continent and
 * outline it. Malta-sized places are under a pixel at the continent's view,
 * so the clicks go to places a mouse can hit.
 */

test('a click names a place of the continent and outlines it, and the sea keeps the name', async ({ page }) => {
  await seedSettings(page, { continent: 'europe' });
  await openExplore(page);
  const name = page.getByTestId('explore-name');
  const outline = page.getByTestId('globe-selected-outline');
  await expect(page.getByTestId('explore-prompt')).toBeVisible();
  await expect(name).toHaveCount(0);
  await expect(page.getByTestId('countdown')).toHaveCount(0);

  const fra = await at(page, 'FRA');
  await page.mouse.click(fra.x, fra.y);
  await expect(name).toHaveAttribute('data-id', 'FRA');
  await expect(outline).toHaveAttribute('data-id', 'FRA');
  await expect(outline.locator('path').first()).toHaveAttribute('d', /^M/);
  // It judges nothing.
  await expect(page.getByTestId('globe-mark')).toHaveCount(0);

  const pol = await at(page, 'POL');
  await page.mouse.click(pol.x, pol.y);
  await expect(name).toHaveAttribute('data-id', 'POL');
  await expect(outline).toHaveAttribute('data-id', 'POL');

  // The Atlantic, 250 px west of France, then Turkey (Asia in the data,
  // grey here): neither names anything, so Poland stays.
  await page.mouse.click(fra.x - 250, fra.y);
  const tur = await at(page, 'TUR');
  await page.mouse.click(tur.x, tur.y);
  await page.waitForTimeout(500);
  await expect(name).toHaveAttribute('data-id', 'POL');
  await expect(outline).toHaveAttribute('data-id', 'POL');

  await page.getByTestId('explore-home').click();
  await expect(page.getByTestId('start-game')).toBeVisible();
});
