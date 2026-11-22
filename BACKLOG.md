# Backlog

Ideas that are wanted but not planned yet. Nothing here gets built until it
moves into a phase of [docs/plan.md](docs/plan.md). The notes under each idea
are questions to settle at that point, unless they are marked as agreed.

## Game modes

### Multiplayer, 2 to 4 players on one device

Players take turns on the same tablet or computer. Each turn asks that player
their own country, so everyone stays gathered around the screen.

Agreed with the owner on 2026-11-21:

- A "your turn, Lena" screen before each question, with a tap to start, so the
  countdown never runs while the next player is still getting into position.
- The camera resets to the continent view at every turn. In single player it
  stays where the player left it; here the next player would inherit someone
  else's zoom.
- Countries are drawn without repetition across all players, so nobody is
  asked a country that was just revealed on someone else's turn. Every player
  gets the same number of questions.

Still open:

- Player names (and probably a colour each), a score per player, a ranking on
  the results screen, and a rule for ties.
- The Phase 1 game reducer handles one player. Extending it with a "current
  player" is the expected route; no need to build for it earlier.

### Full-world mode

All 241 places (everything but Antarctica) on the whole globe, as a seventh
choice next to the continents.

- No "outside the continent" rule: every land tap is an answer.
- The player rotates far more; decide whether each question starts from a
  neutral view or from wherever the camera is.
- Tap rings appear all over the world at that zoom level.

### Easy mode

Fewer, easier places. Two switches on Home cover the first part since
Phase 5: the time limit can be turned off, and the places under 1,000 km²
can be left out (docs/plan.md, Phase 5). Still open:

- A longer default timer, for when the time limit is on.
- Leaving out what is not a sovereign state (`kind` is Natural Earth's
  TYPE). Rejected on 2026-11-22 as the rule for the tiny places, since it
  keeps Vatican City, Monaco, San Marino, Liechtenstein, Malta and Andorra,
  but it could still be a filter of its own. With the area switch on,
  Siachen Glacier (2,118 km², "Indeterminate") is still asked; the Ashmore
  and Cartier Islands and Heard Island are not.

### Explore mode

No timer and no score: tap any country to see its name, and its flag once
flags exist. For learning a continent before being tested on it.

- Reuses the globe and the data; a tap shows a label instead of judging an
  answer.
- Show the name in the UI language only, or in all three? Useful in a
  bilingual family or class.

### Pick the name

The globe highlights a country and the player picks its name from four
choices. Easier for children who read slowly or don't know the shapes yet.

- The wrong choices should be plausible: neighbours, or at least countries of
  the same continent.

### Capitals

"Where is Bern?": find the country a capital belongs to (or the city itself).

- Natural Earth's populated-places layer marks national capitals: 202 places
  with `featurecla` "Admin-0 capital" at 1:50m, Bern correctly flagged for
  Switzerland (checked 2026-11-21). 13 more are marked "Admin-0 capital alt";
  decide how a country with more than one capital is asked.
- The simple 1:50m places file has English and local names only. French and
  German names need another field or source.
- Tap the country, or tap a point for the city? The second needs city markers
  on the globe.

### Swiss cantons

A map of Switzerland with its 26 cantons, for a Swiss school.

- More a second game than a mode: a close-up map instead of the globe, and
  new data.
- Sources to evaluate, licence first: Natural Earth's 1:10m admin-1 layer and
  swisstopo's open data.
- Canton names in FR, DE and EN; several cantons have official names in more
  than one language.

## Scoring and progress

### High-score page

Local to the device (localStorage), like everything else, with a name on each
entry once several children share the tablet, and a way to clear the table.

Scores only compare under the same rules: 10/10 with 30 seconds is not 10/10
with 5. One of these has to be chosen:

- one table per continent, timer and round size;
- record only rounds played at the default settings;
- score by speed (see **Speed points**), which still needs one table per
  continent and round size.

### Speed points

Score by the time left instead of one point per correct answer, for example
up to 100 per question.

- An option, not the default: speed pressure can put off younger children.
- Makes high scores fairer between quick and slow correct answers.

### Practise the misses

- First step: a "replay the ones I missed" button on the results screen, a
  round made of exactly the countries missed.
- Later: rounds that favour countries missed recently, like math-quizz's
  recency-weighted draw (`src/domain/stats.ts` there; weights decay per
  session, never by clock time). Needs an answer history in localStorage.
- With multiplayer, the history belongs to a player, so player names would
  have to persist.

### Hint

Halfway through the countdown, the camera turns toward the target's region; a
correct answer after the hint earns half a point (with speed points, the hint
costs points instead).

## Presentation

### Show the country's flag on a correct pick

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
- Also on the results screen, in explore mode, and when the answer is
  revealed after a miss?

### Sounds

A sound for a correct answer, a miss and the timeout. Carried over from the
plan's "later" list.

## Platform

### Offline use (PWA)

Install to the home screen and play without a connection, like math-quizz.
Carried over from the plan's "later" list.
