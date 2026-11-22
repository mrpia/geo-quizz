# Geo Quizz

A geography quiz for touch-screen tablets that works just as well with a mouse.
Pick a continent and it turns up on a 3D globe with every border drawn and no
names. The game names a country; you have 10 seconds to tap it. Ten countries
make a round, and you see your score at the end. Both numbers can be changed
in the settings. To learn a continent first, Explore shows the same globe
with no question: tap a country and its name appears.

French, German and English. Everything runs in the browser: no account, no
server, nothing sent anywhere.

**Status:** online at https://geo-quizz.mrpia.ch since 0.2.0. See
[docs/plan.md](docs/plan.md) for the phases and what is done.

## Development

Needs Node 22 or 24 and pnpm (the version is pinned in `package.json`).

```sh
pnpm install
pnpm dev        # local dev server
pnpm test       # Vitest, once
pnpm test:e2e   # Playwright: builds, serves on :4173, drives Chromium
pnpm build      # typecheck, then production build in dist/
pnpm data       # regenerate src/data/world.json from Natural Earth
```

`pnpm data` is only needed when the map data itself changes. The generated
file is committed.

`pnpm test:e2e` needs Playwright's Chromium once: `pnpm exec playwright
install chromium`. The globe is WebGL, which headless Chromium draws in
software, so the suite is slow on purpose and stays small.

## Deploy

The app is a static bundle on **Firebase Hosting**: site `geo-quizz-mrpia`
in project `modern-ally-102412` (the same project as math-quizz, which uses
the project's default site), served at https://geo-quizz.mrpia.ch with a
Google-managed certificate. Deploying needs `firebase-tools` installed and
logged in:

```sh
pnpm ship       # = pnpm build && firebase deploy --only hosting
```

`firebase.json` caches the content-hashed files under `/assets/` (the map
data included) for a year and makes the browser revalidate `/` and
`/index.html` on every load. It has no SPA rewrite: the app has no routes,
so an unknown path gets a 404. `vite preview` does not apply `firebase.json`;
check the headers on the live site with `curl -I`.

The DNS record for `geo-quizz.mrpia.ch` lives at the `mrpia.ch` registrar
and is the one the Firebase console shows under Hosting → the site → custom
domains.

### Deploying a fork

Three files carry the identity of this deployment:

| File | What to change |
|---|---|
| [`src/config/site.ts`](src/config/site.ts) | the site, author, source and support URLs |
| `.firebaserc` | your Firebase project id |
| `firebase.json` | `hosting.site`, your Hosting site id (or delete the line to use the project's default site) |

`pnpm test` fails if a file under `src/` hard-codes one of the URLs in
`site.ts`. Nothing checks the two Firebase files. Without Firebase, the
`dist/` folder can be served by any static host.

## Map data

Country shapes and names come from [Natural Earth](https://www.naturalearthdata.com/)
(1:50m Admin 0 – Countries, v5.1.2), which is in the public domain. Natural
Earth draws de facto borders. [docs/data.md](docs/data.md) explains which
places the quiz asks for, which continent each belongs to, and every name the
build corrects.

Made with Natural Earth.

## License

[MIT](LICENSE). The map data is public domain.
