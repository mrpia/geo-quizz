import type { Country } from '../domain/world';

/**
 * How the globe looks, as data: GlobeView hands these to globe.gl's
 * accessors. No image textures anywhere (plan, Phase 2 item 3): the app
 * works offline and fetches nothing but its own data file.
 */

/** Same as `--color-ocean` in `src/styles/global.css`. */
export const OCEAN_COLOR = '#0b3d5c';
/** Behind the globe. The atmosphere glow needs a dark background to show. */
export const SPACE_COLOR = '#0f172a';
/** Land outside the round's continent: drawn, but not part of the game. */
export const OTHER_LAND_COLOR = '#7c8591';
export const BORDER_COLOR = '#1e293b';
/** The walls of a raised country; darker than any cap so the step shows. */
export const SIDE_COLOR = 'rgba(15, 23, 42, 0.75)';

/**
 * One cap colour per Natural Earth MAPCOLOR7 value, 1 to 7 (index = value −
 * 1); upstream chose the values so that neighbours never share one. Light,
 * muted tones that stand out on the dark ocean and against the dark borders.
 * No green and no red: Phase 3 uses those two for right and wrong answers.
 */
export const MAP_PALETTE: readonly string[] = [
  '#f6d58e', // yellow
  '#f7b183', // orange
  '#e8a3c4', // pink
  '#b7a3e0', // violet
  '#8ec5ea', // blue
  '#86cfc4', // teal
  '#d8c09a', // sand
];

/**
 * Polygon altitudes in globe radii (globe.gl's unit). The base is low, so
 * borders line up with the sphere when seen at a slant. A wrong pick rises a
 * little, the right answer more: Phase 3 must never tell them apart by
 * colour alone, so height has to differ too. All of them stay below
 * GlobeView's closest zoom (0.02), or a camera zoomed right in over the
 * answer would end up inside it.
 */
export const ALTITUDE = {
  base: 0.005,
  hover: 0.01,
  picked: 0.01,
  correct: 0.015,
} as const;

/** What the game wants shown after a tap (Phase 3 sets it; Phase 2 never does). */
export type GlobeHighlight = {
  /** The country the player tapped, drawn in `pickedColor`. */
  pickedId: string | null;
  /** The answer, drawn in `correctColor` and raised highest. Wins when it is also the pick. */
  correctId: string | null;
  pickedColor: string;
  correctColor: string;
};

export const NO_HIGHLIGHT: GlobeHighlight = {
  pickedId: null,
  correctId: null,
  pickedColor: 'transparent',
  correctColor: 'transparent',
};

export const capColorOf = (
  country: Country,
  inPlay: boolean,
  highlight: GlobeHighlight,
): string => {
  if (country.id === highlight.correctId) return highlight.correctColor;
  if (country.id === highlight.pickedId) return highlight.pickedColor;
  if (!inPlay) return OTHER_LAND_COLOR;
  const color = MAP_PALETTE[country.properties.color - 1];
  if (color === undefined) {
    throw new Error(`globe: ${country.id} has MAPCOLOR7 ${country.properties.color}, not 1–7`);
  }
  return color;
};

export const polygonAltitudeOf = (
  country: Country,
  inPlay: boolean,
  hoverId: string | null,
  highlight: GlobeHighlight,
): number => {
  if (country.id === highlight.correctId) return ALTITUDE.correct;
  if (country.id === highlight.pickedId) return ALTITUDE.picked;
  if (inPlay && country.id === hoverId) return ALTITUDE.hover;
  return ALTITUDE.base;
};

/**
 * The colour of a country's walls, or '' for none: three-globe builds side
 * geometry only when this is truthy (`hasSide`, three-globe 2.45.6). Walls
 * under every edge of all 1,620 shapes made a SwiftShader frame seven times
 * slower (2,280 ms against 319 ms, measured 2026-11-21), and at the base
 * altitude they are too low to see. A country that rises gets its walls
 * rebuilt, one country at a time.
 */
export const sideColorOf = (altitude: number): string =>
  altitude > ALTITUDE.base ? SIDE_COLOR : '';
