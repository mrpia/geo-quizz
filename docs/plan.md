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
- [x] **Phase 2 — Globe view**
- [x] **Phase 3 — Screens and game flow** (first playable version, 0.1.0)
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

### Phase 2 — Globe view (done)

As built, where it differs from the text below:

- **Taps don't go through `onPolygonClick` or `onGlobeClick`** (items 4–6).
  globe.gl reports the object under the pointer's last hover raycast, which
  three-render-objects runs at most every 50 ms (`pointerRaycasterThrottleMs`).
  Measured on 2026-11-21 with frames at 28 ms: 15 of 24 instant mouse clicks
  and 14 of 24 instant taps went to the country touched just before. The e2e
  suite cannot see this, because SwiftShader frames take 300 ms or more.
  Instead GlobeView tracks the gesture itself (`src/domain/gesture.ts`: one
  pointer that stays within 10 px of where it went down, measured from that
  point; a second pointer or a cancel spoils it) and resolves the tap at that
  moment (`src/domain/pick.ts`): the nearest visible ring within 26 px, else
  `toGlobeCoords` plus a point-in-polygon test with d3-geo over the
  continent's countries. Other land and the sea pick nothing, as planned.
- **Polygon side walls only under raised countries.** Walls under all 1,620
  shapes made a SwiftShader frame seven times slower (2,280 ms against
  319 ms); at the base altitude nobody sees them.
- **Zoom limits** (item 4): altitude 0.02 to 4 in globe radii. Measured in
  Chromium at 0.03: Sint Maarten and Saint-Martin are about 60 px across each
  and no longer ringed. Every raised altitude stays below 0.02 (base 0.005,
  hover and wrong pick 0.01, right answer 0.015), so a camera zoomed right
  in never ends up inside a raised country.
- **`screenPoint` returns viewport coordinates**, what `page.mouse.click`
  takes, and null for a country behind the globe. The hook also has
  `camera()`, which the spec uses to check `GLOBE_VFOV_DEG` (it is 50).
- **Launch flags** (item 9): Playwright 1.65.1 already passes
  `--enable-unsafe-swiftshader`; the config repeats it. The e2e job runs in
  CI from this phase on (the owner's call on 2026-11-21), moved from Phase 3.
- **Tablet check** (item 10): moved to Phase 4 by the owner on 2026-11-21.
  Desktop screenshots at a 1180 × 702 globe area show each continent's
  mainland at its view, so `CONTINENT_VIEWS` is unchanged.
- **App is a Phase 2 preview**: continent buttons, the globe, the name of the
  last pick (shown raised, in green). `e2e/globe.spec.ts` drives it through
  `continent-*` and `picked`.
- Bundle: globe.gl, three.js and d3-geo load on demand, 2.0 MB minified
  (556 KB gzip); the first chunk is 239 KB (76 KB gzip).
- **Settled in Phase 3:** the ring rule let a tap within 26 px of a ring
  beat a large country underneath. At the Europe view that handed 34.5% of
  Italy's land to Vatican City or San Marino (area-weighted, measured on
  2026-11-21); Gambia's ring sits on Senegal, Luxembourg's on Belgium. The
  owner chose a 10 px bullseye on 2026-11-21 (Phase 3, "As built").

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

### Phase 3 — Screens and game flow (done)

As built, where it differs from the text below:

- **Rings over large countries** (owner's decision, 2026-11-21, the open
  question from Phase 2): over a country that has no ring of its own, a
  ring wins only within 10 px of its centre (`RING_BULLSEYE_PX`); over the
  sea, other land or a ringed country it keeps its 26 px reach. The ring is
  still drawn 44 px wide, so a tap inside its edge over Italy picks Italy.
