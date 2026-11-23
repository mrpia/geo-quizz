#!/usr/bin/env node
/**
 * Prints where each sea's disc goes: the point of the sea farthest from its
 * edges, and that distance, in degrees of arc. `src/domain/seas.ts` holds
 * the result; this script is how the numbers there were found, and how to
 * check them (docs/data.md, "Sea zones").
 *
 * Source: Natural Earth 1:50m Marine Areas (`geography_marine_polys`),
 * release v5.1.2, public domain, like the countries. The download is cached
 * in `.cache/` and checked against a pinned SHA-256.
 *
 * A sea's edges are its coasts and its limits with the neighbouring seas, as
 * Natural Earth draws them. Natural Earth cuts smaller seas out of larger
 * ones (the Mediterranean polygon lacks the Tyrrhenian, Ionian, Adriatic,
 * Aegean and Balearic seas), so a sea is first joined with the pieces listed
 * under `with`: the limits they share drop out, and only the outer edge
 * counts. Each sea names the Natural Earth `name` it expects; the script
 * throws when one is missing, appears twice, or a `with` piece shares no
 * limit with the sea or another of its pieces (a join that would silently
 * do nothing).
 *
 * Run with `pnpm data:seas`. It writes nothing.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAzimuthalEquidistant, geoCentroid, geoDistance } from 'd3-geo';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE = {
  url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_geography_marine_polys.geojson',
  sha256: '6fe58083e0cc5c7fad9e396970e28a8580bbd8770cfa4d1d7b5a34423e912f97',
  cache: join(ROOT, '.cache/ne_50m_geography_marine_polys.v5.1.2.geojson'),
};

/**
 * The 24 seas (docs/plan.md, Phase 8): Natural Earth's scalerank 1 seas,
 * gulfs and bays, plus the North Sea and the Baltic, by the id the app uses
 * and the `name` Natural Earth gives them.
 */
const SEAS = [
  {
    id: 'mediterranean-sea',
    name: 'Mediterranean Sea',
    // Not the Aegean: Natural Earth's Aegean shares no vertex with the
    // Mediterranean or the Ionian, so it cannot be joined. The disc is far
    // from it either way.
    with: ['Tyrrhenian Sea', 'Ionian Sea', 'Adriatic Sea', 'Balearic Sea', 'Golfe du Lion'],
  },
  { id: 'black-sea', name: 'Black Sea' },
  { id: 'red-sea', name: 'Red Sea' },
  { id: 'caspian-sea', name: 'Caspian Sea' },
  { id: 'north-sea', name: 'North Sea' },
  { id: 'baltic-sea', name: 'Baltic Sea', with: ['Gulf of Bothnia', 'Gulf of Finland'] },
  { id: 'caribbean-sea', name: 'Caribbean Sea' },
  { id: 'gulf-of-mexico', name: 'Gulf of Mexico', with: ['Bahía de Campeche'] },
  { id: 'hudson-bay', name: 'Hudson Bay', with: ['James Bay'] },
  { id: 'baffin-bay', name: 'Baffin Bay' },
  { id: 'labrador-sea', name: 'Labrador Sea' },
  { id: 'beaufort-sea', name: 'Beaufort Sea' },
  { id: 'gulf-of-alaska', name: 'Gulf of Alaska' },
  { id: 'sea-of-okhotsk', name: 'Sea of Okhotsk' },
  { id: 'sea-of-japan', name: 'Sea of Japan' },
  { id: 'philippine-sea', name: 'Philippine Sea' },
  { id: 'south-china-sea', name: 'South China Sea' },
  { id: 'coral-sea', name: 'Coral Sea' },
  { id: 'tasman-sea', name: 'Tasman Sea' },
  { id: 'arabian-sea', name: 'Arabian Sea' },
  { id: 'bay-of-bengal', name: 'Bay of Bengal' },
  { id: 'persian-gulf', name: 'Persian Gulf' },
  { id: 'weddell-sea', name: 'Weddell Sea' },
  { id: 'ross-sea', name: 'Ross Sea' },
];

