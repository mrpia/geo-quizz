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

[Unreleased]: https://github.com/mrpia/geo-quizz/commits/main
