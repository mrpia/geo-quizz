import { geoArea, geoContains, geoDistance } from 'd3-geo';
import type { MultiPolygon, Polygon } from 'geojson';
import raw from '../data/world.json?raw';
import { OCEANS, OCEAN_IDS, ZONE_SHARE, discRadiusDeg, discRing, oceanPlaces } from '../domain/oceans';
import { createLocator } from '../domain/pick';
import type { LngLat } from '../domain/view';
import { parseWorld, type WorldTopology } from '../domain/world';
import { LANGUAGES } from '../i18n/language';

const world = parseWorld(JSON.parse(raw) as WorldTopology);
const onLand = createLocator(world.countries);

const RAD = Math.PI / 180;
/** The radius `build-data.mjs` and `screenDiameterPx` use. */
const EARTH_RADIUS_KM = 6371.0088;
const sphereKm2 = 4 * Math.PI * EARTH_RADIUS_KM ** 2;
const disc = (centre: LngLat, radiusDeg: number): Polygon => ({
  type: 'Polygon',
  coordinates: [discRing(centre, radiusDeg)],
});
const km2 = (polygon: Polygon) => (geoArea(polygon) / (4 * Math.PI)) * sphereKm2;
const degreesBetween = (a: LngLat, b: LngLat) => geoDistance([...a], [...b]) / RAD;

/** Every disc of every ocean, with its radius. */
const discs = OCEAN_IDS.flatMap((id) =>
  OCEANS[id].map(({ areaKm2, centre }) => ({ id, centre, radius: discRadiusDeg(areaKm2 * ZONE_SHARE) })),
);

describe('the ocean table', () => {
  it('has the five oceans the owner chose, Pacific first', () => {
    expect(OCEAN_IDS).toEqual(['pacific', 'atlantic', 'indian', 'southern', 'arctic']);
    expect(Object.keys(OCEANS).sort()).toEqual([...OCEAN_IDS].sort());
  });

  // Eakins and Sharman (2010), NOAA's "World Ocean Volumes" (docs/plan.md,
  // Phase 7). The Atlantic's halves leave out the Mediterranean and the
  // Baltic, which NOAA counts in its 85,133,000 km².
  it("sizes each part by NOAA's area for it", () => {
    const parts = (id: (typeof OCEAN_IDS)[number]) => OCEANS[id].map((p) => p.areaKm2);
    expect(parts('pacific')).toEqual([77_010_000, 84_750_000]);
    expect(parts('atlantic')).toEqual([41_490_000, 40_270_000]);
    expect(parts('indian')).toEqual([70_560_000]);
    expect(parts('southern').reduce((a, b) => a + b)).toBeCloseTo(21_960_000);
    expect(parts('southern')).toHaveLength(3);
    expect(parts('arctic')).toEqual([15_558_000]);
  });

  it('gives the discs the radii in the plan', () => {
    const radii = discs.map((d) => `${d.id} ${d.radius.toFixed(1)}`);
    expect(radii).toEqual([
      'pacific 20.0',
      'pacific 21.0',
      'atlantic 14.7',
      'atlantic 14.4',
      'indian 19.1',
      'southern 6.1',
      'southern 6.1',
      'southern 6.1',
      'arctic 9.0',
    ]);
  });
});

describe('discs on the sphere', () => {
  const cases: [string, LngLat, number][] = [
    ['in the open Atlantic', [-40, 32], 14.7],
    ['across the antimeridian', [-160, 28], 20],
    ['round the North Pole', [0, 90], 9],
    ['near Antarctica', [25, -61], 6.1],
  ];

  it.each(cases)('draws a closed ring %s', (_label, centre, radius) => {
    const ring = discRing(centre, radius);
    expect(ring.length).toBeGreaterThan(60);
    expect(ring.at(-1)).toEqual(ring[0]);
    for (const [lng, lat] of ring) {
      expect(Math.abs(lng)).toBeLessThanOrEqual(180);
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
    }
  });

  it.each(cases)('puts every vertex at the radius %s', (_label, centre, radius) => {
    for (const vertex of discRing(centre, radius)) {
      expect(degreesBetween(centre, vertex as LngLat)).toBeCloseTo(radius, 6);
    }
  });

  // d3-geo reads a ring's winding to know its inside, as the picker and
  // globe.gl's triangulation do: wound the wrong way, a disc is the rest of
  // the world.
  it.each(cases)('winds the ring so the disc is its inside %s', (_label, centre, radius) => {
    const polygon = disc(centre, radius);
    const capKm2 = (sphereKm2 / 2) * (1 - Math.cos(radius * RAD));
    expect(km2(polygon) / capKm2).toBeCloseTo(1, 2);
    expect(geoContains(polygon, [...centre])).toBe(true);
    expect(geoContains(polygon, [centre[0] + 180, -centre[1]])).toBe(false);
  });

  it('inverts the area of a spherical cap', () => {
    for (const radius of [1, 6.1, 20, 45, 90]) {
      const capKm2 = (sphereKm2 / 2) * (1 - Math.cos(radius * RAD));
      expect(discRadiusDeg(capKm2)).toBeCloseTo(radius, 9);
    }
    expect(() => discRadiusDeg(0)).toThrow(RangeError);
    expect(() => discRadiusDeg(sphereKm2 / 2 + 1)).toThrow(RangeError);
  });
});

