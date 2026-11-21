import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { LANGUAGES, type Language } from '../i18n/language';

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

/** Where a shape belongs. Antarctica is drawn on the globe but never asked. */
export type Region = Continent | 'antarctica';

const REGIONS: readonly string[] = [...CONTINENTS, 'antarctica'];

/** What `tools/build-data.mjs` writes on every feature. */
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
  countries: readonly Country[];
  byId: ReadonlyMap<string, Country>;
};

/**
 * Decodes the shipped TopoJSON. Throws on anything the build would never have
 * written, so a damaged file stops the app at load instead of producing a
 * round that asks for a country with no name.
 */
export const parseWorld = (topology: WorldTopology): World => {
  const collection = feature(topology, topology.objects.countries);
  const countries = collection.features.map((f) => {
    const id = f.id;
    const p = f.properties;
    if (typeof id !== 'string' || !/^[A-Z]{3}$/.test(id)) {
      throw new Error(`world data: bad id ${JSON.stringify(id)}`);
    }
    if (!p || !REGIONS.includes(p.continent)) {
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
  const byId = new Map(countries.map((c) => [c.id, c]));
  if (byId.size !== countries.length) throw new Error('world data: duplicate ids');
  return { countries, byId };
};

export const countriesOf = (world: World, continent: Continent): Country[] =>
  world.countries.filter((c) => c.properties.continent === continent);
