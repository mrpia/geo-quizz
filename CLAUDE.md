# geo-quizz

A client-side React + TypeScript geography quiz on a 3D globe (globe.gl),
aimed at touch tablets, trilingual FR/DE/EN. Sibling project of
`mrpia/math-quizz` (`~/rni/math-quizz`), whose conventions it follows unless
this file says otherwise.

**Start here:** `docs/plan.md` lists the phases, the decisions already taken
with the owner, and what each phase must deliver. Do the next unticked phase,
on a branch, as one PR, and tick it off in that PR. `docs/data.md` covers the
map data.

## Commands

- `pnpm dev`, `pnpm test`, `pnpm build` (typecheck + build)
- `pnpm data`: regenerate `src/data/world.json` from the pinned Natural Earth
  download (cached in `.cache/`, checked by SHA-256)

## Git and GitHub

The repo belongs to the personal account `mrpia`, and commits use the
repo-local identity `pa.galiana@gmail.com`. Check `git config user.email`
before the first commit in a new clone; the global config carries a work
address. Push with `gh auth switch --user mrpia` active, and push before
switching back.

## The data file is generated, and the generator fails loudly

`tools/build-data.mjs` is the only writer of `src/data/world.json`. Never edit
the JSON by hand. Every correction in the script (continent rules, name
overrides) names the upstream value it expects, and the script throws when
that value changes or a rule matches nothing. Keep it that way when adding
one: a correction that silently stops applying is the bug this guards
against. `src/__tests__/world.test.ts` re-checks the committed file and pins
the decisions from `docs/data.md`; a new decision gets a test there.

The app loads the file with `import url from './world.json?url'` and `fetch`,
and tests read it with `?raw`. Don't import it as a JSON module: `tsc` would
infer a type for 761 KiB of coordinates, and the bundle would inline it.

## Conventions

- TDD: failing test first, then the code. Vitest globals + Testing Library.
- Domain logic stays pure and in `src/domain/` (no React, no globe.gl), so it
  is testable in jsdom. The globe is the one thing jsdom cannot run; screen
  tests replace `GlobeView` with a mock.
- If a test can be written in Vitest, it stays in Vitest. Playwright (`e2e/`)
  is for what needs a real browser: WebGL, real taps on the canvas, layout.
  E2E specs select by `data-testid`, never by visible text, because the
  language is a setting.
- Every user-facing string goes through `src/i18n/` in all three languages.
  Country names come from the data file, not from the dictionaries.
- Fail loudly. A missing name, an unknown continent or a damaged data file
  should throw, not render an empty label.