- **The answer is outlined, not raised** (owner's decision, 2026-11-21).
  Screenshots at the Europe view showed the planned raise of 0.015 radii
  cannot be seen near the view centre: from straight above, a raised
  country hides its own walls (Poland looked flat; Spain and Norway, near
  the rim, showed a thin dark edge). The fly-to puts the answer at the
  centre, so the raise would rarely read. The answer now gets a thick white
  outline with a faint glow, an SVG path over the canvas redrawn after every
  render (`scene.onAfterRender`), projected with the camera's matrix rather
  than `getScreenCoords` because Canada has 11,573 vertices
  (`src/domain/outline.ts`). three-globe's wide lines (`pathStroke`) were
  tried first: their translucent glow piles up where the border's vertices
  crowd, and parts of the line broke up. Neither the answer nor the pick
  rises any more; hover still does, so `ALTITUDE` is down to base and hover
  and `MIN_ALTITUDE` is unchanged.
- **Fly-to**: when the answer's anchor is behind the horizon or within 48 px
  of the canvas edge (`FRAME_MARGIN_PX`), the camera flies over the anchor
  in 800 ms at the altitude it has. GlobeView does it whenever
  `highlight.correctId` is set, so a right answer tapped at the very edge
  also moves the camera a little.
- **The first question waits for the map** (`GlobeView`'s new `onReady`):
  the first country is shown, and its countdown starts, only once the map is
  drawn; taps before then are ignored. globe.gl's `onGlobeReady` only means
  the sphere is up, and the 1,620 country shapes are built in a later update,
  so GlobeView counts the built shapes in the scene and reports ready one
  frame after all of them are there (`src/components/globeShapes.ts`, which
  leans on three-globe 2.45.6 internals). Until that was fixed, after the
  merge on 2026-11-21, the first country's name showed 140 to 350 ms after
  Start, over "Loading the map…", while the map took 3.7 to 9.3 s under
  SwiftShader. Each round mounts a new globe (`GameScreen` is keyed per
  round), so Play again waits for it too.
- **The continent is a setting**: Home saves the continent chosen
  (`Settings.continent`, default Europe; the owner's choice of 2026-11-21),
  and Play again uses it. The summary counts the countries the continent
  really has: 50 asked of South America reads "14 countries".
- **Results** show the seconds taken on every row, one decimal in the
  language's notation (`formatSeconds`); a timeout shows the full time next
  to "time's up". A wrong row strikes through the country tapped.
- **e2e**: a round's countries are fixed by scripting the draw's calls to
  `Math.random`, armed only when the spec presses Start (`e2e/fixtures.ts`):
  React DOM calls `Math.random` twice while it loads, and a constant
  `Math.random` would give every three.js object the same UUID. The verdict
  carries `data-picked`, so specs read what a tap picked without reading
  text. `e2e/globe.spec.ts` keeps the Phase 2 checks and runs them through a
  round. The timeout spec records the verdict, the outline and the camera
  from inside the page on every frame: on a loaded machine, polling from
  the test missed the 2.5 s the answer stays up.
- Bundle: the first chunk is 252 KB (79 KB gzip), from 239 KB (76 KB).

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
  - never colour alone: green and red are the pair colour-blind players most
    often confuse. The header also shows ✓ or ✗, the results rows use ✓/✗,
    and on the globe the target is raised (higher `polygonAltitude`), not
    only recoloured;
  - the countdown pauses during feedback. The camera does not reset between
    questions, so a player who zoomed in stays zoomed.
- **Results**: "7 / 10", one row per question (✓/✗, target, what was tapped or
  "time's up", seconds taken), Play again (same continent), Home.
- **Settings**: seconds per question, countries per round, language.
- Vitest: screens with `GlobeView` replaced by `vi.mock` with a list of
  buttons, fake timers for the countdown.
- e2e: play a 3-country round tapping via `screenPoint`; a round with a 3 s
  timer that runs out. The CI job exists since Phase 2. `e2e/globe.spec.ts`
  drives the Phase 2 preview page, so it changes with the screens.
- The right answer rises by 0.015 globe radii (`ALTITUDE` in
  `src/components/globeLook.ts`), which is subtle at the continent views.
  Check that it reads; raising it means raising GlobeView's closest zoom too.
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
   `curl -I` (`vite preview` does not apply `firebase.json`). The tablet check
   carries Phase 2's item 10, moved here on 2026-11-21:
   - frame rate with all 1,620 shapes and their borders (about 1,620 draw
     calls for caps plus as many for borders);
   - each continent's starting view; if one moves,
     `src/__tests__/view.test.ts` names the countries to add to or drop from
     `BEYOND_HORIZON`;
   - taps, drags and pinches: the 10 px tap slop (`TAP_SLOP_PX`), and
     whether pinch-zooming drifts (globe.gl zooms towards the pointer but
     keeps the camera aimed at the centre);
   - tiny countries: rings, and zooming in far enough to tap them;
   - added in Phase 3: whether the 10 px bullseye is easy to hit with a
     finger (a ring shows no centre mark), how long Play again waits for a
     new globe, and the frame rate while the outline of a large answer
     (Canada, Russia) is redrawn on every frame.

Done when: https://geo-quizz.mrpia.ch serves the app over HTTPS.

## Later (not planned yet)

Ideas beyond Phase 4 live in [BACKLOG.md](../BACKLOG.md). An idea moves from
there into a phase here once the owner decides to build it.
