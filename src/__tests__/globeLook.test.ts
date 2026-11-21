import raw from '../data/world.json?raw';
import { parseWorld, type WorldTopology } from '../domain/world';
import {
  ALTITUDE,
  MAP_PALETTE,
  OTHER_LAND_COLOR,
  SIDE_COLOR,
  capColorOf,
  polygonAltitudeOf,
  sideColorOf,
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
  pickedColor: '#ff0000',
  correctColor: '#00ff00',
};

describe('cap colours', () => {
  it('has one distinct colour per MAPCOLOR7 value', () => {
    expect(MAP_PALETTE).toHaveLength(7);
    expect(new Set(MAP_PALETTE).size).toBe(7);
    expect(MAP_PALETTE).not.toContain(OTHER_LAND_COLOR);
  });

  it("colours the continent's countries by MAPCOLOR7 and the rest grey", () => {
    const fra = country('FRA');
    expect(capColorOf(fra, true, NONE)).toBe(MAP_PALETTE[fra.properties.color - 1]);
    expect(capColorOf(country('BRA'), false, NONE)).toBe(OTHER_LAND_COLOR);
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
      expect(capColorOf(country(a), true, NONE), `${a}/${b}`).not.toBe(
        capColorOf(country(b), true, NONE),
      );
    }
  });

  it('paints the picked and the correct country in their highlight colours', () => {
    const highlight = { ...NONE, pickedId: 'DEU', correctId: 'FRA' };
    expect(capColorOf(country('DEU'), true, highlight)).toBe('#ff0000');
    expect(capColorOf(country('FRA'), true, highlight)).toBe('#00ff00');
    expect(capColorOf(country('ESP'), true, highlight)).toBe(capColorOf(country('ESP'), true, NONE));
  });

  it('shows a right answer in the correct colour', () => {
    const highlight = { ...NONE, pickedId: 'FRA', correctId: 'FRA' };
    expect(capColorOf(country('FRA'), true, highlight)).toBe('#00ff00');
  });

  it('refuses a MAPCOLOR7 value outside 1–7', () => {
    const fra = country('FRA');
    for (const color of [0, 8, 2.5, Number.NaN]) {
      const broken = { ...fra, properties: { ...fra.properties, color } };
      expect(() => capColorOf(broken, true, NONE)).toThrow(/MAPCOLOR7/);
    }
  });
});

describe('polygon altitudes', () => {
  it('keeps all land low by default', () => {
    expect(ALTITUDE.base).toBeLessThanOrEqual(0.01);
    expect(polygonAltitudeOf(country('FRA'), true, null, NONE)).toBe(ALTITUDE.base);
    expect(polygonAltitudeOf(country('BRA'), false, null, NONE)).toBe(ALTITUDE.base);
  });

  it('raises the hovered country only when it can be picked', () => {
    expect(polygonAltitudeOf(country('FRA'), true, 'FRA', NONE)).toBe(ALTITUDE.hover);
    expect(polygonAltitudeOf(country('DEU'), true, 'FRA', NONE)).toBe(ALTITUDE.base);
    expect(polygonAltitudeOf(country('BRA'), false, 'BRA', NONE)).toBe(ALTITUDE.base);
    expect(ALTITUDE.hover).toBeGreaterThan(ALTITUDE.base);
  });

  it('leaves the answer and the pick flat, even under the mouse', () => {
    // The owner's call on 2026-11-21: a raise cannot be seen from straight
    // above, where the camera puts the answer, so the answer gets an outline
    // instead (src/domain/outline.ts), drawn at the base altitude.
    const highlight = { ...NONE, pickedId: 'DEU', correctId: 'FRA' };
    expect(polygonAltitudeOf(country('DEU'), true, null, highlight)).toBe(ALTITUDE.base);
    expect(polygonAltitudeOf(country('FRA'), true, null, highlight)).toBe(ALTITUDE.base);
    expect(polygonAltitudeOf(country('FRA'), true, 'FRA', highlight)).toBe(ALTITUDE.base);
    expect(polygonAltitudeOf(country('DEU'), true, 'DEU', highlight)).toBe(ALTITUDE.base);
    expect(polygonAltitudeOf(country('ESP'), true, 'ESP', highlight)).toBe(ALTITUDE.hover);
  });
});

describe('side walls', () => {
  it('builds walls only under a raised country', () => {
    // Walls for every edge of all 1,620 shapes took a SwiftShader frame from
    // 319 ms to 2,280 ms (2026-11-21), and at the base altitude nobody sees them.
    expect(sideColorOf(ALTITUDE.base)).toBe('');
    expect(sideColorOf(ALTITUDE.hover)).toBe(SIDE_COLOR);
  });
});
