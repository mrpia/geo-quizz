import raw from '../data/world.json?raw';
import { CONTINENTS, countriesOf, parseWorld, type WorldTopology } from '../domain/world';
import {
  BEYOND_HORIZON,
  CONTINENT_VIEWS,
  angularDistanceDeg,
  horizonDeg,
  isWithinHorizon,
} from '../domain/view';

const world = parseWorld(JSON.parse(raw) as WorldTopology);

describe('horizon geometry', () => {
  it('measures great-circle distances in degrees', () => {
    expect(angularDistanceDeg([0, 0], [90, 0])).toBeCloseTo(90);
    expect(angularDistanceDeg([0, 0], [0, -45])).toBeCloseTo(45);
    expect(angularDistanceDeg([10, 20], [10, 20])).toBe(0);
    expect(angularDistanceDeg([0, 90], [123, 90])).toBeCloseTo(0);
    // Across the antimeridian: Fiji to Samoa is short.
    expect(angularDistanceDeg([179, -17], [-172, -14])).toBeLessThan(10);
  });

  it('puts the horizon at acos(1 / (1 + altitude))', () => {
    // From one radius above the surface the horizon is 60° away.
    expect(horizonDeg(1)).toBeCloseTo(60);
    expect(horizonDeg(2.5)).toBeCloseTo((Math.acos(1 / 3.5) * 180) / Math.PI);
    // It approaches a full hemisphere far away and shrinks to nothing up close.
    expect(horizonDeg(1000)).toBeGreaterThan(89.9);
    expect(horizonDeg(0.001)).toBeLessThan(3);
  });

  it('tells which points the camera can see', () => {
    const view = { lat: 0, lng: 0, altitude: 1 };
    expect(isWithinHorizon(view, [0, 0])).toBe(true);
    expect(isWithinHorizon(view, [59, 0])).toBe(true);
    expect(isWithinHorizon(view, [61, 0])).toBe(false);
    expect(isWithinHorizon(view, [180, 0])).toBe(false);
  });
});

describe('continent views', () => {
  it('has one view per continent, in pointOfView units', () => {
    expect(Object.keys(CONTINENT_VIEWS).sort()).toEqual([...CONTINENTS].sort());
    for (const continent of CONTINENTS) {
      const { lat, lng, altitude } = CONTINENT_VIEWS[continent];
      expect(Math.abs(lat), continent).toBeLessThanOrEqual(90);
      expect(Math.abs(lng), continent).toBeLessThanOrEqual(180);
      expect(altitude, continent).toBeGreaterThan(0);
    }
  });

  it('lists only countries of the continent as beyond the horizon', () => {
    for (const continent of CONTINENTS) {
      const listed = BEYOND_HORIZON[continent];
      expect(new Set(listed).size, continent).toBe(listed.length);
      for (const id of listed) {
        expect(world.byId.get(id)?.properties.continent, `${continent}: ${id}`).toBe(continent);
      }
    }
  });

  // Fails both ways: a country hidden at the start that nobody listed (a view
  // that cuts off part of the continent), and a listed island that is in fact
  // visible (a list that went stale when a view moved).
  it.each(CONTINENTS)(
    'shows every %s country at the start, except the listed remote islands',
    (continent) => {
      const view = CONTINENT_VIEWS[continent];
      const hidden = countriesOf(world, continent)
        .filter((c) => !isWithinHorizon(view, c.properties.anchor))
        .map((c) => c.id)
        .sort();
      expect(hidden).toEqual([...BEYOND_HORIZON[continent]].sort());
    },
  );
});
