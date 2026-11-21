#!/usr/bin/env node
/**
 * Builds `src/data/world.json`, the only map data the app ships.
 *
 * Source: Natural Earth 1:50m Admin 0 – Countries, release v5.1.2, which is in
 * the public domain (https://www.naturalearthdata.com/about/terms-of-use/).
 * See docs/data.md for why this file and this scale.
 *
 * Run with `pnpm data`. The download is cached in `.cache/` and checked
 * against a pinned SHA-256, so a rerun is offline and reproducible, and an
 * upstream change to the file cannot slip in unnoticed.
 *
 * Every correction below states the upstream value it expects. If Natural
 * Earth ever changes that value, or a correction stops matching anything, the
 * build throws instead of quietly shipping the old fix or no fix at all.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { topology } from 'topojson-server';
import { feature } from 'topojson-client';
import polylabel from 'polylabel';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/data/world.json');

const SOURCE = {
  url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson',
  sha256: '3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb',
  cache: join(ROOT, '.cache/ne_50m_admin_0_countries.v5.1.2.geojson'),
};

/**
 * 1e5 steps per axis, a grid of about 400 m at the equator. The smallest
 * feature, Vatican City, is about 1 km² in this file, so the grid is close to
 * its size: `checkQuantization` below holds every feature within 10% of its
 * unquantized area and keeps its anchor on land, and fails the build if a
 * coarser setting (or a new upstream shape) breaks either. 1e6 also passes but
 * adds 150 KiB for detail nobody sees at continent scale.
 */
const QUANTIZATION = 1e5;

const LANGUAGES = ['en', 'de', 'fr'];

/** Natural Earth's CONTINENT values, mapped to the ids the app uses. */
const CONTINENTS = {
  Africa: 'africa',
  Asia: 'asia',
  Europe: 'europe',
  'North America': 'north-america',
  'South America': 'south-america',
  Oceania: 'oceania',
  // Drawn on the globe, never offered as a quiz: it has no countries.
  Antarctica: 'antarctica',
};

/**
 * Natural Earth files these eight under CONTINENT "Seven seas (open ocean)".
 * Each goes to the continent its own REGION_UN field names; South Georgia's
 * REGION_UN is "Americas", and of the two American continents it lies off
 * South America. Heard Island landing in Africa is Natural Earth's REGION_UN,
 * kept as is rather than second-guessed here.
 */
const SEVEN_SEAS = {
  MDV: { regionUn: 'Asia', continent: 'asia' },
  MUS: { regionUn: 'Africa', continent: 'africa' },
  SYC: { regionUn: 'Africa', continent: 'africa' },
  SHN: { regionUn: 'Africa', continent: 'africa' },
  IOT: { regionUn: 'Africa', continent: 'africa' },
  ATF: { regionUn: 'Africa', continent: 'africa' },
  HMD: { regionUn: 'Africa', continent: 'africa' },
  SGS: { regionUn: 'Americas', continent: 'south-america' },
};

/**
 * Names a child would not recognise or could not tell apart:
 * `[id, language, upstream value, replacement]`.
 */
const NAME_OVERRIDES = [
  // The formal state name, where every atlas and the other entries say "China".
  ['CHN', 'en', "People's Republic of China", 'China'],
  ['CHN', 'de', 'Volksrepublik China', 'China'],
  ['CHN', 'fr', 'République populaire de Chine', 'Chine'],
  // EN and FR say Taiwan; only DE carried the formal name.
  ['TWN', 'de', 'Republik China', 'Taiwan'],
  ['CYP', 'de', 'Republik Zypern', 'Zypern'],
  ['CYN', 'en', 'Turkish Republic of Northern Cyprus', 'Northern Cyprus'],
  ['CYN', 'de', 'Türkische Republik Nordzypern', 'Nordzypern'],
  ['PCN', 'fr', 'Iles Pitcairn', 'Îles Pitcairn'],
  // Upstream calls the Dutch half of the island "Saint-Martin" too, the same
  // as the French half (MAF), which would make the question unanswerable.
  ['SXM', 'fr', 'Saint-Martin', 'Sint Maarten'],
];