describe('ocean places', () => {
  const places = oceanPlaces();

  it('makes one place per ocean, in the table order', () => {
    expect(places.map((p) => p.id)).toEqual([...OCEAN_IDS]);
    for (const p of places) {
      expect(p.properties.continent, p.id).toBe('oceans');
      expect(p.properties.kind, p.id).toBe('Ocean');
    }
  });

  it('draws one polygon per disc, and anchors the place at its first centre', () => {
    for (const p of places) {
      const parts = OCEANS[p.id as (typeof OCEAN_IDS)[number]];
      const polygons = p.geometry.type === 'Polygon' ? [p.geometry.coordinates] : p.geometry.coordinates;
      expect(polygons, p.id).toHaveLength(parts.length);
      expect(p.properties.anchor, p.id).toEqual([...parts[0].centre]);
    }
  });

  it('gives each place the area of its discs: a fifth of the ocean', () => {
    for (const p of places) {
      const ocean = OCEANS[p.id as (typeof OCEAN_IDS)[number]].reduce((sum, part) => sum + part.areaKm2, 0);
      expect(p.properties.areaKm2 / (ocean * ZONE_SHARE), p.id).toBeCloseTo(1, 6);
      expect(km2Of(p.geometry) / p.properties.areaKm2, p.id).toBeCloseTo(1, 2);
    }
  });

  it('names every ocean in every language, capitalised', () => {
    for (const p of places) {
      for (const lang of LANGUAGES) {
        const name = p.properties.names[lang];
        expect(name, `${p.id}.${lang}`).toMatch(/\S/);
        expect(name.charAt(0), `${p.id}.${lang}`).toBe(name.charAt(0).toLocaleUpperCase(lang));
      }
    }
    expect(places.map((p) => p.properties.names.en)).toEqual([
      'Pacific Ocean',
      'Atlantic Ocean',
      'Indian Ocean',
      'Southern Ocean',
      'Arctic Ocean',
    ]);
  });
});

// The discs against the land of the shipped data file (docs/plan.md, Phase 7).
describe('ocean discs on the map', () => {
  it('centres every disc in open water', () => {
    for (const { id, centre } of discs) expect(onLand(centre)?.id, `${id} ${centre}`).toBeUndefined();
  });

  it('keeps every two discs at least 5° apart', () => {
    for (const [i, a] of discs.entries()) {
      for (const b of discs.slice(i + 1)) {
        const gap = degreesBetween(a.centre, b.centre) - a.radius - b.radius;
        expect(gap, `${a.id} ${a.centre} / ${b.id} ${b.centre}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('keeps land under a tenth of every disc', () => {
    for (const { id, centre, radius } of discs) {
      // 8 rings of 45 points inside the disc; a ring at distance d from the
      // centre stands for an area that grows with sin(d). Coarse, since each
      // point near the Pole walks the outlines of Russia, Canada and
      // Greenland, and plenty to tell the Arctic's 5.9% from 10%.
      let all = 0;
      let land = 0;
      for (let k = 0; k < 8; k++) {
        const distance = (radius * (k + 0.5)) / 8;
        const points = discRing(centre, distance).filter((_, i) => i % 2 === 0 && i < 90);
        const weight = Math.sin(distance * RAD) / points.length;
        for (const point of points) {
          all += weight;
          if (onLand(point as LngLat)) land += weight;
        }
      }
      expect(land / all, `${id} ${centre}`).toBeLessThan(0.1);
    }
    // About 2 s alone; a full parallel run made it four times slower.
  }, 30_000);
});

function km2Of(geometry: Polygon | MultiPolygon): number {
  return (geoArea(geometry) / (4 * Math.PI)) * sphereKm2;
}
