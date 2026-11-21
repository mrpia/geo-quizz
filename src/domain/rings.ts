import type { Point } from './gesture';
import { needsTapRing } from './view';
import type { Country } from './world';

/** A ring's drawn diameter (plan, Phase 2 item 6). */
export const RING_DIAMETER_PX = 44;

/**
 * How far from a ring's centre a tap still picks it (plan, Phase 2 item 6):
 * the ring's own radius plus a few pixels for a finger that lands on its
 * edge.
 */
export const RING_HIT_PX = 26;

/** The ids of the countries too small to tap at this zoom, in the given order. */
export const ringedIds = (
  countries: readonly Country[],
  altitude: number,
  viewportHeightPx: number,
): string[] =>
  countries
    .filter((c) => needsTapRing(c.properties.areaKm2, altitude, viewportHeightPx))
    .map((c) => c.id);

/** A ring's centre on screen, in the same coordinates as the pointer. */
export type RingPoint = Point & { id: string };

/**
 * The ring whose centre is nearest the pointer, if it is within
 * `RING_HIT_PX`. The caller passes only rings on the visible side of the
 * globe. On a tie the first one wins.
 */
export const nearestRing = (rings: readonly RingPoint[], pointer: Point): string | null => {
  let best: string | null = null;
  let bestDistance = RING_HIT_PX;
  for (const ring of rings) {
    const distance = Math.hypot(ring.x - pointer.x, ring.y - pointer.y);
    if (distance < bestDistance || (best === null && distance === bestDistance)) {
      best = ring.id;
      bestDistance = distance;
    }
  }
  return best;
};
