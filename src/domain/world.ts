import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { LANGUAGES, type Language } from '../i18n/language';
import { oceanPlaces } from './oceans';

/** The continents a round can be played on, in the order the picker shows them. */
export const CONTINENTS = [
  'europe',
  'africa',
  'asia',
  'north-america',
  'south-america',
  'oceania',
] as const;
export type Continent = (typeof CONTINENTS)[number];

/**
 * What Home offers to play on: a continent, or the oceans (plan, Phase 7),
 * in the order the picker shows them. The code keeps calling the choice
 * `continent` (the setting, the screens' props), as it calls every place a
 * round asks a country.
 */
export const AREAS = [...CONTINENTS, 'oceans'] as const;
export type Area = (typeof AREAS)[number];

/**
 * Where a shape belongs. Antarctica is drawn on the globe but never asked;
 * the oceans' discs are not in the data file (`src/domain/oceans.ts`).
 */
export type Region = Area | 'antarctica';

/** The regions the data file may name. */
const FILE_REGIONS: readonly string[] = [...CONTINENTS, 'antarctica'];

/**
 * A place's properties. `tools/build-data.mjs` writes them on every country;
 * `oceanPlaces` gives the oceans the same shape.
 */
export type CountryProperties = {
  continent: Region;
  /** Natural Earth's TYPE: "Sovereign country", "Dependency", "Disputed", … */
  kind: string;
  /** Natural Earth's MAPCOLOR7, 1–7, chosen upstream so neighbours differ. */
  color: number;
  areaKm2: number;
  /** `[lng, lat]`, guaranteed by the build to lie on the country's own land. */
  anchor: [number, number];
  names: Record<Language, string>;
};

export type Country = Feature<Polygon | MultiPolygon, CountryProperties> & { id: string };

export type WorldTopology = Topology<{ countries: GeometryCollection<CountryProperties> }>;

export type World = {
  /** The land: every shape of the data file. */
  countries: readonly Country[];
  /** The five oceans' discs (`src/domain/oceans.ts`), drawn only in an oceans round. */
  oceans: readonly Country[];
  /** Both, so every screen finds an ocean's name the way it finds a country's. */
  byId: ReadonlyMap<string, Country>;
};

/**
 * Decodes the shipped TopoJSON, and adds the oceans. Throws on anything the
 * build would never have written, so a damaged file stops the app at load
 * instead of producing a round that asks for a country with no name.
 */
export const parseWorld = (topology: WorldTopology): World => {
  const collection = feature(topology, topology.objects.countries);
  const countries = collection.features.map((f) => {
    const id = f.id;
    const p = f.properties;
    if (typeof id !== 'string' || !/^[A-Z]{3}$/.test(id)) {
      throw new Error(`world data: bad id ${JSON.stringify(id)}`);
    }
    if (!p || !FILE_REGIONS.includes(p.continent)) {
      throw new Error(`world data: ${id} has no known continent`);
    }
    for (const lang of LANGUAGES) {
      if (!p.names?.[lang]) throw new Error(`world data: ${id} has no ${lang} name`);
    }
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') {
      throw new Error(`world data: ${id} is a ${f.geometry.type}`);
    }
    return f as Country;
  });
  const oceans = oceanPlaces();
  const byId = new Map([...countries, ...oceans].map((c) => [c.id, c]));
  if (byId.size !== countries.length + oceans.length) throw new Error('world data: duplicate ids');
  return { countries, oceans, byId };
};

export const countriesOf = (world: World, continent: Continent): Country[] =>
  world.countries.filter((c) => c.properties.continent === continent);

/**
 * Below this area a place counts as tiny, and the "without the tiny
 * countries" switch leaves it out: the owner's cut-off of 2026-11-22
 * (docs/plan.md, Phase 5). Compared with `areaKm2`.
 */
export const TINY_BELOW_KM2 = 1_000;

export type PoolOptions = {
  /** Leave out the places under `TINY_BELOW_KM2`. */
  skipTiny: boolean;
};

/**
 * The places a round on `continent` is about: the ones it asks, colours,
 * rings and lets the player tap. A place left out looks and acts like land
 * outside the continent. Everything that needs the round's places calls
 * this, so the draw, the globe and Home's count cannot disagree.
 *
 * On the oceans it is the five oceans, whatever `skipTiny` says: the
 * smallest disc is over a million km².
 */
export const quizPool = (world: World, continent: Area, { skipTiny }: PoolOptions): Country[] =>
  continent === 'oceans'
    ? [...world.oceans]
    : countriesOf(world, continent).filter((c) => !skipTiny || c.properties.areaKm2 >= TINY_BELOW_KM2);
