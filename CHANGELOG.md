# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.5.0] - 2026-11-22

### Changed

- The second switch on Home reads **Tiny countries** and is on when they
  are asked, so each switch that is on makes the game harder, in a round as
  in Explore. A choice saved by 0.3.0 to 0.4.1 stays as it was and shows
  the other way round.
- A new player starts with the time limit on and the tiny countries off.
  Settings saved by 0.2.0, which have no such choice, read the same way.
- After a wrong answer or a timeout, the answer stays on screen for 4 s
  instead of 2.5 s, with or without the time limit. A right answer still
  moves on after 1 s.

## [0.4.1] - 2026-11-22

### Changed

- Explore: the place named in the header is now green, the answer's green
  in a round, as well as outlined, and it stays green under the mouse. In
  0.4.0 it kept its pink with only the outline and turned amber under the
  mouse, so the amber, outlined place under the mouse looked more chosen
  than the one named.

## [0.4.0] - 2026-11-22

### Added

- Explore mode, opened with the Explore button under Start on Home: the
  globe of the continent chosen, with no question, no countdown and no
  score. A tap or a click on one of the continent's places shows its name in
  the header, in the app's language, and outlines it in white. The next tap
  replaces it; a tap on the sea or on land outside the continent changes
  nothing. The switch for the tiny countries applies, as in a round, and 🏠
  goes back home.
- `GlobeView` takes a `selectedId`, outlined like the answer but with no ✅,
  no colour of its own and no camera flight.

## [0.3.0] - 2026-11-22

### Added

- Two switches on Home. **Time limit**: off, a round has no countdown and
  each country waits for a tap; the seconds per country apply again when it
  goes back on. **Without the tiny countries**: on, a round leaves out the
  places under 1,000 km², such as Vatican City, Monaco, Malta and most small
  islands. They turn grey like land outside the continent, get no tap ring,
  and a tap on them does nothing. Europe keeps 40 of its 50 places and
  Oceania 9 of 25, so a round of 10 there has 9 countries.
- Both switches are saved with the other settings. Settings saved by 0.2.0
  read as before: time limit on, every place asked.

### Changed

- With the time limit off, the summary on Home says "no time limit" in place
  of the seconds.
- The About screen's "your data" lists the two switches among the settings
  this browser keeps.

## [0.2.0] - 2026-11-21

The first version online, at https://geo-quizz.mrpia.ch.

### Added

- An About screen, opened with ℹ️ on Home: the version, a credit line to
  mrpia.ch, a "buy me a coffee" link addressed to the parents, what the app
  keeps (the settings, in this browser) and what it does not (answers,
  scores, anything sent over the network), "Made with Natural Earth", a link
  to the source code, and what's new in each version. A test holds the
  "your data" promise to the code: storage only in the settings store, the
  network only to download the map.
- `src/config/site.ts` holds every URL that ties the build to this
  deployment and its author; a test fails if another file under `src/`
  hard-codes one.
- Firebase Hosting: `firebase.json` (site `geo-quizz-mrpia` in project
  `modern-ally-102412`), `.firebaserc`, and `pnpm ship` to build and deploy.
  Hashed files under `/assets/`, the map data included, are cached for a
  year; `/` and `/index.html` are revalidated on every load. There is no
  SPA rewrite: the app has no routes, so an unknown path gets a 404.

### Changed

- The continent's countries are shades of pink, other land stays grey.
- No country rises any more, not even under the mouse. The country under the
  mouse turns amber instead, with a thick white outline and a glow.
- A right answer gets a ✅ in the middle of the country; a wrong tap gets a ❌
  on the country tapped and a ✅ on the answer, over the red and green.
- The game's header and the results rows mark answers with ✅ and ❌ as well,
  in place of ✓ and ✗.

### Fixed

- The first country of a round was named while the map was still loading.
  It now appears, and its countdown starts, only once every country is drawn
  on the globe.

## [0.1.0] - 2026-11-21

The first playable version: one player picks a continent and finds its
countries on the globe against the clock.

### Added

- Project scaffold (React, TypeScript, Vite, Vitest, pnpm), MIT license, CI.
- Map data pipeline: `pnpm data` builds `src/data/world.json` (242 features,
  761 KiB TopoJSON) from Natural Earth 1:50m Admin 0 – Countries v5.1.2, with
  continent assignment for open-ocean islands, kid-friendly name corrections,
  and an on-land anchor point per country. See `docs/data.md`.
- Build plan in `docs/plan.md`.
- Settings (language, seconds per question 3–60, countries per round 1–50,
  and the continent last chosen), sanitized on every read and write, stored
  under `geoquizz:settings`. The default language is the browser's first of
  French, German or English, else English; the default continent is Europe.
- `drawRound`: draws a round's countries without replacement.
- The game reducer: one attempt per question, a tap outside the continent
  is ignored, a timeout counts as wrong, score = correct answers.
- A camera view per continent, with a test that every country is in sight
  at the start except Heard Island and the French Southern Lands (Africa)
  and Pitcairn (Oceania).
- The tap-ring rule: a country estimated under 24 px across at the current
  zoom gets a ring.
- French, German and English UI strings, continent names, and country names
  from the data file.
- The 3D globe (globe.gl, loaded only when it is first shown): the chosen
  continent's countries in seven colours, other land grey, borders, ocean and
  atmosphere, no image textures. Turn it by dragging, zoom with pinch or wheel
  from the whole globe down to telling Sint Maarten from Saint-Martin, and
  fly back to the continent with the recentre button.
- Taps: a tap picks the continent's country under the finger or pointer. A
  drag or a pinch never picks, and neither does the sea or other land.
  Countries too small to hit at the current zoom get a 44 px ring. Over the
  sea or other land a tap within 26 px of a ring picks that country; over a
  country big enough to tap, only the ring's central 10 px do, so a ring over
  Rome no longer takes a third of Italy.
- Home: six continent buttons (the last one chosen is remembered), a summary
  of the round ("10 countries · 10 s each", fewer when the continent has
  fewer), Start, settings and the language.
- The game: the country to find in large type, a countdown bar, the question
  number and the score. A right tap turns the country green and moves on
  after 1 s. A wrong tap turns it red, the answer green, and the header names
  the country tapped; a timeout shows the answer the same way. Both move on
  after 2.5 s, and the camera flies to the answer when it is off-screen. The
  answer also gets a thick white outline and the header a ✓ or ✗, so green
  and red are never the only cue. The countdown starts once the globe is
  drawn and pauses while an answer is shown; the camera stays where the
  player put it between questions.
- Results: the score and one row per question (✓ or ✗, the country, what was
  tapped or "time's up", the seconds taken), Play again and Home.
- Settings screen: seconds per question, countries per round, language.
- End-to-end tests in a real browser (Playwright, Chromium with software
  WebGL), also in CI: the globe, taps and rings, a 3-country round played with
  a mouse and with a finger, and a round whose timer runs out.

[Unreleased]: https://github.com/mrpia/geo-quizz/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/mrpia/geo-quizz/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/mrpia/geo-quizz/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/mrpia/geo-quizz/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mrpia/geo-quizz/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mrpia/geo-quizz/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mrpia/geo-quizz/releases/tag/v0.1.0
