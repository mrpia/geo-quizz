# Map data

The app ships one data file, `src/data/world.json`, a TopoJSON topology with
242 country shapes. `tools/build-data.mjs` generates it (`pnpm data`), and the
generated file is committed, so CI and a fresh checkout never need the network.

## Source

[Natural Earth](https://www.naturalearthdata.com/) **Admin 0 – Countries,
1:50m**, release **v5.1.2**, taken from the project's GitHub repository:

    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson

The build pins the file's SHA-256 and refuses any other content.

**License: public domain.** From the
[terms of use](https://www.naturalearthdata.com/about/terms-of-use/): "All
versions of Natural Earth raster + vector map data found on this website are in
the public domain. […] No permission is needed to use Natural Earth. Crediting
the authors is unnecessary." The app credits it anyway ("Made with Natural
Earth"), as the same page suggests.

**Borders are de facto.** The
[50m countries page](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/)
says: "Natural Earth shows de facto boundaries by default according to who
controls the territory, versus de jure." That is why Kosovo, Northern Cyprus,
Somaliland, Western Sahara and Taiwan have shapes of their own.

## Why 1:50m

| Scale | Features | Raw GeoJSON | What it lacks |
|---|---|---|---|
| 1:110m | 177 | 0.8 MB | 29 sovereign states, among them Andorra, Liechtenstein, Malta, Monaco, Singapore, Bahrain and most Caribbean and Pacific island states |
| **1:50m** | **242** | 3.1 MB | Only slivers: Gibraltar, Baikonur, Akrotiri and Dhekelia, a few uninhabited reefs |
| 1:10m | 258 | 13.3 MB | nothing, at four times the size |

All 193 UN member states are in the 1:50m file. After conversion to TopoJSON
(quantization 1e5) it is 761 KiB, about 243 KB gzipped.

## What the quiz asks

Every feature of the chosen continent. That includes dependencies and disputed
areas (Greenland, Puerto Rico, Hong Kong, Jersey, Western Sahara, Kosovo,
Siachen Glacier …), as decided on 2026-11-21. Antarctica is drawn on the globe
but is not a playable continent.

Per continent: Africa 60, Asia 54, Europe 50, North America 38, Oceania 25,
South America 14.

## Corrections the build applies

Each correction in `tools/build-data.mjs` states the upstream value it
expects. If Natural Earth changes that value, or a correction matches nothing,
the build fails instead of shipping a stale fix.

**Continents.** Natural Earth's `CONTINENT` field is used as is: Russia is in
Europe; Turkey, Cyprus, Georgia, Armenia, Azerbaijan and Kazakhstan are in
Asia; Central America and the Caribbean are in North America. Eight features
are filed under "Seven seas (open ocean)" and get the continent their own
`REGION_UN` field names: Maldives → Asia; Mauritius, Seychelles, Saint Helena,
British Indian Ocean Territory, French Southern and Antarctic Lands, Heard
Island and McDonald Islands → Africa; South Georgia (REGION_UN "Americas") →
South America.

**Names.** `NAME_EN`, `NAME_DE` and `NAME_FR`, with the first letter
capitalised (upstream writes "île de Man", "îles Féroé"). Overrides:

| Id | Lang | Upstream | Shipped | Why |
|---|---|---|---|---|
| CHN | en/de/fr | People's Republic of China / Volksrepublik China / République populaire de Chine | China / China / Chine | formal state name |
| TWN | de | Republik China | Taiwan | EN and FR already say Taiwan |
| CYP | de | Republik Zypern | Zypern | formal state name |
| CYN | en/de | Turkish Republic of Northern Cyprus / Türkische Republik Nordzypern | Northern Cyprus / Nordzypern | formal name |
| PCN | fr | Iles Pitcairn | Îles Pitcairn | missing accent |
| SXM | fr | Saint-Martin | Sint Maarten | same name as MAF; the question would be unanswerable |

The build also fails if two features share a name in any language.

**Anchors.** Each feature carries an `anchor` point on its own land. It is
where a tap ring is centred and where the end-to-end tests click. It is
Natural Earth's label point when that lies inside the shape. For ten features
it does not (Vatican, South Georgia, BIOT, Trinidad and Tobago, São Tomé and
Príncipe, Saint Vincent, New Zealand, Equatorial Guinea, Macau, Antigua and
Barbuda; New Zealand's is in the Tasman Sea), and the build uses the pole of
inaccessibility of the largest polygon instead
([polylabel](https://github.com/mapbox/polylabel)).

## Known limitations

- **France includes its overseas regions.** In Admin 0 – Countries, French
  Guiana, Guadeloupe, Martinique, Réunion and Mayotte are part of the France
  shape, which is in Europe. In a South America round, French Guiana is
  therefore France. Natural Earth's "map units" file splits them out; switching
  would change the feature set and is not planned.
- **Remote islands sit far from their continent.** Heard Island and the French
  Southern Lands are asked in Africa, Pitcairn in Oceania, South Georgia in
  South America. Some are off-screen at the continent's starting view; the
  player rotates to reach them.

## Output format

`src/data/world.json` is a TopoJSON topology with one object, `countries`.
Each geometry has `id` (Natural Earth's `ADM0_A3`, because `ISO_A3` is `-99`
for France, Norway and six disputed or minor features) and these properties:

| Property | Meaning |
|---|---|
| `continent` | `europe`, `africa`, `asia`, `north-america`, `south-america`, `oceania` or `antarctica` |
| `kind` | Natural Earth `TYPE`: Sovereign country, Country, Dependency, Disputed, Indeterminate, … |
| `color` | Natural Earth `MAPCOLOR7` (1–7), assigned upstream so that neighbours differ |
| `areaKm2` | spherical area of the shape, rounded |
| `anchor` | `[lng, lat]` on the feature's land |
| `names` | `{ en, de, fr }` |

`src/domain/world.ts` decodes it; `src/__tests__/world.test.ts` holds the
committed file to the build's rules and pins the decisions above.
