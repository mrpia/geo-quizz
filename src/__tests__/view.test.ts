import raw from '../data/world.json?raw';
import { AREAS, parseWorld, quizPool, type WorldTopology } from '../domain/world';
import {
  BEYOND_HORIZON,
  CONTINENT_VIEWS,
  FRAME_MARGIN_PX,
  GLOBE_VFOV_DEG,
  TAP_RING_MIN_PX,
  angularDistanceDeg,
  horizonDeg,
  isInFrame,
  isWithinHorizon,
  needsTapRing,
  screenDiameterPx,
  viewOver,
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

// The oceans (plan, Phase 7) have a view of their own, like a continent.
describe('continent views', () => {
  it('has one view per continent and one for the oceans, in pointOfView units', () => {
    expect(Object.keys(CONTINENT_VIEWS).sort()).toEqual([...AREAS].sort());
    for (const continent of AREAS) {
      const { lat, lng, altitude } = CONTINENT_VIEWS[continent];
      expect(Math.abs(lat), continent).toBeLessThanOrEqual(90);
      expect(Math.abs(lng), continent).toBeLessThanOrEqual(180);
      expect(altitude, continent).toBeGreaterThan(0);
    }
  });

  it('lists only countries of the continent as beyond the horizon', () => {
    for (const continent of AREAS) {
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
  it.each(AREAS)(
    'shows every %s country at the start, except the listed remote islands',
    (continent) => {
      const view = CONTINENT_VIEWS[continent];
      // Every place a round there can ask: the tiny ones and the seas too.
      const hidden = quizPool(world, continent, { skipTiny: false, includeSeas: true })
        .filter((c) => !isWithinHorizon(view, c.properties.anchor))
        .map((c) => c.id)
        .sort();
      expect(hidden).toEqual([...BEYOND_HORIZON[continent]].sort());
    },
  );

  it('shows the whole globe for the oceans, Africa in the middle', () => {
    expect(CONTINENT_VIEWS.oceans).toEqual({ lat: 0, lng: 20, altitude: 2.2 });
    // No view shows all five: the Pacific and the Arctic are a turn away.
    expect(BEYOND_HORIZON.oceans.slice(0, 2)).toEqual(['pacific', 'arctic']);
    // With the seas, 9 of the 24 face the camera at the start.
    expect(BEYOND_HORIZON.oceans.slice(2)).toHaveLength(15);
  });
});

describe('tap rings', () => {
  const R_KM = 6371.0088; // the radius tools/build-data.mjs computes areaKm2 with
  const H = 700;
  /** The area of a round country whose diameter is `arcRad` radians of arc. */
  const areaOfArc = (arcRad: number) => Math.PI * ((arcRad * R_KM) / 2) ** 2;

  it("uses globe.gl's vertical field of view of 50°", () => {
    // three-render-objects builds globe.gl's camera as `new PerspectiveCamera()`,
    // and three.js defaults `fov` to 50 (vertical, in degrees).
    expect(GLOBE_VFOV_DEG).toBe(50);
    // What that means: from `altitude` above the surface, an arc of
    // 2 · altitude · tan(25°) radians at the view centre spans the full height.
    for (const altitude of [0.5, 1, 2.5]) {
      const fillsHeight = areaOfArc(2 * altitude * Math.tan((25 * Math.PI) / 180));
      expect(screenDiameterPx(fillsHeight, altitude, H)).toBeCloseTo(H, 6);
    }
  });

  it('scales with zoom, viewport height and country size', () => {
    const base = screenDiameterPx(10_000, 1.2, H);
    expect(screenDiameterPx(10_000, 0.6, H)).toBeCloseTo(2 * base);
    expect(screenDiameterPx(10_000, 1.2, 2 * H)).toBeCloseTo(2 * base);
    expect(screenDiameterPx(40_000, 1.2, H)).toBeCloseTo(2 * base);
  });

  it('rings a country smaller than 24 px', () => {
    expect(TAP_RING_MIN_PX).toBe(24);
    const altitude = 1.4;
    // The area that comes out at exactly 24 px.
    const limit = 10_000 * (24 / screenDiameterPx(10_000, altitude, H)) ** 2;
    expect(screenDiameterPx(limit, altitude, H)).toBeCloseTo(24, 6);
    expect(needsTapRing(limit * 0.99, altitude, H)).toBe(true);
    expect(needsTapRing(limit * 1.01, altitude, H)).toBe(false);
  });

  it("rings Luxembourg but not France at globe.gl's starting altitude", () => {
    const area = (id: string) => world.byId.get(id)?.properties.areaKm2 ?? Number.NaN;
    expect(needsTapRing(area('LUX'), 2.5, H)).toBe(true);
    expect(needsTapRing(area('FRA'), 2.5, H)).toBe(false);
    // Zoomed in far enough, Luxembourg is big enough to tap.
    expect(needsTapRing(area('LUX'), 0.1, H)).toBe(false);
  });

  it.each([
    [-1, 1, H],
    [Number.NaN, 1, H],
    [100, 0, H],
    [100, -1, H],
    [100, 1, 0],
    [100, Infinity, H],
  ])('refuses area %s km², altitude %s, height %s px', (area, altitude, height) => {
    expect(() => needsTapRing(area, altitude, height)).toThrow(RangeError);
  });
});

// Plan, Phase 3: after a wrong tap or a timeout, "if the target is off-screen
// the camera flies to it".
describe('showing the answer', () => {
  const size = { width: 1000, height: 600 };

  it('counts a point inside the canvas, clear of the edges, as in frame', () => {
    expect(isInFrame({ x: 500, y: 300 }, size)).toBe(true);
    expect(isInFrame({ x: FRAME_MARGIN_PX, y: FRAME_MARGIN_PX }, size)).toBe(true);
    expect(isInFrame({ x: 1000 - FRAME_MARGIN_PX, y: 600 - FRAME_MARGIN_PX }, size)).toBe(true);
  });

  it('counts a point outside the canvas or hugging its edge as out of frame', () => {
    expect(isInFrame({ x: -20, y: 300 }, size)).toBe(false);
    expect(isInFrame({ x: 500, y: 640 }, size)).toBe(false);
    expect(isInFrame({ x: FRAME_MARGIN_PX - 1, y: 300 }, size)).toBe(false);
    expect(isInFrame({ x: 500, y: 600 - FRAME_MARGIN_PX + 1 }, size)).toBe(false);
  });

  it('counts a point behind the globe as out of frame', () => {
    expect(isInFrame(null, size)).toBe(false);
  });

  it('keeps a margin of about a fingertip', () => {
    expect(FRAME_MARGIN_PX).toBe(48);
  });

  it('flies over the answer at the altitude the player chose', () => {
    // The camera does not reset between questions, so a player who zoomed in
    // stays zoomed in (plan, Phase 3).
    expect(viewOver([-17.4, 14.7], { lat: 2, lng: 15, altitude: 0.3 })).toEqual({
      lat: 14.7,
      lng: -17.4,
      altitude: 0.3,
    });
  });
});