const EARTH_RADIUS_KM = 6371.0088;

const fail = (message) => {
  throw new Error(`build-data: ${message}`);
};

const loadSource = async () => {
  if (!existsSync(SOURCE.cache)) {
    console.log(`downloading ${SOURCE.url}`);
    const response = await fetch(SOURCE.url);
    if (!response.ok) fail(`download failed: HTTP ${response.status}`);
    await mkdir(dirname(SOURCE.cache), { recursive: true });
    await writeFile(SOURCE.cache, Buffer.from(await response.arrayBuffer()));
  }
  const bytes = await readFile(SOURCE.cache);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== SOURCE.sha256) {
    fail(`${SOURCE.cache} has SHA-256 ${sha256}, expected ${SOURCE.sha256}. Delete it to re-download, or update the pin after reviewing the upstream change.`);
  }
  return JSON.parse(bytes.toString('utf8'));
};

const polygonsOf = (geometry) => {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return fail(`unexpected geometry type ${geometry.type}`);
};

/** Area of a lon/lat ring on the sphere, in km², whatever its winding. */
const ringArea = (ring) => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [l1, p1] = ring[i];
    const [l2, p2] = ring[(i + 1) % ring.length];
    sum += ((l2 - l1) * Math.PI) / 180 * (2 + Math.sin((p1 * Math.PI) / 180) + Math.sin((p2 * Math.PI) / 180));
  }
  return Math.abs((sum * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2);
};

const polygonArea = ([outer, ...holes]) =>
  ringArea(outer) - holes.reduce((total, hole) => total + ringArea(hole), 0);

const geometryArea = (geometry) =>
  polygonsOf(geometry).reduce((total, polygon) => total + polygonArea(polygon), 0);

/**
 * Planar ray casting in lon/lat. Good enough here because Natural Earth splits
 * every polygon at the antimeridian, so no ring wraps around ±180°.
 */
