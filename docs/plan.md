# Build plan

The app is built in phases. Each phase fits one Claude Code session and ends
with green `pnpm test` and `pnpm build`, a commit, and a push. A fresh session
starts by reading `CLAUDE.md`, this file and `docs/data.md`, then does the
next unticked phase.

From Phase 1 on, work on a branch (`phase-1-domain`, …) and open a pull
request against `main`, so each phase can be reviewed as one diff and CI runs
before it lands. Tick the phase off here in the same PR.

## The brief

A geography quiz for touch-screen tablets that also works with a mouse. The
player picks a continent; it appears on a 3D globe with country borders drawn
and no names. The app shows a country name from that continent; the player
has 10 seconds (configurable) to tap it. 10 countries per round
(configurable). Score kept and shown at the end. One player for now.
Deployed at **https://geo-quizz.mrpia.ch**. MIT, public repo `mrpia/geo-quizz`.

## Decisions already taken

Settled with the owner on 2026-11-21. Don't reopen them without asking.

| Topic | Decision | Notes |
|---|---|---|
| Stack | React 19 + TypeScript + Vite + pnpm, Vitest, Playwright | Same as `mrpia/math-quizz`; copy its patterns |
| Globe | **globe.gl** (Three.js, WebGL) | Chosen over a d3-geo SVG globe for the 3D look. Costs: ~700 KB+ of three.js, taps go through raycasting, e2e clicks need screen coordinates |
| Quiz pool | **Every Natural Earth feature** of the continent | Includes dependencies and disputed areas, see `docs/data.md` |
| Tiny countries | **Tap rings + zoom** | A ring marks each country too small to hit at the current zoom; pinch/wheel zoom everywhere |
| Languages | **FR / DE / EN**, UI and country names | Country names come from the data file |
| Data | Natural Earth 1:50m v5.1.2, public domain | `docs/data.md` |
| Hosting | Firebase Hosting, custom domain `geo-quizz.mrpia.ch` | Same setup as math-quizz.mrpia.ch |

## Phases

- [x] **Phase 0 — Foundation**
- [x] **Phase 1 — Domain, settings, i18n** (no globe, no screens)
- [ ] **Phase 2 — Globe view**
- [ ] **Phase 3 — Screens and game flow** (first playable version, 0.1.0)
- [ ] **Phase 4 — Deploy to geo-quizz.mrpia.ch** (needs the owner for login and DNS)

### Phase 0 — Foundation (done)

Repo, MIT license, CI, the data pipeline (`tools/build-data.mjs` →
`src/data/world.json`), the typed loader (`src/domain/world.ts`,
`src/data/loadWorld.ts`), data tests, and a placeholder `App`.

### Phase 1 — Domain, settings, i18n (done)

As built, where it differs from the text below:

- `sanitizeSettings(value, browserLanguages)` takes the browser's languages
  as an argument so `src/domain/` never reads `navigator`; the store passes
  `navigator.languages`. The match compares the primary language subtag
  (`de-CH` is German, `den` is not).
- `startGame` takes the continent's ids and the time limit along with the
  questions: the first so a pick elsewhere is ignored, the second so a
  timeout records the full time as `elapsedMs`.
- The off-view islands are `BEYOND_HORIZON` in `view.ts`: ATF and HMD in
  Africa, PCN in Oceania. The views are first estimates, not yet seen on a
  screen.
- The vertical field of view (50°) was read from the published globe.gl
  2.46.2 dependency sources, not from an installed package; Phase 2 checks it.
- `translate`, `countryName` and `useI18n` throw where math-quizz falls back
  (unknown key, placeholder without a value, no provider).

Pure TypeScript, all of it testable in Vitest. Write each test first.

1. **Settings** — `src/domain/settings.ts`:
   `{ language, secondsPerQuestion, countriesPerRound }`, defaults `10` and
   `10`, bounds 3–60 s and 1–50 countries. `sanitizeSettings(unknown)` returns
   valid settings for any input (a bad or missing field falls back to its
   default; numbers are clamped and rounded). Default language: the first of
   `navigator.languages` that starts with `fr`, `de` or `en`, else `en`.
   `src/storage/settingsStore.ts` reads and writes localStorage key
   `geoquizz:settings` through `sanitizeSettings`.
