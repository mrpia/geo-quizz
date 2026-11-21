# Backlog

Ideas that are wanted but not planned yet. Nothing here gets built until it
moves into a phase of [docs/plan.md](docs/plan.md). The notes under each idea
are questions to settle at that point, not decisions.

## Multiplayer, 2 to 4 players on one device

Players take turns on the same tablet or computer. Each turn asks that player
their own country, so everyone stays gathered around the screen.

- A "your turn, Lena" screen before each question, with a tap to start, so the
  countdown never runs while the next player is still getting into position.
- Reset the camera to the continent view at every turn. In single player the
  camera stays where the player left it; here the next player would inherit
  someone else's zoom.
- Draw without repetition across all players, so nobody is asked a country
  that was just revealed on someone else's turn. Same number of questions per
  player.
- Needs player names (and probably a colour each), a score per player, a
  ranking on the results screen, and a rule for ties.
- The Phase 1 game reducer handles one player. Extending it with a "current
  player" is the expected route; no need to build for it earlier.

## High-score page

- Scores only compare under the same rules: 10/10 with 30 seconds is not
  10/10 with 5. Either keep one table per continent, timer and round size, or
  record only rounds played at the default settings, or score by speed (see
  below, if that idea is taken).
- Local to the device (localStorage), like everything else. A name on each
  entry once several children share the tablet, and a way to clear the table.

## Full-world mode

All 241 places (everything but Antarctica) on the whole globe, as a seventh
choice next to the continents.

- No "outside the continent" rule: every land tap is an answer.
- The player rotates far more; decide whether each question starts from a
  neutral view or from wherever the camera is.
- Tap rings appear all over the world at that zoom level.

## Up-to-date geo-data

Checked on 2026-11-21: Natural Earth's latest release is still
[v5.1.2 of 2022-05-13](https://github.com/nvkelso/natural-earth-vector/releases),
and the repository's last commit is from 2022-06-02. Downloading the latest
Natural Earth gives exactly the file we ship. Being more current means a
different or additional source.

- At build time, not in the app. The build is where the name corrections and
  the checks in `tools/build-data.mjs` run; data downloaded by the app at
  runtime would skip all of them and break offline use.
- Sources to evaluate, licence first: geoBoundaries, OpenStreetMap-derived
  country boundaries (ODbL, with share-alike terms), or a newer Natural Earth
  release if one ever appears.
- Cheap first step: a scheduled CI job that opens an issue when Natural Earth
  publishes a release newer than the pinned one.

## Easy mode

Fewer, easier places.

- Leave out places below an area threshold (`areaKm2` is in the data) and/or
  everything that is not a sovereign state (`kind` is Natural Earth's TYPE).
  This is also where Siachen Glacier, the Ashmore and Cartier Islands or Heard
  Island would drop out of the quiz.
- An area threshold behaves the same on every device. "Needs a tap ring at the
  continent view" would match what the player sees, but changes with the
  screen size.
- Maybe a longer default timer too.
- Check per continent that enough places remain for a round.

## Show the country's flag on a correct pick

- Candidate source: [flag-icons](https://github.com/lipis/flag-icons), MIT,
  one SVG per ISO 3166-1 alpha-2 code. `world.json` doesn't carry that code
  yet; Natural Earth has `ISO_A2` and `ISO_A2_EH` (the second fills gaps such
  as France and Norway, whose `ISO_A3` is -99).
- Some places have no code and no flag (Somaliland, Northern Cyprus, Siachen
  Glacier, …). Decide whether they show nothing or a neutral placeholder.
- Load each flag only when it is shown, so ~250 SVGs don't weigh on the first
  load.
- Emoji flags would cost nothing, but Windows doesn't draw country-flag emoji
  and shows two letters instead, so they fail on a desktop PC.
- Also on the results screen, and when the answer is revealed after a miss?

## Offline use (PWA)

Install to the home screen and play without a connection, like math-quizz.
Carried over from the plan's "later" list.

## Sounds

A sound for a correct answer, a miss and the timeout. Carried over from the
plan's "later" list.
