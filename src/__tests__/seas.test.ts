import { geoArea, geoContains, geoDistance } from 'd3-geo';
import raw from '../data/world.json?raw';
import { OCEANS, OCEAN_IDS, ZONE_SHARE, discRadiusDeg, discRing } from '../domain/oceans';
import { createLocator } from '../domain/pick';
import { SEAS, SEA_IDS, SEA_ZONE_SHARE, seaPlaces, seaRadiusDeg } from '../domain/seas';
import type { LngLat } from '../domain/view';
import { parseWorld, type WorldTopology } from '../domain/world';
import { LANGUAGES } from '../i18n/language';

const world = parseWorld(JSON.parse(raw) as WorldTopology);
const onLand = createLocator(world.countries);

const RAD = Math.PI / 180;
/** The radius `build-data.mjs` and `screenDiameterPx` use. */
const EARTH_RADIUS_KM = 6371.0088;
const sphereKm2 = 4 * Math.PI * EARTH_RADIUS_KM ** 2;
const degreesBetween = (a: LngLat, b: LngLat) => geoDistance([...a], [...b]) / RAD;

const seaDiscs = SEA_IDS.map((id) => ({ id, centre: SEAS[id].centre, radius: seaRadiusDeg(id) }));
const oceanDiscs = OCEAN_IDS.flatMap((id) =>
  OCEANS[id].map(({ areaKm2, centre }) => ({ id, centre, radius: discRadiusDeg(areaKm2 * ZONE_SHARE) })),
);

describe('the sea table', () => {
  // docs/plan.md, Phase 8: Natural Earth's scalerank 1 seas, gulfs and bays,
  // the Caspian among them, plus the North Sea and the Baltic.
  it('has the 24 seas the owner chose', () => {
    expect(SEA_IDS).toEqual([
      'mediterranean-sea',
      'black-sea',
      'red-sea',
      'caspian-sea',
      'north-sea',
      'baltic-sea',
      'caribbean-sea',
      'gulf-of-mexico',
      'hudson-bay',
      'baffin-bay',
      'labrador-sea',
      'beaufort-sea',
      'gulf-of-alaska',
      'sea-of-okhotsk',
      'sea-of-japan',
      'philippine-sea',
      'south-china-sea',
      'coral-sea',
      'tasman-sea',
      'arabian-sea',
      'bay-of-bengal',
      'persian-gulf',
      'weddell-sea',
      'ross-sea',
    ]);
    expect(Object.keys(SEAS).sort()).toEqual([...SEA_IDS].sort());
  });

  it('gives each disc four fifths of the room the sea has', () => {
    expect(SEA_ZONE_SHARE).toBe(0.8);
    for (const id of SEA_IDS) expect(seaRadiusDeg(id), id).toBeCloseTo(SEAS[id].fitsDeg * 0.8, 9);
  });

  it('sizes the discs from 0.9° (the Baltic) to 7.3° (the Philippine Sea)', () => {
    const radii = seaDiscs.map((d) => d.radius).sort((a, b) => a - b);
    expect(radii[0]).toBeCloseTo(0.9, 1);
    expect(radii.at(-1)).toBeCloseTo(7.33, 1);
    expect(seaRadiusDeg('baltic-sea')).toBe(radii[0]);
    expect(seaRadiusDeg('philippine-sea')).toBe(radii.at(-1));
  });
});

describe('sea places', () => {
  const places = seaPlaces();

  it('makes one place per sea, in the table order, played with the oceans', () => {
    expect(places.map((p) => p.id)).toEqual([...SEA_IDS]);
    for (const p of places) {
      expect(p.properties.continent, p.id).toBe('oceans');
      expect(p.properties.kind, p.id).toBe('Sea');
    }
  });

  it('draws one disc, anchored at its centre, with the area of the disc', () => {
    for (const p of places) {
      const { centre } = SEAS[p.id as (typeof SEA_IDS)[number]];
      expect(p.geometry.type, p.id).toBe('Polygon');
      expect(p.properties.anchor, p.id).toEqual([...centre]);
      const km2 = (geoArea(p.geometry) / (4 * Math.PI)) * sphereKm2;
      expect(km2 / p.properties.areaKm2, p.id).toBeCloseTo(1, 2);
      expect(geoContains(p.geometry, [...centre]), p.id).toBe(true);
    }
  });

  it('names every sea in every language, capitalised, none twice', () => {
    for (const lang of LANGUAGES) {
      const names = places.map((p) => p.properties.names[lang]);
      for (const [i, name] of names.entries()) {
        expect(name, `${places[i].id}.${lang}`).toMatch(/\S/);
        expect(name.charAt(0), `${places[i].id}.${lang}`).toBe(name.charAt(0).toLocaleUpperCase(lang));
      }
      expect(new Set(names).size, lang).toBe(names.length);
    }
  });

  // docs/data.md, "Sea zones": Natural Earth's names, checked against the
  // Wikidata labels and the Wikipedia titles of each sea on 2026-11-23.
  it('keeps the names the sources agree on, and settles the two they do not', () => {
    const name = (id: string, lang: 'en' | 'fr' | 'de') => places.find((p) => p.id === id)?.properties.names[lang];
    expect(name('mediterranean-sea', 'fr')).toBe('Mer Méditerranée');
    expect(name('north-sea', 'de')).toBe('Nordsee');
    expect(name('baltic-sea', 'de')).toBe('Ostsee');
    // Natural Earth says "mer de Baffin"; Wikidata and French Wikipedia say baie.
    expect(name('baffin-bay', 'fr')).toBe('Baie de Baffin');
    // Natural Earth and Wikidata say "Weddell-Meer"; German Wikipedia, like
    // the Rossmeer next to it, writes one word.
    expect(name('weddell-sea', 'de')).toBe('Weddellmeer');
    // German Wikipedia's own titles, not slips.
    expect(name('hudson-bay', 'de')).toBe('Hudson Bay');
    expect(name('baffin-bay', 'de')).toBe('Baffin Bay');
  });
});

// The discs against the land of the shipped data file, and against the
// oceans' discs, which a round with the seas draws too.
describe('sea discs on the map', () => {
  it('centres every disc in open water', () => {
    for (const { id, centre } of seaDiscs) expect(onLand(centre)?.id, `${id} ${centre}`).toBeUndefined();
  });

  // As for the oceans' discs. The closest pair is the North Sea and the
  // Baltic, 5.7° apart.
  it('keeps every disc at least 5° from every other, the oceans included', () => {
    const all = [...oceanDiscs, ...seaDiscs];
    for (const a of seaDiscs) {
      for (const b of all) {
        if (a.id === b.id) continue;
        const gap = degreesBetween(a.centre, b.centre) - a.radius - b.radius;
        expect(gap, `${a.id} ${a.centre} / ${b.id} ${b.centre}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('keeps land under a twentieth of every disc', () => {
    for (const { id, centre, radius } of seaDiscs) {
      // 8 rings of 45 points, each standing for an area that grows with the
      // sine of its distance from the centre, as in oceans.test.ts.
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
      expect(land / all, `${id} ${centre}`).toBeLessThan(0.05);
    }
  }, 30_000);
});
