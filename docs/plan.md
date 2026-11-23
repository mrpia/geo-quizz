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
- [x] **Phase 4 — Deploy to geo-quizz.mrpia.ch** (0.2.0)
- [x] **Phase 5 — Two switches on Home: time limit, no tiny countries** (0.3.0)
- [x] **Phase 6 — Explore mode** (0.4.0, 0.4.1)
- [ ] **Phase 7 — Oceans**

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
  rises any more (and after the merge, hover neither; see below), and
  `MIN_ALTITUDE` is unchanged.
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
- **Changed after the merge**, by the owner on 2026-11-21:
  - nothing rises any more, hover included: one altitude for every country,
    no walls, no transition;
  - the continent's countries are seven soft pinks (still keyed by
    MAPCOLOR7, every pair at least 14 apart in CIE76 ΔE and 40 from the red
    of a wrong pick), other land stays grey;
  - the country under the mouse turns amber and gets the answer's white
    outline and glow;
  - the answer gets a ✅ at its anchor and a wrong pick a ❌, over green and
    red. The marks are SVG in the outline layer, not globe.gl's HTML layer:
    that one shows an element a few frames after it is given, which under
    SwiftShader outlasted a 1 s right answer. A white halo keeps the ❌
    readable on red and the ✅ on green. The outline layer now sits right
    after globe.gl's canvas, so the rings stay on top of it;
  - the header and the results rows use ✅ and ❌ too, in place of ✓ and ✗;
  - e2e specs read each question's feedback from a record the page keeps
    on every frame (`watchFeedback` in `e2e/fixtures.ts`): on a loaded
    machine, a few Playwright assertions in a row missed the 1 s a right
    answer stays up.

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

### Phase 4 — Deploy to geo-quizz.mrpia.ch (done)

As built, where it differs from the text below:

- **Site id `geo-quizz-mrpia`.** Firebase refused `geo-quizz` on
  2026-11-21: "`geo-quizz` is reserved by another project". The project
  `modern-ally-102412` now has four sites: its default one (math-quizz),
  `arena-maze`, `arena-race` and `geo-quizz-mrpia`. The CNAME already at the
  registrar, `geo-quizz.mrpia.ch → geo-quizz.web.app.`, named the other
  project's site. The owner pointed it at `geo-quizz-mrpia.web.app.`, as
  `math-quizz` and `arena-maze` point at their sites, and added the custom
  domain to `geo-quizz-mrpia` in the console.
