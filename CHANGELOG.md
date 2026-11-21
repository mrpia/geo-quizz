# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project scaffold (React, TypeScript, Vite, Vitest, pnpm), MIT license, CI.
- Map data pipeline: `pnpm data` builds `src/data/world.json` (242 features,
  761 KiB TopoJSON) from Natural Earth 1:50m Admin 0 – Countries v5.1.2, with
  continent assignment for open-ocean islands, kid-friendly name corrections,
  and an on-land anchor point per country. See `docs/data.md`.
- Build plan in `docs/plan.md`.
- Settings (language, seconds per question 3–60, countries per round 1–50),
  sanitized on every read and write, stored under `geoquizz:settings`. The
  default language is the browser's first of French, German or English,
  else English.
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
  Countries too small to hit at the current zoom get a 44 px ring, and a tap
  within 26 px of a ring picks that country.
- A preview page for the globe: pick a continent, tap countries, see the name.
- End-to-end tests in a real browser (Playwright, Chromium with software
  WebGL), also in CI.

[Unreleased]: https://github.com/mrpia/geo-quizz/commits/main
