import { geoBounds, geoContains } from 'd3-geo';
import type { Point } from './gesture';
import { RING_BULLSEYE_PX, RING_HIT_PX, nearestRing } from './rings';
import { isWithinHorizon, type LngLat, type View } from './view';
import type { Country } from './world';

/** The country under a `[lng, lat]` point, or null over the sea or other land. */
export type Locator = (point: LngLat) => Country | null;

const withinLng = (lng: number, west: number, east: number): boolean =>
  // d3's geoBounds gives west > east for a shape that crosses the antimeridian.
  west <= east ? lng >= west && lng <= east : lng >= west || lng <= east;

/**
 * Point-in-country lookup over the given countries only (GlobeView passes
 * the round's continent). Spherical, via d3-geo, which reads each ring's
 * winding to know its inside: `src/__tests__/pick.test.ts` checks the data
 * is wound that way. A bounding box test first keeps a tap from walking
 * every vertex of Russia.
 *
 * Natural Earth cuts enclaves out of the country around them, so a point
 * lies in one country at most. Should two ever overlap, the smaller wins:
 * the enclave is the one a player would be aiming at.
 */
export const createLocator = (countries: readonly Country[]): Locator => {
  const entries = countries.map((country) => {
    const [[west, south], [east, north]] = geoBounds(country);
    return { country, west, south, east, north };
  });
  return ([lng, lat]) => {
    let found: Country | null = null;
    for (const { country, west, south, east, north } of entries) {
      if (lat < south || lat > north || !withinLng(lng, west, east)) continue;
      if (!geoContains(country, [lng, lat])) continue;
      if (!found || country.properties.areaKm2 < found.properties.areaKm2) found = country;
    }
    return found;
  };
};

/** A ring, and where on the globe it sits. */
export type RingAnchor = { id: string; anchor: LngLat };

export type TapContext = {
  /** The countries with a ring right now (GlobeView recomputes them on zoom). */
  rings: readonly RingAnchor[];
  /** Where the camera is, to leave out rings behind the horizon. */
  view: View;
  /** `[lng, lat]` to the same screen coordinates as the tap. */
  project: (point: LngLat) => Point;
  /** Screen to `[lng, lat]` on the globe's surface, or null off the globe. */
  unproject: (point: Point) => LngLat | null;
  locate: Locator;
};

/**
 * Which country a tap picks. The country under the pointer, if it is in
 * play, unless a ring on the visible side is close enough:
 *
 * - over a country big enough to tap (one without a ring of its own), a ring
 *   wins only within `RING_BULLSEYE_PX` of its centre, so a ring drawn over
 *   Rome does not take a third of Italy (the owner's rule, 2026-11-21);
 * - over the sea, other land, or a country that has a ring itself, the
 *   nearest ring within `RING_HIT_PX` wins (plan, Phase 2 item 6).
 */
export const resolveTap = (tap: Point, context: TapContext): string | null => {
  const { rings, view, project, unproject, locate } = context;
  const point = unproject(tap);
  const under = point ? locate(point) : null;
  const tappable = under !== null && !rings.some((ring) => ring.id === under.id);
  const visible = rings
    .filter((ring) => isWithinHorizon(view, ring.anchor))
    .map((ring) => ({ id: ring.id, ...project(ring.anchor) }));
  return nearestRing(visible, tap, tappable ? RING_BULLSEYE_PX : RING_HIT_PX) ?? under?.id ?? null;
};
