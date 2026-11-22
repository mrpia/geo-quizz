// `?raw`, not a JSON import: that would make `tsc` infer a type for 761 KiB of
// coordinates. `node:fs` would work too, but would pull Node's types into src/.
import { geoArea } from 'd3-geo';
import raw from '../data/world.json?raw';
import {
  CONTINENTS,
  TINY_BELOW_KM2,
  countriesOf,
  parseWorld,
  quizPool,
  type WorldTopology,
} from '../domain/world';
import { LANGUAGES } from '../i18n/language';

const world = parseWorld(JSON.parse(raw) as WorldTopology);

/**
 * `tools/build-data.mjs` throws on all of this before it writes the file. These
 * tests hold the *committed* file to the same rules, so a hand edit or a
 * regeneration with a weakened script cannot pass `pnpm test`.
 */
describe('shipped world data', () => {
  it('keeps every Natural Earth admin-0 feature', () => {
    expect(world.countries).toHaveLength(242);
  });

  it('gives every continent enough countries for a default round', () => {
    for (const continent of CONTINENTS) {
      expect(countriesOf(world, continent).length, continent).toBeGreaterThanOrEqual(10);
    }
  });

  it('names every country in every language, capitalised', () => {
    for (const c of world.countries) {
      for (const lang of LANGUAGES) {
        const name = c.properties.names[lang];
        expect(name.trim(), `${c.id}.${lang}`).toBe(name);
        expect(name.charAt(0), `${c.id}.${lang}`).toBe(name.charAt(0).toLocaleUpperCase(lang));
      }
    }
  });

  it('never gives two countries of one continent the same name', () => {
    for (const continent of CONTINENTS) {
      for (const lang of LANGUAGES) {
        const names = countriesOf(world, continent).map((c) => c.properties.names[lang]);
        expect(new Set(names).size, `${continent}/${lang}`).toBe(names.length);
      }
    }
  });

  it('puts every anchor on the globe', () => {
    for (const c of world.countries) {
      const [lng, lat] = c.properties.anchor;
      expect(Math.abs(lng), c.id).toBeLessThanOrEqual(180);
      expect(Math.abs(lat), c.id).toBeLessThanOrEqual(90);
    }
  });
});

/** What the app relies on beyond the build's own rules (docs/data.md, Output format). */
describe('shipped world data, as the app reads it', () => {
  it('winds every shape the way d3-geo expects', () => {
    // The tap picker (src/domain/pick.ts) asks d3-geo which country contains
    // a point. d3-geo reads a ring's winding to know which side is inside: a
    // shape wound the other way would contain the whole world except itself.
    const inverted = world.countries.filter((c) => geoArea(c) > 2 * Math.PI).map((c) => c.id);
    expect(inverted).toEqual([]);
  });
});

/** Decisions documented in docs/data.md, pinned so a rebuild cannot undo them. */
describe('data decisions', () => {
  const name = (id: string) => world.byId.get(id)?.properties.names;
  const continent = (id: string) => world.byId.get(id)?.properties.continent;

  it('uses the short name for China and Taiwan', () => {
    expect(name('CHN')).toEqual({ en: 'China', de: 'China', fr: 'Chine' });
    expect(name('TWN')?.de).toBe('Taiwan');
  });

  it('tells the two halves of Saint Martin apart in French', () => {
    expect(name('MAF')?.fr).toBe('Saint-Martin');
    expect(name('SXM')?.fr).toBe('Sint Maarten');
  });

  it('capitalises French names that upstream starts in lower case', () => {
    expect(name('IMN')?.fr).toBe('Île de Man');
  });

  it("follows Natural Earth's continents, with the open-ocean islands assigned", () => {
    expect(continent('RUS')).toBe('europe');
    expect(continent('TUR')).toBe('asia');
    expect(continent('CYP')).toBe('asia');
    expect(continent('MDV')).toBe('asia');
    expect(continent('MUS')).toBe('africa');
    expect(continent('SGS')).toBe('south-america');
    expect(continent('ATA')).toBe('antarctica');
  });
});

/**
 * The "without the tiny countries" switch (docs/plan.md, Phase 5): the
 * owner's cut-off of 2026-11-22, and what it leaves on each continent.
 */
describe('the quiz pool', () => {
  const ids = (continent: Parameters<typeof countriesOf>[1], skipTiny: boolean) =>
    quizPool(world, continent, { skipTiny }).map((c) => c.id);

  it('is every place of the continent, in data order, while the switch is off', () => {
    for (const continent of CONTINENTS) {
      expect(ids(continent, false), continent).toEqual(countriesOf(world, continent).map((c) => c.id));
    }
  });

  it('leaves out the places under 1,000 km² when the switch is on', () => {
    expect(TINY_BELOW_KM2).toBe(1_000);
    for (const continent of CONTINENTS) {
      const pool = quizPool(world, continent, { skipTiny: true });
      expect(pool.every((c) => c.properties.areaKm2 >= 1_000), continent).toBe(true);
      const left = countriesOf(world, continent).filter((c) => !pool.includes(c));
      expect(left.every((c) => c.properties.areaKm2 < 1_000), continent).toBe(true);
    }
  });

  it('keeps this many places per continent, as measured on 2026-11-22', () => {
    const counts = Object.fromEntries(CONTINENTS.map((c) => [c, [ids(c, false).length, ids(c, true).length]]));
    expect(counts).toEqual({
      europe: [50, 40],
      africa: [60, 55],
      asia: [54, 49],
      'north-america': [38, 18],
      'south-america': [14, 14],
      // Fewer than a default round of 10: the round is shortened (App's roundSize).
      oceania: [25, 9],
    });
  });

  it('drops the microstates and the smallest islands from Europe, and keeps the Faroe Islands', () => {
    const dropped = countriesOf(world, 'europe')
      .map((c) => c.id)
      .filter((id) => !ids('europe', true).includes(id));
    expect(dropped.sort()).toEqual(['ALD', 'AND', 'GGY', 'IMN', 'JEY', 'LIE', 'MCO', 'MLT', 'SMR', 'VAT']);
    // 1,036 km², the closest to the cut-off on the kept side.
    expect(ids('europe', true)).toContain('FRO');
  });
});
