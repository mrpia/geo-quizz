import type { Continent } from './world';

/**
 * A camera position in globe.gl's `pointOfView` units: the point under the
 * camera, and its distance from the surface in globe radii. globe.gl puts the
 * camera at `GLOBE_RADIUS * (1 + altitude)` from the centre (three-globe
 * 2.45.6, `polar2Cartesian`) and keeps it looking at the centre.
 */
export type View = { lat: number; lng: number; altitude: number };

/** `[lng, lat]`, in the GeoJSON order the data uses for `anchor`. */
export type LngLat = readonly [number, number];

/**
 * Where each continent's round starts. Set by hand, not fitted to the data:
 * a fit to every country is dragged off the mainland by remote islands
 * (Heard Island and the French Southern Lands are in Africa, Pitcairn in
 * Oceania). Chosen so the mainland fills a landscape tablet's globe area
 * (about 1180 × 700 px below the header) and no anchor sits within 3° of the
 * horizon either way. Check them on the tablet in Phase 2.
 */
export const CONTINENT_VIEWS: Record<Continent, View> = {
  europe: { lat: 52, lng: 15, altitude: 0.9 },
  africa: { lat: 2, lng: 15, altitude: 1.4 },
  asia: { lat: 25, lng: 90, altitude: 1.4 },
  'north-america': { lat: 45, lng: -95, altitude: 1.7 },
  'south-america': { lat: -20, lng: -60, altitude: 1.4 },
  oceania: { lat: -18, lng: 155, altitude: 1.5 },
};

/**
 * The countries whose anchor is behind the horizon at their continent's
 * view: the player rotates the globe to reach them. A test fails if one of
 * these becomes visible or another country becomes hidden, so the list
 * always matches the views above.
 */
export const BEYOND_HORIZON: Record<Continent, readonly string[]> = {
  europe: [],
  // French Southern and Antarctic Lands, Heard Island and McDonald Islands.
  africa: ['ATF', 'HMD'],
  asia: [],
  'north-america': [],
  'south-america': [],
  // Pitcairn Islands.
  oceania: ['PCN'],
};

const RAD = Math.PI / 180;

/** Great-circle distance between two `[lng, lat]` points, in degrees. */
export const angularDistanceDeg = ([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number => {
  // Haversine: stays accurate for short distances, unlike acos of a dot product.
  const h =
    Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lng2 - lng1) * RAD) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / RAD;
};

/**
 * How far from the point under the camera the horizon lies, in degrees of
 * arc. From a distance `1 + altitude` (in radii) the line of sight grazes the
 * sphere where `cos θ = 1 / (1 + altitude)`.
 */
export const horizonDeg = (altitude: number): number => Math.acos(1 / (1 + altitude)) / RAD;

/**
 * Whether the camera can see the point at all: on its side of the horizon.
 * Says nothing about the screen edges, which depend on the viewport.
 */
export const isWithinHorizon = (view: View, point: LngLat): boolean =>
  angularDistanceDeg([view.lng, view.lat], point) < horizonDeg(view.altitude);

/**
 * Vertical field of view of globe.gl's camera, in degrees. Read from the
 * published sources, not the installed package (globe.gl arrives in Phase 2):
 * globe.gl 2.46.2 depends on three-render-objects ^1.41, which creates the
 * camera as `new three.PerspectiveCamera()` (dist/three-render-objects.mjs,
 * `stateInit`, in 1.41.0 and in 1.45.0, the latest match on 2026-11-21) and
 * never sets `fov` again; three.js 0.187.0 defaults it to 50
 * (src/cameras/PerspectiveCamera.js, `constructor( fov = 50, … )`).
 * Phase 2 must check this against `camera().fov` of the installed globe.
 */
export const GLOBE_VFOV_DEG = 50;

/** Below this on-screen diameter a country gets a tap ring (plan, Phase 1). */
export const TAP_RING_MIN_PX = 24;

/** The radius `tools/build-data.mjs` computes `areaKm2` with. */
const EARTH_RADIUS_KM = 6371.0088;

/**
 * Estimated on-screen diameter of a country, in CSS pixels, as if it were a
 * disc of the same area at the centre of the view. Small-angle estimate:
 * the disc's diameter in radians of arc, seen from `altitude` radii away,
 * times the camera's focal length in pixels, `(H / 2) / tan(vfov / 2)`.
 *
 * Good enough for a yes/no at 24 px. It overstates large countries (no
 * perspective, no curvature) and countries away from the centre (they are
 * seen at a slant), which errs toward no ring near the horizon.
 */
export const screenDiameterPx = (
  areaKm2: number,
  altitude: number,
  viewportHeightPx: number,
): number => {
  if (!(areaKm2 >= 0 && Number.isFinite(areaKm2))) {
    throw new RangeError(`screenDiameterPx: bad area ${areaKm2}`);
  }
  if (!(altitude > 0 && Number.isFinite(altitude))) {
    throw new RangeError(`screenDiameterPx: bad altitude ${altitude}`);
  }
  if (!(viewportHeightPx > 0 && Number.isFinite(viewportHeightPx))) {
    throw new RangeError(`screenDiameterPx: bad viewport height ${viewportHeightPx}`);
  }
  const diameterRad = (2 * Math.sqrt(areaKm2 / Math.PI)) / EARTH_RADIUS_KM;
  const focalPx = viewportHeightPx / 2 / Math.tan((GLOBE_VFOV_DEG / 2) * RAD);
  return (diameterRad * focalPx) / altitude;
};

/** Whether a country is too small to hit with a finger at this zoom. */
export const needsTapRing = (
  areaKm2: number,
  altitude: number,
  viewportHeightPx: number,
): boolean => screenDiameterPx(areaKm2, altitude, viewportHeightPx) < TAP_RING_MIN_PX;
