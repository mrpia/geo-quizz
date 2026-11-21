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