- **No SPA rewrite** (owner's decision, 2026-11-21). The app has no routes,
  and its build uses relative asset paths (`base: './'`). On math-quizz, which
  has the same pair, `/a/b` serves index.html whose `./assets/` script
  resolves to `/a/assets/…`, which the rewrite answers with index.html as
  `text/html`, so the page stays blank; and a missing `/assets/x.js` gets a
  200 with index.html and the one-year immutable header. Without the
  rewrite, an unknown path gets Firebase's 404.
- **About screen**: an ℹ️ button next to ⚙️ on Home opens it, as in
  math-quizz (owner's choice). Beyond the version, the source link and "Made
  with Natural Earth", the owner asked for math-quizz's other panels: the
  credit line to mrpia.ch, the coffee link addressed to the parents, "your
  data", and what's new per version. "Your data" says what geo-quizz really
  does: it keeps the settings in localStorage and does not save answers or
  scores. `src/__tests__/privacy.test.ts` holds the code to that (storage
  only in `settingsStore.ts`, `fetch` only in `loadWorld.ts`). It scans
  `src/` only, not the libraries.
- **What's new** comes from `src/domain/releaseNotes.ts`, written to a child
  in each language. `src/__tests__/releaseNotes.test.ts` holds its first
  entry to `package.json`'s version and to a `CHANGELOG.md` section; CLAUDE.md
  describes the release step.
- `src/config/site.ts` also has `AUTHOR_URL`, `AUTHOR_LABEL` and
  `SUPPORT_URL`, for the extra panels. Nothing in the app reads `SITE_URL`
  yet; `siteConfig.test.ts` uses its host, like the others, to fail on a
  hard-coded copy under `src/`.
- **0.2.0** ships with this phase (owner's decision): the About screen, plus
  the map-wait fix and the restyle that were unreleased on `main`.
- Bundle: the first chunk is 263 KB (83 KB gzip), from 254 KB (80 KB) on
  `main`, for the strings and release notes in three languages.
- **Live checks, 2026-11-21**, with `curl -I` on geo-quizz-mrpia.web.app:
  `/` and `/index.html` are `no-cache`; the files under `/assets/` are
  `public, max-age=31536000, immutable`, the map data included (779 KB, 211
  KB over the wire with brotli); `/nope` and `/a/b` are 404s. A missing
  `/assets/` file is a 404 that also carries the immutable header, because
  Firebase applies headers by path; a hashed name that 404s belongs to a
  removed build and is never asked for again. In Chromium on the live site,
  the globe was ready 8.1 s after Start (software WebGL), and no request
  left the origin.
- **https://geo-quizz.mrpia.ch** served the app about five minutes after the
  owner added the domain, at first from only some of Firebase's servers (the
  others still sent the `*.firebaseapp.com` certificate), and from all of
  them a few minutes later. The certificate names `geo-quizz.mrpia.ch`, from
  Google Trust Services, and Firebase renews it. The same `curl -I` checks
  on the domain give the same headers; `http://` redirects to `https://`
  with a 301. The deployed build is the tree of `fd9b1fa`, tagged `v0.2.0`.
- **Not done in this phase**: the tablet check in item 6. It needs the
  owner's tablet, and stays open until they report.

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

### Phase 5 — Two switches on Home: time limit, no tiny countries (done)

As built, where it differs from the text below or from the brief:

- **Named for what it leaves out.** The brief's working name was "only the
  largest territories". The switch reads "Without the tiny countries" (FR
  "Sans les tout petits pays", DE "Ohne die ganz kleinen Länder") and the
  setting is `skipTiny`: it keeps 40 of Europe's 50 places, so it drops the
  tiny ones rather than keeping the largest. It says "countries" for every
  place, as the rest of the game does. The other switch reads "Time limit"
  (FR "Limite de temps", DE "Zeitlimit"). Both labels were a proposal; they
  shipped as they are in 0.3.0.
- With the limit off, the summary reads "10 countries · no time limit"
  (FR "sans limite de temps", DE "ohne Zeitlimit").
- The e2e spec plays its round with the time limit off too, and checks that
  no countdown is drawn. It cannot click on Malta's land: at the Europe view
  Malta is under a pixel across. What it shows is that the ring which takes
  such a click without the switch (the bullseye spec) is gone.
- Bundle: the first chunk is 264 KB (84 KB gzip), from 263 KB (83 KB) on
  `main`.
- **0.3.0** ships with this phase (owner's decision, 2026-11-22).
- **Changed after the merge**, by the owner on 2026-11-22, and released
  as **0.5.0** (owner's decision), after Explore's 0.4.0 and 0.4.1:
  - **Each switch that is on makes the game harder.** The second switch
    reads "Tiny countries" (FR "Tout petits pays", DE "Ganz kleine
    Länder"), a noun like "Time limit", and on means the tiny places are
    asked. Rejected: "With the tiny countries", and "territories" in place
    of "countries". The stored setting is still `skipTiny`, with the same
    meaning; Home shows it the other way round, so choices saved by 0.3.0
    to 0.4.1 read as they were without a migration. Explore (Phase 6) reads
    the same setting, so the switch applies there too.
  - **A new player starts with the time limit on and the tiny countries
    off** (`DEFAULT_SKIP_TINY` is now true). Rejected: both on, the game as
    it was, and both off. Settings saved by 0.2.0 have no `skipTiny`, so
    they read as the new default too, and those players lose the tiny
    places until they switch them back on.
  - **A wrong answer or a timeout stays up 4 s, from 2.5 s** (Phase 3),
    with or without the time limit: finding the answer on the globe takes
    as long either way. The owner first asked for it in timed rounds only.
    A right answer still moves on after 1 s.
  - The e2e fixtures seed `skipTiny: false` unless a spec says otherwise,
    since several specs click on Malta, Vatican City or Heard Island.

The first part of BACKLOG's "Easy mode", asked for by the owner on
2026-11-22 as two independent switches rather than one "easy mode".

Decided with the owner on 2026-11-22:

- **Time limit, on or off.** On is the game as it was. Off means no
  countdown bar and no timeout: a question waits until the player taps. The
  seconds-per-country setting stays and applies whenever the limit is on.
- **Leave out the tiny places, on or off.** On, a round asks only the
  continent's places of at least **1,000 km²** (`areaKm2`, the spherical
  area of the shape; see `docs/data.md`). Rejected: "sovereign states
  only", which keeps Vatican, Monaco, San Marino, Liechtenstein, Malta and
  Andorra; "needs a tap ring at the start view", which changes with the
  screen size; and 5,000 km², as too strict.
- **A place left out looks and acts like land outside the continent**:
  grey, no tap ring, and a tap on it does nothing (it is not a wrong
  answer). Rejected: keeping it pink and ringed, with a tap counting as
  wrong. The point is fewer rings.
- Both are settings, saved like the continent and read back through
  `sanitizeSettings`.

What the cut-off leaves, measured on 2026-11-22: Europe 50 → 40, Africa
60 → 55, Asia 54 → 49, North America 38 → 18, South America 14 → 14,
Oceania 25 → 9. Europe loses Vatican, Monaco, Guernsey, San Marino, Jersey,
Liechtenstein, Malta, Andorra, the Isle of Man and Åland; the Faroe Islands
(1,036 km²) stay. Small sovereign states go too: the Seychelles and São
Tomé and Príncipe (986 km²) in Africa; Singapore, Bahrain and the Maldives
in Asia; seven Caribbean states, Barbados and Grenada among them; and seven
in Oceania, Kiribati (938 km²) and Tonga among them. Siachen Glacier
(2,118 km²) stays. Oceania keeps fewer places than a default round
of 10, so the round is shortened as South America's already is. Rings at
the start views, estimated for a 700 px tall globe with the rule in
`src/domain/view.ts`: Europe 16 → 6, North America 30 → 10, Oceania
22 → 6.

1. Settings `timeLimitOn` (default on) and `skipTiny` (default off). A
   stored value from 0.2.0, which has neither, reads as the defaults, so
   nobody's game changes on update. Anything but a boolean reads as the
   default.
2. One pure function decides a round's places: `quizPool(world, continent,
   { skipTiny })` in `src/domain/world.ts`, with the cut-off as a named
   constant. Every user of the pool calls it: the draw (`GameScreen`), the
   colours, rings, hover and picking (`GlobeView`), Home's count (`App`),
   and the scripted draw of the e2e fixtures. `world.test.ts` pins the
   counts above and the places dropped from Europe.
3. A round without a time limit: `GameState.timeLimitMs` is `null`; the
   game screen shows no countdown; a `timeout` event throws, since nothing
   can send one. The results rows keep the seconds taken; "time's up" can no
   longer occur.
4. Home: two switches between the continent panel and the summary line
   (`role="switch"`, the whole row is the target, as tall as the Start
   button). With the limit off, the summary says "no time limit" in place
   of the seconds.
5. Strings in all three languages, the About screen's "your data" panel
   included, since it lists what the settings hold.
6. e2e, only for what needs the real globe: a Europe round without the
   tiny places draws no ring on them, and a click on one picks nothing.
   Colours, rings and picks are also covered in Vitest with the fake globe.
7. `CHANGELOG.md`; BACKLOG's "Easy mode" trimmed to what is still unbuilt.

Done when: both switches survive a reload, a round with each of them on and
off plays to the results, and both suites pass in CI.

### Phase 6 — Explore mode (done)

As built, where it differs from the text below or fills in what it left
open:

- **The name shows in the header**, in the game's large type, under a prompt
  that stays: "Tap a country to see its name" (FR "Touche un pays pour voir
  son nom", DE "Tippe auf ein Land, um seinen Namen zu sehen"). Unlike the
  game's question, a long name wraps instead of being cut short with "…":
  on this screen the name is the point. The longest, "Territoires
  extérieurs australiens de l'Océan Indien" (54 characters), measured
  1,012 px in headless Chromium on Linux, in the 1,028 px the header
  leaves it at 1180 px: one line, barely, and two with a wider font. When a
  name wraps, the header grows by a line and the globe resizes. At 390 px,
  "Bosnien und Herzegowina" takes two lines, and so does the German prompt.
- **A tap on the sea or on grey land keeps the name** and its outline.
  `GlobeView` calls nothing for those taps, a near miss should not wipe
  what the child is reading, and the outline still shows which place the
  name belongs to. A tap on the place already named changes nothing.
- **The mouse hover stays**: amber and outlined, as in a round, and it never
  shows a name. A place has one outline, never two.
- **The selected place is green** (`SELECTED_COLOR`, the answer's green)
  and outlined, and stays green under the mouse, as the answer does in a
  round. On both screens, green marks the place named in the header. This
  is 0.4.1, the owner's call of 2026-11-22: in 0.4.0 the selected place
  kept its pink with only the outline and turned amber under the mouse, so
  the amber, outlined place under the mouse looked more chosen than the one
  named. The outline stays, so the colour is not the only cue.
- The button reads "Explore" (FR "Explorer", DE "Entdecken"), with 🧭, in
  the secondary style (white, bordered), so Start stays the main action.
  At 1180×820 Home still fits without scrolling: Explore ends at 714 px,
  under Start at 638.
- Before the map is drawn the header is blank and taps are ignored. Each
  visit starts with no name.
- e2e: `seedSettings` in `e2e/fixtures.ts` writes the settings only, for a
  spec with no draw; `seedRound` now uses it. `openExplore` goes from Home
  to a drawn globe.
- Bundle: the first chunk is 268 KB (85 KB gzip), from 264 KB (84 KB) on
  `main`.
- **0.4.0** ships with this phase, and **0.4.1** turns the selected place
  green.

BACKLOG's "Explore mode", asked for by the owner on 2026-11-22: the globe
with no question, no countdown and no score, where a tap on a place shows its
name. For learning a continent before being tested on it.

Decided with the owner on 2026-11-22:

- **No question, no countdown, no score.** The time limit and the round size
  don't apply.
- **A tap or a click shows the name; a hover doesn't.**
- **The places are a round's**: `quizPool(world, continent, { skipTiny })`,
  so the continent chosen on Home and the "Without the tiny countries"
  switch both apply. Pink places and their rings answer a tap; grey land and
  the sea do nothing. Rejected: any land on the globe, which would need tap
  rings for tiny places all over the world, something the game never draws.
- **In the app's language only.** Rejected: the name in all three languages
  at once (BACKLOG's question).
- **An "Explore" button on Home, under Start**, opens the globe on the
  chosen continent; a 🏠 goes back. Rejected: a third switch that changes
  what Start does, as too easy to miss.

Left to the build and recorded under As built: how the name shows, what a
tap on the sea does, and whether the mouse hover stays.

1. `GlobeView` gets a selected place (`selectedId`): outlined in white like
   the answer, but with no ✅, no colour of its own and no camera flight.
   The game's highlight is unchanged. Tested with the fake globe in
   `GlobeView.test.tsx`.
2. `ExploreScreen`: the globe on the chosen continent, under a header with
   🏠, a prompt, and the name of the place last tapped in large type. Taps
   before the map is drawn are ignored, as in a round. Tested with
   `GlobeView` mocked.
3. Home: an "Explore" button under Start. `App` gets an `explore` screen,
   which waits for the map as the game does.
4. Strings in FR (tu), DE (du, Swiss spelling) and EN: the button and the
   prompt.
5. e2e, for real clicks: on Europe, a click on France shows its name and
   its outline and no mark, a click on Poland replaces it, a click on the
   sea keeps it, and 🏠 goes home.
6. Release 0.4.0: `package.json`, `CHANGELOG.md`, the player's note in
   `releaseNotes.ts`. BACKLOG's "Explore mode" goes: flags stay under "Show
   the country's flag", and the three languages at once were rejected.

Done when: Explore opens from Home on the chosen continent with the switch
honoured, a tap names the place in the app's language, nothing is timed or
scored, 🏠 goes back, and both suites pass in CI.

### Phase 7 — Oceans

The owner's idea of 2026-11-23: learn the oceans, and later the seas,
without drawing borders in the water. Each ocean is one or more faint discs
near its middle, sized by the ocean's area, the way a globe prints an
ocean's name in big letters across it. The child taps the disc.

Why not borders, from Natural Earth's marine polygons (1:50m, v5.1.2,
measured on 2026-11-23 with d3-geo): smaller seas are cut out of larger
ones, so the Mediterranean polygon lacks the Adriatic, Ionian, Tyrrhenian,
Aegean and Balearic seas, and a tap in the open North Atlantic at 30°N 60°W
lands in the Sargasso Sea. The Southern Ocean polygon is broken: d3 gives it
1.4 million km², it contains about 12 million km² of test points, and
5.3 million of those are also inside the Indian Ocean. Sea limits are
conventions in any case, and a child would read drawn ones as facts.

Decided with the owner on 2026-11-23:

- **Zones, not borders.** An ocean is one or more discs; nothing else in
  the water is drawn.
- **The discs are visible**, faint, before the tap. A tap on a disc answers;
  a tap in open water outside every disc, or on land, does nothing, as a tap
  outside the continent does today. Rejected: hidden zones, which would mark
  a right answer far from an ocean's middle as a miss.
- **Five oceans**: Pacific, Atlantic, Indian, Southern and Arctic.
- **An "Oceans" tile next to the six continents** on Home, played on the
  whole globe. The "Tiny countries" switch is hidden while it is chosen.
  Rejected: a Countries / Oceans choice above the continent picker.
- **Oceans first.** The seas come later, as a switch that makes the game
  harder (BACKLOG, "Seas").

Proposed here, to be checked on the tablet:

- **Sizes.** A disc covers 20% of the area of its ocean, or of its half of
  the ocean, from NOAA's table: Eakins, B.W. and G.F. Sharman, *Volumes of
  the World's Oceans from ETOPO1*, NOAA National Geophysical Data Center,
  2010 ([PDF](https://www.ncei.noaa.gov/sites/default/files/2023-01/World%20Ocean%20Volumes.pdf)).
  It counts the Southern Ocean as everything south of 60°S. The radii run
  from 6.1° (each of the Southern Ocean's three discs) to 21.0° (the South
  Pacific).
- **Several discs where a globe prints the name more than once.** The
  Atlantic and the Pacific each get a north and a south disc, NOAA's own
  halves, each sized by its half: one disc at the Atlantic's middle would sit
  where it is narrowest, between Brazil and West Africa. The Southern Ocean
  gets three equal discs around Antarctica; as a ring, its middle is the
  South Pole, on land. The Arctic's disc is centred on the North Pole.

  | Ocean | Part | NOAA area (km²) | Centre (lng, lat) | Radius |
  |---|---|---|---|---|
  | Pacific | North | 77,010,000 | −160, 28 | 20.0° |
  | Pacific | South | 84,750,000 | −125, −28 | 21.0° |
  | Atlantic | North | 41,490,000 | −40, 32 | 14.7° |
  | Atlantic | South | 40,270,000 | −17, −24 | 14.4° |
  | Indian | | 70,560,000 | 80, −20 | 19.1° |
  | Southern | 3 × ⅓ | 21,960,000 | 25, −61 · 135, −60 · −110, −63 | 6.1° |
  | Arctic | | 15,558,000 | 0, 90 | 9.0° |

  Checked against `world.json`: every centre is in water, the closest two
  discs (South Pacific, Southern off West Antarctica) are 9.2° apart, and
  land covers at most 0.1% of a disc, except the Arctic's 5.9% (the tips of
  Greenland, Ellesmere Island and Svalbard).
- **Look.** Light blue and translucent, with a lighter edge, drawn just
  below the land so that coasts and islands cover them. All land is grey,
  as land outside the continent is in a round. Hover, answer and wrong pick
  as for countries: amber, green, red.
- **Names** from Natural Earth's marine layer, first letter capitalised as
  for the countries: Pacific Ocean, Océan Pacifique, Pazifischer Ozean, and
  so on. They go in the dictionaries (`ocean.*`), since they are not in the
  data file. The owner may want the school book's names instead
  (Nordpolarmeer rather than Arktischer Ozean, for instance).
- **Strings.** The tile: "Oceans", "Océans", "Ozeane". The panel title
  "Pick a continent" no longer fits the last tile: "Where do you want to
  play?", "Où veux-tu jouer ?", "Wo möchtest du spielen?". The question
  "Find this ocean:", Explore's "Tap an ocean to see its name", and the
  summary "5 oceans · 10 s each".
- **A round asks each ocean once**: five questions, since `drawRound` caps
  a round at its pool. The last can be answered by elimination; accepted
  for a first level, the seas switch adds the challenge.
- **The answer's ✅, and the camera's flight to an answer out of frame, use
  the first disc**: the North Pacific and North Atlantic, and the Southern
  Ocean's disc south of Africa.

1. `src/domain/oceans.ts`: the table above, and the discs as GeoJSON, by
   its own spherical formula so that d3-geo stays out of the first bundle.
   Each ocean becomes a place like a country (`continent: 'oceans'`, kind
   "Ocean", `areaKm2` the discs' area, `anchor` the first centre).
   Tests, with d3-geo: each disc has its target area and contains its
   centre; every centre is in water; no two discs touch; land covers less
   than 10% of each disc.
2. `src/domain/world.ts`: Home's choice becomes `Area`, a continent or
   `'oceans'`. `World` gets `oceans`, and `byId` holds them, so every screen
   finds an ocean's name the way it finds a country's. `quizPool(world,
   'oceans')` is the five oceans; the tiny-countries setting does not apply.
3. Settings accept `'oceans'`, stored in `continent`: the field keeps its
   name, as `skipTiny` did in Phase 5.
4. `GlobeView`: in an oceans round it adds the discs under the land, greys
   all land, picks only discs (land under the finger wins), and starts from
   a whole-globe view, which the recentre button returns to. Rounds on a
   continent are unchanged.
5. Screens: the tile, the hidden switch, the summary, the question and
   Explore's prompt, in FR (tu), DE (du, Swiss spelling) and EN.
6. e2e, for real clicks: in an oceans round a click on a disc answers and a
   click on land does nothing; in Explore a click on a disc names its ocean.
7. `docs/data.md` gets an "Ocean zones" section; BACKLOG gets "Seas";
   `CHANGELOG.md`. Whether this ships as 0.6.0 is the owner's call.

Done when: an oceans round plays from Home to the results, Explore names
the oceans, continent rounds look and play as before, and both suites pass
in CI.

## Later (not planned yet)

Ideas beyond Phase 7 live in [BACKLOG.md](../BACKLOG.md). An idea moves from
there into a phase here once the owner decides to build it.
