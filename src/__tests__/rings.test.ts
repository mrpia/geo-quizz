import raw from '../data/world.json?raw';
import { countriesOf, parseWorld, quizPool, type WorldTopology } from '../domain/world';
import {
  RING_BULLSEYE_PX,
  RING_DIAMETER_PX,
  RING_HIT_PX,
  nearestRing,
  ringedIds,
} from '../domain/rings';
import { CONTINENT_VIEWS } from '../domain/view';

const world = parseWorld(JSON.parse(raw) as WorldTopology);
const europe = countriesOf(world, 'europe');

describe('which countries get a ring', () => {
  it('rings the microstates at the Europe view but not the large countries', () => {
    const ids = ringedIds(europe, CONTINENT_VIEWS.europe.altitude, 700);
    for (const id of ['VAT', 'MCO', 'SMR', 'LIE', 'AND', 'MLT', 'LUX']) expect(ids).toContain(id);
    for (const id of ['FRA', 'DEU', 'ESP', 'POL', 'RUS']) expect(ids).not.toContain(id);
  });

  it('drops a ring once the player has zoomed in far enough', () => {
    expect(ringedIds(europe, 2.5, 700)).toContain('LUX');
    expect(ringedIds(europe, 0.1, 700)).not.toContain('LUX');
    // The smallest one keeps its ring longer.
    expect(ringedIds(europe, 0.1, 700)).toContain('VAT');
  });

  it('only looks at the countries it is given', () => {
    // GlobeView passes the continent's countries, so no other continent gets rings.
    expect(ringedIds([], 1, 700)).toEqual([]);
    const ids = ringedIds(europe, 2.5, 700);
    expect(ids.every((id) => world.byId.get(id)?.properties.continent === 'europe')).toBe(true);
  });

  it('rings far fewer places at the Europe view without the tiny countries', () => {
    // The point of the switch (docs/plan.md, Phase 5), at the same 700 px
    // tall globe as the tests above.
    const { altitude } = CONTINENT_VIEWS.europe;
    expect(ringedIds(europe, altitude, 700)).toHaveLength(16);
    const ringed = ringedIds(quizPool(world, 'europe', { skipTiny: true }), altitude, 700);
    expect(ringed.sort()).toEqual(['FRO', 'KOS', 'LUX', 'MKD', 'MNE', 'SVN']);
  });

  it('draws rings bigger than a fingertip, with a hit area a little larger still', () => {
    expect(RING_DIAMETER_PX).toBe(44);
    expect(RING_HIT_PX).toBe(26);
  });

  it('keeps a bullseye well inside the drawn ring', () => {
    // The owner's rule of 2026-11-21: over a country big enough to tap, only
    // the bullseye of a ring beats it.
    expect(RING_BULLSEYE_PX).toBe(10);
    expect(RING_BULLSEYE_PX).toBeLessThan(RING_DIAMETER_PX / 2);
  });
});

describe('nearest ring', () => {
  const rings = [
    { id: 'VAT', x: 100, y: 100 },
    { id: 'SMR', x: 130, y: 100 },
  ];

  it('picks the ring under the pointer', () => {
    expect(nearestRing(rings, { x: 101, y: 99 })).toBe('VAT');
    expect(nearestRing(rings, { x: 128, y: 104 })).toBe('SMR');
  });

  it('picks the nearer of two overlapping rings', () => {
    expect(nearestRing(rings, { x: 114, y: 100 })).toBe('VAT');
    expect(nearestRing(rings, { x: 116, y: 100 })).toBe('SMR');
  });

  it('counts a pointer exactly 26 px away as a hit, and no further', () => {
    expect(nearestRing(rings, { x: 100, y: 126 })).toBe('VAT');
    expect(nearestRing(rings, { x: 100, y: 126.01 })).toBeNull();
    expect(nearestRing(rings, { x: 74, y: 100 })).toBe('VAT');
    expect(nearestRing(rings, { x: 73.9, y: 100 })).toBeNull();
  });

  it('reaches only as far as it is told', () => {
    expect(nearestRing(rings, { x: 100, y: 110 }, 10)).toBe('VAT');
    expect(nearestRing(rings, { x: 100, y: 110.01 }, 10)).toBeNull();
    expect(nearestRing(rings, { x: 100, y: 120 }, 10)).toBeNull();
  });

  it('finds nothing when there are no rings', () => {
    expect(nearestRing([], { x: 0, y: 0 })).toBeNull();
  });
});
