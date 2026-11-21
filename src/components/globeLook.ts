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

/**
 * One cap colour per Natural Earth MAPCOLOR7 value, 1 to 7 (index = value −
 * 1); upstream chose the values so that neighbours never share one. Seven
 * soft pinks (the owner's choice, 2026-11-21), picked by a search for the
 * largest gap: every pair is at least 14 apart in CIE76 ΔE (5 is easy to
 * see), and each is at least 40 from the red of a wrong pick.
 */
export const MAP_PALETTE: readonly string[] = [
  '#f6d5da',
  '#ebadd1',
  '#ed97d0',
  '#ec79cf',
  '#c87ea3',
  '#cd7a88',
  '#df6899',
];

/** The country under the mouse, while it can be picked: amber, and outlined. */
export const HOVER_COLOR = '#f59e0b';

/**
 * Polygon altitude in globe radii (globe.gl's unit). Low, so borders line up
 * with the sphere when seen at a slant, and the same for every country:
 * nothing rises, for hover, the answer or a pick (the owner's call,
 * 2026-11-21). A raise cannot be seen from straight above, where the camera
 * puts the answer; outlines and the ✅ and ❌ marks do that job. It stays
 * below GlobeView's closest zoom (0.02), or a camera zoomed right in would
 * end up inside a country.
 */
export const ALTITUDE = {
  base: 0.005,
} as const;

/**
 * The answer, and a wrong pick. The same values as `--color-success` and
 * `--color-error` in global.css. Never the only cue: the answer is also
 * outlined and marked ✅, a wrong pick marked ❌, and the header and the
 * results say ✅ or ❌ (plan, Phase 3).
 */
export const RIGHT_COLOR = '#22c55e';
export const WRONG_COLOR = '#ef4444';

/** What the game shows after a tap or a timeout. */
export type GlobeHighlight = {
  /** The country the player tapped, drawn in `pickedColor`. */
  pickedId: string | null;
  /**
   * The answer, drawn in `correctColor`, outlined and marked ✅, and flown to
   * when it is out of frame. Wins when it is also the pick, which is then
   * not marked ❌.
   */
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

/**
 * A country's cap colour. The answer and a wrong pick win over hover, which
 * only applies to the continent's countries (the only ones a tap can pick).
 */
export const capColorOf = (
  country: Country,
  inPlay: boolean,
  hoverId: string | null,
  highlight: GlobeHighlight,
): string => {
  if (country.id === highlight.correctId) return highlight.correctColor;
  if (country.id === highlight.pickedId) return highlight.pickedColor;
  if (!inPlay) return OTHER_LAND_COLOR;
  if (country.id === hoverId) return HOVER_COLOR;
  const color = MAP_PALETTE[country.properties.color - 1];
  if (color === undefined) {
    throw new Error(`globe: ${country.id} has MAPCOLOR7 ${country.properties.color}, not 1–7`);
  }
  return color;
};