2. **Round draw** — `src/domain/round.ts`: `drawRound(countries, count,
   random)` draws without replacement, clamped to the countries available,
   with an injectable `random` so tests are deterministic.
3. **Game reducer** — `src/domain/game.ts`, a pure `(state, event) => state`:
   - state: question ids, current index, phase `asking | feedback | finished`,
     and one answer per asked question `{ targetId, pickedId | null, correct,
     elapsedMs }`;
   - events: `pick(id, elapsedMs)`, `timeout`, `next`;
   - rules: one attempt per question; a pick of a country outside the round's
     continent is ignored (the player missed the continent, not the answer);
     picks and timeouts outside `asking` are ignored; `next` after the last
     question moves to `finished`; score = number of correct answers.
   The screen owns the clock and dispatches `timeout`; the reducer never reads
   time itself.
4. **Camera views** — `src/domain/view.ts`: one hand-set `{ lat, lng, altitude }`
   per continent (globe.gl's `pointOfView` units: altitude in globe radii
   above the surface). A test checks that every country of the continent has
   its anchor on the visible hemisphere at that view (angular distance from the
   view centre below `acos(1 / (1 + altitude))`), except for an explicit
   per-continent list of remote islands. The test also fails if a listed
   island *is* visible, so the list cannot rot.
5. **Tap ring rule** — also `view.ts`: `needsTapRing(areaKm2, altitude,
   viewportHeightPx)` estimates the country's on-screen diameter at the view
   centre and returns true below 24 px. The globe.gl camera's vertical field of
   view is needed for the estimate. Read it from the installed library in
   Phase 2 and pin it here with a test.
6. **i18n** — copy math-quizz's `src/i18n/` pattern (`I18nContext.tsx`,
   `translate` with `{var}` placeholders, `TranslationKey` derived from `fr`,
   a test that all three dictionaries have the same keys). Add the keys the
   Phase 3 screens need, the six continent names, and
   `countryName(country, lang)`.

Done when: everything above has tests; `pnpm test` and `pnpm build` are green.

### Phase 2 — Globe view

1. `pnpm add globe.gl` (2.46.x; it brings `three`). Load it with a dynamic
   `import()` inside the component, so the home screen does not wait for
   three.js. **Then check `GLOBE_VFOV_DEG` in `src/domain/view.ts`**: Phase 1
   pinned it at 50 from the published sources, before the package was
   installed. Assert it against the real globe's `camera().fov`, in the e2e
   spec (item 9) since jsdom has no WebGL.
2. `src/components/GlobeView.tsx` wraps the imperative API: create in an
   effect, call `_destructor()` in its cleanup (StrictMode mounts twice).
   Props: the world, the continent, highlight state (picked id, correct id,
   their colours), `onPick(id)`, and a token that resets the camera.
3. Look: no image textures (offline and no external fetch). Ocean colour via
   `globeMaterial()`, atmosphere on. The continent's countries get caps
   coloured from a 7-colour palette indexed by `properties.color`
   (MAPCOLOR7); all other land is grey. Dark borders. Low base
   `polygonAltitude`, raised for hover and highlight.
4. Interaction: OrbitControls (`controls()`) rotate and zoom with pinch and
   wheel; set min and max distance so a player can zoom close enough to separate
   Sint Maarten from Saint-Martin. **Check that a drag never counts as a tap**
   on touch and on mouse. If globe.gl's click fires after a drag, add a
   movement threshold.
5. Picks: `onPolygonClick` for countries of the continent; other land and the
   ocean do nothing.
6. Tap rings: `htmlElementsData` with one ring element (44 px circle, no name)
   per country for which `needsTapRing` is true at the current altitude.
   Recompute in `onZoom`. Use `htmlElementVisibilityModifier` to hide rings
   on the far side. Rings get `pointer-events: none`. On every click
   (`onPolygonClick` and `onGlobeClick`), the nearest visible ring within
   26 px of the pointer wins over the polygon underneath, so dragging still
   works when it starts on a ring.
7. Test hook: `window.__geoQuizz.screenPoint(id)` returns page coordinates of
   the country's `anchor` (`getScreenCoords` plus the canvas offset), so e2e
   specs click the real canvas through the real raycaster.
