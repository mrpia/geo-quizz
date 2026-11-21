import raw from '../data/world.json?raw';
import { parseWorld, type WorldTopology } from '../domain/world';
import {
  ALTITUDE,
  HOVER_COLOR,
  MAP_PALETTE,
  OTHER_LAND_COLOR,
  RIGHT_COLOR,
  WRONG_COLOR,
  capColorOf,
  type GlobeHighlight,
} from '../components/globeLook';

const world = parseWorld(JSON.parse(raw) as WorldTopology);
const country = (id: string) => {
  const c = world.byId.get(id);
  if (!c) throw new Error(id);
  return c;
};

const NONE: GlobeHighlight = {
  pickedId: null,
  correctId: null,
  pickedColor: WRONG_COLOR,
  correctColor: RIGHT_COLOR,
};

/** Hue in degrees, saturation and lightness in 0–1, from `#rrggbb`. */
const hsl = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h =
    d === 0 ? 0 : max === r ? (60 * ((g - b) / d) + 360) % 360 : max === g ? 60 * ((b - r) / d) + 120 : 60 * ((r - g) / d) + 240;
  return { h, s, l };
};

// The owner's look of 2026-11-21: the continent in shades of pink, other
// land grey, the country under the mouse amber, and green and red kept for
// the right answer and a wrong pick.
describe('cap colours', () => {
  it('has seven distinct shades of pink, one per MAPCOLOR7 value', () => {
    expect(MAP_PALETTE).toHaveLength(7);
    expect(new Set(MAP_PALETTE).size).toBe(7);
    for (const color of MAP_PALETTE) {
      const { h, s } = hsl(color);
      expect(h, color).toBeGreaterThanOrEqual(310);
      expect(h, color).toBeLessThanOrEqual(355);
      expect(s, color).toBeGreaterThan(0.3);
    }
  });

  it('keeps grey, amber, green and red out of the pinks', () => {
    expect(hsl(OTHER_LAND_COLOR).s).toBeLessThan(0.15);
    const { h } = hsl(HOVER_COLOR);
    expect(h).toBeGreaterThan(30);
    expect(h).toBeLessThan(50);
    for (const color of [OTHER_LAND_COLOR, HOVER_COLOR, RIGHT_COLOR, WRONG_COLOR]) {
      expect(MAP_PALETTE).not.toContain(color);
    }
  });

  it("colours the continent's countries by MAPCOLOR7 and the rest grey", () => {
    const fra = country('FRA');
    expect(capColorOf(fra, true, null, NONE)).toBe(MAP_PALETTE[fra.properties.color - 1]);
    expect(capColorOf(country('BRA'), false, null, NONE)).toBe(OTHER_LAND_COLOR);
  });

  it('gives neighbours different colours', () => {
    // MAPCOLOR7 is chosen upstream so that neighbours differ.
    const pairs = [
      ['FRA', 'DEU'],
      ['FRA', 'ESP'],
      ['DEU', 'POL'],
      ['CHE', 'ITA'],
    ];
    for (const [a, b] of pairs) {
      expect(capColorOf(country(a), true, null, NONE), `${a}/${b}`).not.toBe(
        capColorOf(country(b), true, null, NONE),
      );
    }
  });

  it('turns the country under the mouse amber, only when it can be picked', () => {
    expect(capColorOf(country('FRA'), true, 'FRA', NONE)).toBe(HOVER_COLOR);
    expect(capColorOf(country('DEU'), true, 'FRA', NONE)).not.toBe(HOVER_COLOR);
    expect(capColorOf(country('BRA'), false, 'BRA', NONE)).toBe(OTHER_LAND_COLOR);
  });

  it('paints the picked and the correct country in their highlight colours, over hover', () => {
    const highlight = { ...NONE, pickedId: 'DEU', correctId: 'FRA' };
    expect(capColorOf(country('DEU'), true, 'DEU', highlight)).toBe(WRONG_COLOR);
    expect(capColorOf(country('FRA'), true, 'FRA', highlight)).toBe(RIGHT_COLOR);
    expect(capColorOf(country('ESP'), true, null, highlight)).toBe(capColorOf(country('ESP'), true, null, NONE));
  });

  it('shows a right answer in the correct colour', () => {
    const highlight = { ...NONE, pickedId: 'FRA', correctId: 'FRA' };
    expect(capColorOf(country('FRA'), true, null, highlight)).toBe(RIGHT_COLOR);
  });

  it('refuses a MAPCOLOR7 value outside 1–7', () => {
    const fra = country('FRA');
    for (const color of [0, 8, 2.5, Number.NaN]) {
      const broken = { ...fra, properties: { ...fra.properties, color } };
      expect(() => capColorOf(broken, true, null, NONE)).toThrow(/MAPCOLOR7/);
    }
  });
});

describe('altitude', () => {
  it('keeps every country at one low altitude: nothing rises', () => {
    // The owner's call of 2026-11-21: no raise for hover, answers or picks.
    expect(Object.keys(ALTITUDE)).toEqual(['base']);
    expect(ALTITUDE.base).toBeLessThanOrEqual(0.01);
  });
});
