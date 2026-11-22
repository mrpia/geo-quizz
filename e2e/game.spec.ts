import { expect, test, type Page } from '@playwright/test';
import { CONTINENT_VIEWS } from '../src/domain/view';
import {
  anchorOf,
  at,
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
 * Whole rounds in a real browser (plan, Phase 3): a 3-country round played
 * with a mouse and with a finger, and a round whose 3 s timer runs out.
 */

type Tap = (page: Page, x: number, y: number) => Promise<void>;

const click: Tap = (page, x, y) => page.mouse.click(x, y);
const touch: Tap = (page, x, y) => page.touchscreen.tap(x, y);

/** Answers the current question by tapping `id`'s anchor. */
const answer = async (page: Page, tap: Tap, asked: string, id: string) => {
  await expect(target(page)).toHaveAttribute('data-id', asked);
  await expect(verdict(page)).toHaveCount(0);
  await settle(page);
  const p = await at(page, id);
  await tap(page, p.x, p.y);
  await expect.poll(async () => (await feedbackOn(page, asked))?.picked).toBe(id);
};

const results = (page: Page) => page.getByTestId('results-row');

for (const [device, tap] of [
  ['a mouse', click],
  ['a finger', touch],
] as const) {
  test.describe(`with ${device}`, () => {
    test.use({ hasTouch: tap === touch });

    test('plays a 3-country round to the results, then again', async ({ page }) => {
      await seedRound(page, { continent: 'europe', secondsPerQuestion: 60 }, ['FRA', 'DEU', 'ESP']);
      await watchFeedback(page);
      await startRound(page);
      await expect(page.getByTestId('game-counter')).toHaveText('1 / 3');

      await answer(page, tap, 'FRA', 'FRA');
      // A wrong tap: the answer is outlined and marked ✅, the pick marked ❌.
      await answer(page, tap, 'DEU', 'POL');
      await answer(page, tap, 'ESP', 'ESP');

      await expect(page.getByTestId('results-score')).toHaveText('2 / 3', { timeout: 15_000 });
      await expect(results(page)).toHaveCount(3);
      expect(await results(page).evaluateAll((rows) => rows.map((r) => r.getAttribute('data-outcome')))).toEqual([
        'correct',
        'wrong',
        'correct',
      ]);
      const shown = (verdict: string, picked: string, answer: string, marks: Record<string, string>) => ({
        verdict,
        picked,
        outline: answer,
        outlined: true,
        marks,
      });
      expect(await feedbackOn(page, 'FRA')).toEqual(shown('correct', 'FRA', 'FRA', { FRA: 'right' }));
      expect(await feedbackOn(page, 'DEU')).toEqual(shown('wrong', 'POL', 'DEU', { DEU: 'right', POL: 'wrong' }));
      expect(await feedbackOn(page, 'ESP')).toEqual(shown('correct', 'ESP', 'ESP', { ESP: 'right' }));

      await page.getByTestId('play-again').click();
      await expect(page.getByTestId('globe')).toHaveAttribute('data-state', 'ready', { timeout: 45_000 });
      await expect(page.getByTestId('game-counter')).toHaveText('1 / 3');
    });
  });
}

test('a round whose timer runs out flies to the answer and outlines it', async ({ page }) => {
  // Heard Island is behind the horizon at the Africa view.
  await seedRound(page, { continent: 'africa', secondsPerQuestion: 3 }, ['HMD']);
  await startRound(page);
  await expect(target(page)).toHaveAttribute('data-id', 'HMD');
  expect(await screenPoint(page, 'HMD')).toBeNull();

  // The answer is on screen for 4 s, and a loaded machine polls slowly, so
  // the page itself records, frame by frame, the verdict, the outline, and
  // whether the camera came over the answer at the round's altitude with the
  // outline drawn and the ✅ showing there.
  const [lng, lat] = anchorOf('HMD');
  await page.evaluate(
    ({ lat, lng, altitude }) => {
      const seen = { verdict: '', outline: '', flew: false, outlined: false, marked: false };
      (window as unknown as { __seen: typeof seen }).__seen = seen;
      const look = () => {
        const verdict = document.querySelector<HTMLElement>('[data-testid="game-verdict"]');
        const outline = document.querySelector<SVGElement>('[data-testid="globe-answer-outline"]');
        const tick = document.querySelector('[data-testid="globe-mark"][data-id="HMD"][data-mark="right"]');
        seen.verdict ||= verdict?.dataset.verdict ?? '';
        seen.outline ||= outline?.dataset.id ?? '';
        const d = outline?.querySelector('path')?.getAttribute('d') ?? '';
        const view = window.__geoQuizz?.camera();
        if (view && Math.hypot(view.lat - lat, view.lng - lng) < 0.5 && Math.abs(view.altitude - altitude) < 0.01) {
          seen.flew = true;
          if (d.startsWith('M')) seen.outlined = true;
          if (tick && !tick.classList.contains('globe-mark--hidden')) seen.marked = true;
        }
        if (!document.querySelector('[data-testid="results-score"]')) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    },
    { lat, lng, altitude: CONTINENT_VIEWS.africa.altitude },
  );

  await expect(results(page)).toHaveCount(1, { timeout: 20_000 });
  await expect(results(page)).toHaveAttribute('data-outcome', 'timeout');
  await expect(page.getByTestId('results-score')).toHaveText('0 / 1');
  expect(await page.evaluate(() => (window as unknown as { __seen: unknown }).__seen)).toEqual({
    verdict: 'timeout',
    outline: 'HMD',
    flew: true,
    outlined: true,
    marked: true,
  });
});