const ringContains = (ring, [x, y]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const geometryContains = (geometry, point) =>
  polygonsOf(geometry).some(
    ([outer, ...holes]) => ringContains(outer, point) && !holes.some((hole) => ringContains(hole, point)),
  );

/**
 * A point guaranteed to be on the country's land: where a tap ring is centred
 * and where the end-to-end tests click. Natural Earth's curated label point
 * when it lies inside the shape; otherwise the pole of inaccessibility of the
 * largest polygon (for 10 features at this scale the label point is in the sea
 * between islands, e.g. New Zealand's in the Tasman Sea).
 */
const anchorOf = (id, props, geometry) => {
  const label = [props.LABEL_X, props.LABEL_Y];
  if (geometryContains(geometry, label)) return { point: label, fromLabel: true };
  const largest = polygonsOf(geometry).reduce((best, polygon) =>
    polygonArea(polygon) > polygonArea(best) ? polygon : best,
  );
  const point = polylabel(largest, 0.0005);
  if (!geometryContains(geometry, point)) fail(`${id}: no anchor point inside the shape`);
  return { point: [point[0], point[1]], fromLabel: false };
};

const capitalise = (name, lang) => name.charAt(0).toLocaleUpperCase(lang) + name.slice(1);

const round = (value, digits) => Number(value.toFixed(digits));

const buildFeatures = (source) => {
  const usedOverrides = new Set();
  const usedSevenSeas = new Set();
  const ids = new Set();
  const relocatedAnchors = [];

  const features = source.features.map((f) => {
    const p = f.properties;
    const id = p.ADM0_A3;
    if (!/^[A-Z]{3}$/.test(id)) fail(`bad ADM0_A3 ${JSON.stringify(id)} on ${p.NAME}`);
    if (ids.has(id)) fail(`duplicate id ${id}`);
    ids.add(id);

    let continent = CONTINENTS[p.CONTINENT];
    if (!continent) {
      const rule = SEVEN_SEAS[id];
      if (p.CONTINENT !== 'Seven seas (open ocean)' || !rule) {
        fail(`${id} (${p.NAME}) has CONTINENT ${JSON.stringify(p.CONTINENT)} and no rule for it`);
      }
      if (p.REGION_UN !== rule.regionUn) {
        fail(`${id}: expected REGION_UN ${rule.regionUn}, upstream now says ${p.REGION_UN}`);
      }
      continent = rule.continent;
      usedSevenSeas.add(id);
    }

    const names = {};
    for (const lang of LANGUAGES) {
      let name = p[`NAME_${lang.toUpperCase()}`];
      const override = NAME_OVERRIDES.find(([oid, olang]) => oid === id && olang === lang);
      if (override) {
        const [, , expected, replacement] = override;
        if (name !== expected) fail(`${id}.${lang}: override expects ${JSON.stringify(expected)}, upstream now says ${JSON.stringify(name)}`);
        name = replacement;
        usedOverrides.add(override);
      }
      if (typeof name !== 'string' || name.trim() === '') fail(`${id} has no ${lang} name`);
      names[lang] = capitalise(name.trim(), lang);
    }

    const color = p.MAPCOLOR7;
    if (!Number.isInteger(color) || color < 1 || color > 7) fail(`${id}: MAPCOLOR7 ${color} out of 1..7`);

    const area = geometryArea(f.geometry);
    if (!(area > 0)) fail(`${id}: zero area`);

    const anchor = anchorOf(id, p, f.geometry);
    if (!anchor.fromLabel) relocatedAnchors.push(id);

    return {
      type: 'Feature',
      id,
      properties: {
        continent,
        kind: p.TYPE,
        color,
        areaKm2: Math.round(area),
        anchor: [round(anchor.point[0], 4), round(anchor.point[1], 4)],
        names,
      },
      geometry: f.geometry,
    };
  });

  const unusedOverrides = NAME_OVERRIDES.filter((o) => !usedOverrides.has(o));
  if (unusedOverrides.length) fail(`overrides matched nothing: ${JSON.stringify(unusedOverrides)}`);
  const unusedSevenSeas = Object.keys(SEVEN_SEAS).filter((id) => !usedSevenSeas.has(id));
  if (unusedSevenSeas.length) fail(`SEVEN_SEAS rules matched nothing: ${unusedSevenSeas.join(', ')}`);

  // A question is a name; two places sharing one cannot both be asked fairly.
  for (const lang of LANGUAGES) {
    const seen = new Map();
    for (const f of features) {
      const key = f.properties.names[lang].toLocaleLowerCase(lang);
      if (seen.has(key)) fail(`${lang} name "${f.properties.names[lang]}" is used by both ${seen.get(key)} and ${f.id}`);
      seen.set(key, f.id);
    }
  }

  return { features, relocatedAnchors };
};

/** Quantization snaps vertices to a grid; hold every feature to its real shape. */
const checkQuantization = (topo, features) => {
  const decoded = feature(topo, topo.objects.countries).features;
  if (decoded.length !== features.length) fail('feature count changed in the topology');
  for (const [i, f] of decoded.entries()) {
    const before = features[i];
    const after = geometryArea(f.geometry);
    const ratio = after / geometryArea(before.geometry);
    if (ratio < 0.9 || ratio > 1.1) fail(`${f.id}: quantization changed the area by ${((ratio - 1) * 100).toFixed(1)}%`);
    if (!geometryContains(f.geometry, f.properties.anchor)) fail(`${f.id}: anchor fell outside after quantization`);
  }
};

const main = async () => {
  const source = await loadSource();
  const { features, relocatedAnchors } = buildFeatures(source);
  const topo = topology({ countries: { type: 'FeatureCollection', features } }, QUANTIZATION);
  checkQuantization(topo, features);

  const json = JSON.stringify(topo);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, json + '\n');

  const perContinent = {};
  for (const f of features) perContinent[f.properties.continent] = (perContinent[f.properties.continent] ?? 0) + 1;
  console.log(`wrote ${OUT}: ${features.length} features, ${(json.length / 1024).toFixed(0)} KiB`);
  console.log('per continent:', perContinent);
  console.log(`anchors moved off the Natural Earth label point: ${relocatedAnchors.join(' ')}`);
};

await main();
