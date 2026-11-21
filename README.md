# Geo Quizz

A geography quiz for touch-screen tablets that works just as well with a mouse.
Pick a continent and it turns up on a 3D globe with every border drawn and no
names. The game names a country; you have 10 seconds to tap it. Ten countries
make a round, and you see your score at the end. Both numbers can be changed
in the settings.

French, German and English. Everything runs in the browser: no account, no
server, nothing sent anywhere.

**Status:** under construction. See [docs/plan.md](docs/plan.md) for the
phases and what is done. It will be live at https://geo-quizz.mrpia.ch.

## Development

Needs Node 22 or 24 and pnpm (the version is pinned in `package.json`).

```sh
pnpm install
pnpm dev        # local dev server
pnpm test       # Vitest, once
pnpm build      # typecheck, then production build in dist/
pnpm data       # regenerate src/data/world.json from Natural Earth
```

`pnpm data` is only needed when the map data itself changes. The generated
file is committed.

## Map data

Country shapes and names come from [Natural Earth](https://www.naturalearthdata.com/)
(1:50m Admin 0 – Countries, v5.1.2), which is in the public domain. Natural
Earth draws de facto borders. [docs/data.md](docs/data.md) explains which
places the quiz asks for, which continent each belongs to, and every name the
build corrects.

Made with Natural Earth.

## License

[MIT](LICENSE). The map data is public domain.