const fail = (message) => {
  throw new Error(`sea-zones: ${message}`);
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

const featureNamed = (features, name) => {
  const found = features.filter((f) => f.properties.name === name);
  if (found.length !== 1) fail(`expected one feature named ${JSON.stringify(name)}, found ${found.length}`);
  return found[0];
};

/** An edge's key, the same whichever way round it is walked. */
const edgeKey = (a, b) => {
  const p = `${a[0]},${a[1]}`;
  const q = `${b[0]},${b[1]}`;
  return p < q ? `${p}|${q}` : `${q}|${p}`;
};

/** On the antimeridian, where Natural Earth cuts a polygon in two (at 179.9999 and −180). */
const onCut = ([lng]) => Math.abs(Math.abs(lng) - 180) < 1e-3;

/**
 * The sea's outer edges in lon/lat: every ring segment of its pieces, less
 * the ones two pieces share (their common limit), and less the cut lines
 * along the antimeridian, which are not an edge of the sea at all (the
 * Ross Sea is cut in two there). Also returns, per piece, how many of its
 * edges it shares with another piece.
 */
const outerEdges = (pieces) => {
  const owners = new Map();
  const edges = [];
  for (const [index, polygons] of pieces.entries()) {
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (let i = 0; i < ring.length - 1; i++) {
          if (onCut(ring[i]) && onCut(ring[i + 1])) continue;
          const key = edgeKey(ring[i], ring[i + 1]);
          owners.set(key, [...(owners.get(key) ?? []), index]);
          edges.push([ring[i], ring[i + 1], key]);
        }
      }
    }
  }
  const sharedBy = pieces.map((_, index) =>
    [...owners.values()].filter((list) => list.length > 1 && list.includes(index)).length,
  );
  return {
    edges: edges.filter(([, , key]) => owners.get(key).length === 1).map(([a, b]) => [a, b]),
    sharedBy,
  };
};

/** Even–odd ray casting in the projected plane. */
const ringContains = (ring, [x, y]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const polygonContains = ([outer, ...holes], point) =>
  ringContains(outer, point) && !holes.some((hole) => ringContains(hole, point));

const segmentDistance = ([px, py], [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const DEG = 180 / Math.PI;

/** True great-circle distance, in degrees, from a point to an edge, sampled every 0.05°. */
const arcToEdge = (point, [a, b]) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
  let best = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    best = Math.min(best, geoDistance(point, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]) * DEG);
  }
  return best;
};

/**
 * The point of the sea farthest from its outer edges. The search runs in an
 * azimuthal equidistant projection centred on the sea, where a unit is about
 * a degree of arc, so a high-latitude sea is not stretched east–west as it
 * is in lon/lat: a grid, then two finer grids around the best point. The
 * distance it reports is measured again on the sphere.
 */
const farthestPoint = (pieces, edges) => {
  const centroid = geoCentroid({
    type: 'GeometryCollection',
    geometries: pieces.map((polygons) => ({ type: 'MultiPolygon', coordinates: polygons })),
  });
  const projection = geoAzimuthalEquidistant()
    .rotate([-centroid[0], -centroid[1]])
    .scale(DEG)
    .translate([0, 0]);
  const flat = pieces.flatMap((polygons) => polygons.map((polygon) => polygon.map((ring) => ring.map((p) => projection(p)))));
  const flatEdges = edges.map(([a, b]) => [projection(a), projection(b)]);
  const inside = (p) => flat.some((polygon) => polygonContains(polygon, p));
  const clearance = (p) => flatEdges.reduce((best, [a, b]) => Math.min(best, segmentDistance(p, a, b)), Infinity);

  const xs = flat.flatMap((polygon) => polygon[0].map((p) => p[0]));
  const ys = flat.flatMap((polygon) => polygon[0].map((p) => p[1]));
  let best = null;
  const search = (x0, x1, y0, y1, step) => {
    for (let x = x0; x <= x1; x += step) {
      for (let y = y0; y <= y1; y += step) {
        const p = [x, y];
        if (!inside(p)) continue;
        const r = clearance(p);
        if (!best || r > best.r) best = { p, r };
      }
    }
  };
  search(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), 0.25);
  if (!best) fail('no point inside the sea');
  for (const step of [0.025, 0.0025]) {
    const [x, y] = best.p;
    search(x - step * 12, x + step * 12, y - step * 12, y + step * 12, step);
  }
  const centre = projection.invert(best.p);
  const radius = edges.reduce((min, edge) => Math.min(min, arcToEdge(centre, edge)), Infinity);
  return { centre, radius };
};

const main = async () => {
  const source = await loadSource();
  const rows = SEAS.map((sea) => {
    const own = featureNamed(source.features, sea.name);
    const others = (sea.with ?? []).map((name) => featureNamed(source.features, name));
    const pieces = [own, ...others].map((f) => polygonsOf(f.geometry));
    const { edges, sharedBy } = outerEdges(pieces);
    for (const [i, name] of (sea.with ?? []).entries()) {
      if (sharedBy[i + 1] === 0) fail(`${sea.id}: ${name} shares no limit with the sea or its other pieces`);
    }
    const { centre, radius } = farthestPoint(pieces, edges);
    return { id: sea.id, centre: centre.map((v) => Number(v.toFixed(2))), radius: Number(radius.toFixed(2)) };
  });
  for (const { id, centre, radius } of rows) {
    console.log(`  '${id}': { centre: [${centre[0]}, ${centre[1]}], fitsDeg: ${radius} },`);
  }
};

await main();
