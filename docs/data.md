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
  player rotates to reach them. Those behind the horizon (Heard Island, the
  French Southern Lands and Pitcairn) are listed in `BEYOND_HORIZON` in
  `src/domain/view.ts`, and a test keeps that list in step with the views.

## Ocean zones

The oceans (docs/plan.md, Phase 7) are not in `world.json`. Each is one or
more discs near its middle, built in code by `src/domain/oceans.ts`; no
border is drawn in the water. Natural Earth's marine polygons were measured
and set aside on 2026-11-23: smaller seas are cut out of larger ones, and
its Southern Ocean polygon is broken under d3-geo (the plan has the
numbers).

A disc covers 20% (`ZONE_SHARE`) of the area of the ocean it stands for, or
of its half, from Eakins, B.W. and G.F. Sharman, *Volumes of the World's
Oceans from ETOPO1*, NOAA National Geophysical Data Center, 2010
([PDF](https://www.ncei.noaa.gov/sites/default/files/2023-01/World%20Ocean%20Volumes.pdf)).
NOAA bounds the oceans by IHO Special Publication 23 (1953) and counts the
Southern Ocean as all water south of 60°S. The app uses five of its areas
and nothing else from it.

| Ocean | Discs | NOAA area (km²) |
|---|---|---|
| Pacific | North, South | 77,010,000 + 84,750,000 |
| Atlantic | North, South | 41,490,000 + 40,270,000 (without the Mediterranean and the Baltic) |
| Indian | one | 70,560,000 |
| Southern | three, around Antarctica | 21,960,000 |
| Arctic | one, on the North Pole | 15,558,000 |

The centres were placed by hand. `src/__tests__/oceans.test.ts` holds them
to the land of the committed `world.json`: every centre in water, no two
discs closer than 5°, and land on less than a tenth of each disc. The
discs' rings are wound like the countries', so d3-geo finds their inside;
the same file checks that at the Pole and across the antimeridian.

The names are in the dictionaries (`ocean.*` in `src/i18n/`), taken from
Natural Earth's marine layer with the first letter capitalised.

## Sea zones

The 24 seas (docs/plan.md, Phase 8) are discs too, built in code by
`src/domain/seas.ts`, and only drawn in an oceans round with the "Seas"
switch on. Unlike the oceans' centres, theirs are not placed by hand: they
come from Natural Earth's **1:50m Marine Areas** (`geography_marine_polys`),
release **v5.1.2**, public domain like the countries:

    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_geography_marine_polys.geojson

`tools/sea-zones.mjs` (`pnpm data:seas`) downloads it into `.cache/`, pins
its SHA-256, and prints each sea's centre and room; the numbers are copied
into `SEAS`. The file is not shipped and the app never reads it.

**Which seas.** Natural Earth's scalerank 1 seas, gulfs and bays (the ones
it labels on a world map), plus the North Sea and the Baltic, which it ranks
second. The Caspian Sea, a lake, is among them, as atlases print it. Left
out: the Sargasso Sea, which has no coast and lies under the North
Atlantic's disc, and the Scotia Sea, the Drake Passage and the Luzon
Strait, whose polygons have no area under d3-geo.

**Where the disc goes.** At the point of the sea farthest from its edges,
which are its coasts and its limits with the neighbouring seas as Natural
Earth draws them. The search runs in an azimuthal equidistant projection
centred on the sea (so a sea near the Pole is not stretched east to west),
and the distance is then measured again on the sphere. The disc's radius is
four fifths of that distance (`SEA_ZONE_SHARE`), from 0.9° for the Baltic to
7.3° for the Philippine Sea.

Natural Earth cuts smaller seas out of larger ones, so some seas are joined
with their pieces first, and the limits the pieces share drop out:

| Sea | Joined with |
|---|---|
| Mediterranean Sea | Tyrrhenian, Ionian, Adriatic and Balearic seas, Gulf of Lion |
| Baltic Sea | Gulf of Bothnia, Gulf of Finland |
| Gulf of Mexico | Bay of Campeche |
| Hudson Bay | James Bay |

The Aegean cannot be joined: its polygon shares no vertex with the
Mediterranean's or the Ionian's. The disc lies far from it either way. The
script fails if a listed piece shares no limit, so a join cannot silently
stop working. The Ross Sea is cut in two at the antimeridian; the cut is
not an edge of the sea, and the script ignores it.

`src/__tests__/seas.test.ts` holds the discs to the land of the committed
`world.json` (every centre in water, land on less than a twentieth of each
disc; the sampled share is 0 for all 24) and keeps each disc at least 5°
from every other disc, the oceans' included. The closest pair is the North
Sea and the Baltic, 5.7° apart.

**Names.** In the dictionaries (`sea.*` in `src/i18n/`), first letter
capitalised. They are Natural Earth's `name_en`, `name_fr` and `name_de`,
compared on 2026-11-23 with the [Wikidata](https://www.wikidata.org/) label
and the English, French and German Wikipedia title of each sea (Natural
Earth gives its `wikidataid`). They agree for all but two:

| Sea | Lang | Natural Earth | Wikidata | Wikipedia | Shipped |
|---|---|---|---|---|---|
| Baffin Bay (Q37040) | fr | mer de Baffin | baie de Baffin | Baie de Baffin | Baie de Baffin |
| Weddell Sea (Q173343) | de | Weddell-Meer | Weddell-Meer | Weddellmeer | Weddellmeer |

German Wikipedia's titles for Hudson Bay and Baffin Bay are "Hudson Bay"
and "Baffin Bay", the same as Natural Earth's, and ship as they are. Names
that some countries dispute, the Sea of Japan and the Persian Gulf among
them, follow Natural Earth and Wikidata.

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

Rings are wound the way [d3-geo](https://d3js.org/d3-geo) expects (exterior
rings clockwise), and enclaves such as Lesotho, Vatican City and San Marino
are holes in the country around them. The tap picker (`src/domain/pick.ts`)
relies on both when it asks d3-geo which country contains a point. The build
does not enforce the winding; a test does.

`src/domain/world.ts` decodes it; `src/__tests__/world.test.ts` holds the
committed file to the build's rules, pins the decisions above, and checks the
winding.