8. A "recentre" button returns to the continent view.
9. Playwright setup copied from math-quizz (`vite preview` on 4173, Chromium,
   `data-testid` selectors). Headless WebGL needs a software renderer. Find
   the launch flags that work in CI and locally (likely
   `--enable-unsafe-swiftshader`) and record them in `playwright.config.ts`.
   One spec: the globe renders and `screenPoint` returns a point on the canvas
   for a country.
10. Ask the owner to try it on the tablet: 99,613 vertices at 1:50m should be
    fine on WebGL, but this is where it would show. Look at each continent's
    starting view (`CONTINENT_VIEWS`) at the same time: they were set for a
    landscape globe area of about 1180 × 700 px and never seen. If one
    moves, `src/__tests__/view.test.ts` says which countries to add to or
    drop from `BEYOND_HORIZON`.

Done when: the globe shows each continent at its view, taps pick the right
country (also tiny ones via rings), drag and pinch never pick, and the spec
passes.

### Phase 3 — Screens and game flow

Follow math-quizz's `App.tsx` screen state machine and screen layout (header
with a 🏠 back button, then panels).

- **Home**: six large continent buttons, a summary line ("10 countries · 10 s
  each"), Start, ⚙️ Settings, language toggle.
- **Game**: header with "3 / 10", the country name in large type, a countdown
  bar (`requestAnimationFrame` + `performance.now()`, like math-quizz's
  `Timer`), the running score and a ✕ that returns home. The globe fills the
  rest of the screen.
  - correct: the country turns green, next question after 1 s;
  - wrong: the tapped country turns red, the target green, the header says
    which country was tapped; if the target is off-screen the camera flies to
    it; next after 2.5 s;
  - timeout: the target turns green (fly-to as above); next after 2.5 s;
  - the countdown pauses during feedback. The camera does not reset between
    questions, so a player who zoomed in stays zoomed.
- **Results**: "7 / 10", one row per question (✓/✗, target, what was tapped or
  "time's up", seconds taken), Play again (same continent), Home.
- **Settings**: seconds per question, countries per round, language.
- Vitest: screens with `GlobeView` replaced by `vi.mock` with a list of
  buttons, fake timers for the countdown.
- e2e: play a 3-country round tapping via `screenPoint`; a round with a 3 s
  timer that runs out. Add the e2e job to CI (copy math-quizz's `ci.yml`).
- Bump to 0.1.0: `package.json`, `CHANGELOG.md`.

Done when: a full round can be played with touch and with a mouse, and both
suites pass in CI.

### Phase 4 — Deploy to geo-quizz.mrpia.ch

Same setup as math-quizz (see its
`docs/superpowers/specs/2026-06-13-firebase-hosting-design.md`).

1. Owner step: `firebase login` (interactive; run it in a normal terminal).
2. A second Hosting **site** in the existing project `modern-ally-102412`
   (`firebase hosting:sites:create <site-id>`; site ids are global, so
   `geo-quizz` may be taken. The custom domain does not depend on the id).
3. `firebase.json` with that site, the SPA rewrite, `Cache-Control: public,
   max-age=31536000, immutable` on `/assets/**` (includes the hashed
   `world-*.json`), `no-cache` on `/` and `/index.html`. `.firebaserc`.
   `pnpm ship` = build + `firebase deploy --only hosting`.
4. `src/config/site.ts` with `SITE_URL` and `SOURCE_URL`, an About panel with
   the version, source link and "Made with Natural Earth".
5. Owner step: Firebase console → Hosting → the site → Add custom domain
   `geo-quizz.mrpia.ch`, then add the DNS record it shows at the `mrpia.ch`
   registrar. The certificate is provisioned automatically after DNS
   propagates.
6. Check the live site on the tablet; check the response headers with
   `curl -I` (`vite preview` does not apply `firebase.json`).

Done when: https://geo-quizz.mrpia.ch serves the app over HTTPS.

## Later (not planned yet)

Offline/PWA like math-quizz, a two-player mode, high scores per continent, a
"sovereign states only" filter (the data already carries `kind`), sounds.
