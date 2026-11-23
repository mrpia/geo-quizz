import { translate } from '../i18n';
import { LANGUAGES, type Language } from '../i18n/language';
import { EARTH_RADIUS_KM, type LngLat } from './view';
import type { Country } from './world';

/**
 * The oceans a round on the oceans asks (plan, Phase 7), in the order Home's
 * count and the tests list them. No borders are drawn in the water: each
 * ocean is one or more discs near its middle, the way a globe prints an
 * ocean's name across it, and the player taps a disc.
 */
export const OCEAN_IDS = ['pacific', 'atlantic', 'indian', 'southern', 'arctic'] as const;
export type OceanId = (typeof OCEAN_IDS)[number];

/** One disc: the area of the part of the ocean it stands for, and its centre. */
export type OceanPart = { areaKm2: number; centre: LngLat };

/**
 * How much of its part of the ocean a disc covers: enough to read as the
 * ocean's middle, little enough to stay off the coasts. At 0.2 the radii run
 * from 6.1° to 21.0° (plan, Phase 7).
 */
export const ZONE_SHARE = 0.2;

/**
 * Areas from Eakins and Sharman (2010), *Volumes of the World's Oceans from
 * ETOPO1*, NOAA National Geophysical Data Center, which bounds the oceans by
 * IHO Special Publication 23 (1953) and counts the Southern Ocean as all
 * water south of 60°S. NOAA splits the Atlantic and the Pacific into north
 * and south, as globes print them; each half gets a disc. The Atlantic's
 * halves leave out the Mediterranean and the Baltic. The Southern Ocean, a
 * ring whose middle is the South Pole, gets three equal discs around
 * Antarctica. Centres chosen by hand on 2026-11-23 and checked against the
 * land in `oceans.test.ts`; the first one anchors the ocean's ✅ and the
 * camera's flight to it.
 */
export const OCEANS: Record<OceanId, readonly OceanPart[]> = {
  pacific: [
    { areaKm2: 77_010_000, centre: [-160, 28] },
    { areaKm2: 84_750_000, centre: [-125, -28] },
  ],
  atlantic: [
    { areaKm2: 41_490_000, centre: [-40, 32] },
    { areaKm2: 40_270_000, centre: [-17, -24] },
  ],
  indian: [{ areaKm2: 70_560_000, centre: [80, -20] }],
  southern: [
    { areaKm2: 21_960_000 / 3, centre: [25, -61] },
    { areaKm2: 21_960_000 / 3, centre: [135, -60] },
    { areaKm2: 21_960_000 / 3, centre: [-110, -63] },
  ],
  arctic: [{ areaKm2: 15_558_000, centre: [0, 90] }],
};

const RAD = Math.PI / 180;
const HALF_SPHERE_KM2 = 2 * Math.PI * EARTH_RADIUS_KM ** 2;

/** Vertices on a disc's edge, one every 4° of bearing. */
const DISC_STEPS = 90;

/**
 * The radius, in degrees of arc, of the spherical cap with this area. Up to
 * a hemisphere: d3-geo and globe.gl take anything larger for the rest of the
 * world.
 */
export const discRadiusDeg = (areaKm2: number): number => {
  if (!(areaKm2 > 0 && areaKm2 <= HALF_SPHERE_KM2)) {
    throw new RangeError(`discRadiusDeg: bad area ${areaKm2}`);
  }
  return Math.acos(1 - areaKm2 / HALF_SPHERE_KM2) / RAD;
};

const wrapLng = (lng: number): number => ((((lng + 180) % 360) + 360) % 360) - 180;

/**
 * A disc's edge as a closed GeoJSON ring: the points `radiusDeg` away from
 * `centre` at every bearing, north, then east, south and west. That turns
 * clockwise, the winding d3-geo reads as "the inside is the small side",
 * like the countries' (docs/data.md). Plain trigonometry rather than d3-geo's
 * `geoCircle`, which would pull d3-geo into the first bundle.
 *
 * The longitude uses the form of the destination-point formula that stays
 * defined at a pole: `atan2(sin θ sin δ, cos φ₀ cos δ − sin φ₀ sin δ cos θ)`.
 */
export const discRing = (centre: LngLat, radiusDeg: number): [number, number][] => {
  const [lng0, lat0] = centre;
  const phi0 = lat0 * RAD;
  const delta = radiusDeg * RAD;
  const ring: [number, number][] = [];
  for (let i = 0; i < DISC_STEPS; i++) {
    const theta = (2 * Math.PI * i) / DISC_STEPS;
    const sinPhi = Math.sin(phi0) * Math.cos(delta) + Math.cos(phi0) * Math.sin(delta) * Math.cos(theta);
    const phi = Math.asin(Math.max(-1, Math.min(1, sinPhi)));
    const dLambda = Math.atan2(
      Math.sin(theta) * Math.sin(delta),
      Math.cos(phi0) * Math.cos(delta) - Math.sin(phi0) * Math.sin(delta) * Math.cos(theta),
    );
    ring.push([wrapLng(lng0 + dLambda / RAD), phi / RAD]);
  }
  ring.push([...ring[0]]);
  return ring;
};

/** The area of a spherical cap of this radius, in km². */
export const capKm2 = (radiusDeg: number): number => HALF_SPHERE_KM2 * (1 - Math.cos(radiusDeg * RAD));

const namesOf = (id: OceanId): Record<Language, string> =>
  Object.fromEntries(LANGUAGES.map((lang) => [lang, translate(lang, `ocean.${id}`)])) as Record<
    Language,
    string
  >;

/**
 * The oceans as places a round can ask, shaped like the countries so that
 * the globe, the picker, the outlines and the screens treat them alike.
 * `color` is 0: the globe draws every disc in the same blue (`globeLook.ts`),
 * since no two of them touch.
 */
export const oceanPlaces = (): Country[] =>
  OCEAN_IDS.map((id) => {
    const parts = OCEANS[id];
    const radii = parts.map((part) => discRadiusDeg(part.areaKm2 * ZONE_SHARE));
    const polygons = parts.map((part, i) => [discRing(part.centre, radii[i])]);
    return {
      type: 'Feature',
      id,
      geometry:
        polygons.length === 1
          ? { type: 'Polygon', coordinates: polygons[0] }
          : { type: 'MultiPolygon', coordinates: polygons },
      properties: {
        continent: 'oceans',
        kind: 'Ocean',
        color: 0,
        areaKm2: Math.round(radii.reduce((sum, r) => sum + capKm2(r), 0)),
        anchor: [parts[0].centre[0], parts[0].centre[1]],
        names: namesOf(id),
      },
    };
  });
