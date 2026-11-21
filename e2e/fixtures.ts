import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type {} from '../src/components/geoQuizzHook';
import type { Settings } from '../src/domain/settings';
import { countriesOf, parseWorld, type Continent, type WorldTopology } from '../src/domain/world';

/**
 * Deterministic rounds for the specs (the pattern of math-quizz's
 * e2e/fixtures.ts): settings written into localStorage and the round's
 * countries fixed before the page loads, so a spec knows which country it
 * will be asked and can pick one whose anchor it can click. Anchors to
 * avoid: behind the horizon at the continent's view (ATF, HMD, PCN), off
 * the canvas, or within a ring's bullseye (src/domain/pick.ts).
 */

const SETTINGS_KEY = 'geoquizz:settings';

const world = parseWorld(
  JSON.parse(readFileSync(new URL('../src/data/world.json', import.meta.url), 'utf8')) as WorldTopology,
);

/**
 * The values `Math.random` must return, in order, for `drawRound`
 * (src/domain/round.ts, a partial Fisher–Yates over the continent's
 * countries in data order) to ask `ids`, in that order.
 */
const randomsFor = (pool: readonly string[], ids: readonly string[]): number[] => {
  const items = [...pool];
  return ids.map((id, i) => {
    const j = items.indexOf(id);
    if (j < i) throw new Error(`randomsFor: ${id} is not in the pool, or asked twice`);
    [items[i], items[j]] = [items[j], items[i]];
    // drawRound takes j = i + floor(r · (n − i)); the middle of the step is safe.
    return (j - i + 0.5) / (items.length - i);
  });
};

/** The draw each page will be armed with when its round starts. */
const draws = new WeakMap<Page, number[]>();

/**
 * Starts the page with these settings and a round that asks `ids`. The
 * scripted values are armed only when `startRound` presses Start: React DOM
 * itself calls `Math.random` twice as it loads (keys for its internal
 * properties), and every call outside the draw gets the browser's own value,
 * so three.js still makes unique ids. The specs check the targets they are
 * shown, so a draw that goes wrong fails loudly.
 */
export const seedRound = async (
  page: Page,
  settings: Partial<Settings> & { continent: Continent },
  ids: readonly string[],
) => {
  const pool = countriesOf(world, settings.continent).map((c) => c.id);
  draws.set(page, randomsFor(pool, ids));
  await page.addInitScript(
    ({ key, settings }) => {
      localStorage.setItem(key, JSON.stringify(settings));
      const own = Math.random.bind(Math);
      const armed = window as unknown as { __geoQuizzDraw?: number[] };
      Math.random = () => armed.__geoQuizzDraw?.shift() ?? own();
    },
    { key: SETTINGS_KEY, settings: { language: 'en', ...settings, countriesPerRound: ids.length } },
  );
};

/** From Home to the first question, once the globe is drawn. */
export const startRound = async (page: Page) => {
  await page.goto('/');
  const draw = draws.get(page);
  if (draw) {
    await page.evaluate((values) => {
      (window as unknown as { __geoQuizzDraw?: number[] }).__geoQuizzDraw = values;
    }, draw);
  }
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('globe')).toHaveAttribute('data-state', 'ready', { timeout: 45_000 });
};

export const target = (page: Page) => page.getByTestId('game-target');
export const verdict = (page: Page) => page.getByTestId('game-verdict');

export const anchorOf = (id: string) => {
  const country = world.byId.get(id);
  if (!country) throw new Error(`no country ${id}`);
  return country.properties.anchor;
};

export const camera = async (page: Page) => {
  const view = await page.evaluate(() => window.__geoQuizz?.camera());
  if (!view) throw new Error('window.__geoQuizz is missing: is the globe mounted?');
  return view;
};

export const screenPoint = async (page: Page, id: string) => {
  const point = await page.evaluate((i) => window.__geoQuizz?.screenPoint(i), id);
  if (point === undefined) throw new Error('window.__geoQuizz is missing: is the globe mounted?');
  return point;
};

export const at = async (page: Page, id: string) => {
  const point = await screenPoint(page, id);
  if (!point) throw new Error(`${id} is behind the globe`);
  return point;
};

/**
 * Waits until the camera stops moving. Orbit-control inertia decays per
 * frame, and SwiftShader draws one every 300 ms or more, so after a drag or
 * a flight the camera keeps moving for seconds.
 */
export const settle = async (page: Page) => {
  let last = await camera(page);
  await expect
    .poll(
      async () => {
        const now = await camera(page);
        const still =
          Math.abs(now.lat - last.lat) < 1e-3 &&
          Math.abs(now.lng - last.lng) < 1e-3 &&
          Math.abs(now.altitude - last.altitude) < 1e-4;
        last = now;
        return still;
      },
      { intervals: [500], timeout: 30_000 },
    )
    .toBe(true);
};
