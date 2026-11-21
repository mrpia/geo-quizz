import raw from '../data/world.json?raw';
import { parseWorld, type WorldTopology } from '../domain/world';
import {
  combine,
  outlinePath,
  prepareOutline,
  projectPoint,
  toCartesian,
  type OutlineCamera,
} from '../domain/outline';
import { isWithinHorizon, type LngLat } from '../domain/view';

const world = parseWorld(JSON.parse(raw) as WorldTopology);

// An identity "projection" seen from 10 units out on +z: clip space is the
// scene itself, so a point (x, y) lands at ((x + 1) / 2 · w, (1 − y) / 2 · h).
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const flat: OutlineCamera = { matrix: IDENTITY, position: [0, 0, 10] };

/** The points of an SVG path, one array per `M` run. */
const runs = (d: string): number[][][] =>
  d
    .split('M')
    .filter(Boolean)
    .map((run) => run.split('L').map((p) => p.trim().split(' ').map(Number)));

describe('placing a point the way three-globe does', () => {
  // three-globe 2.45.6, `polar2Cartesian`: y is the polar axis, and lng 0 on
  // the equator faces +z.
  it.each([
    [[0, 0], [0, 0, 100]],
    [[90, 0], [100, 0, 0]],
    [[0, 90], [0, 100, 0]],
    [[180, 0], [0, 0, -100]],
  ] as const)('puts %j at %j', (point, expected) => {
    const [x, y, z] = toCartesian(point, 100);
    expect(x).toBeCloseTo(expected[0], 9);
    expect(y).toBeCloseTo(expected[1], 9);
    expect(z).toBeCloseTo(expected[2], 9);
  });
});

describe('combining the camera matrices', () => {
  // Column-major, like three.js's Matrix4.elements.
  const translate = (x: number, y: number, z: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const scale = (k: number) => [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1];

  it('leaves a matrix alone when combined with the identity', () => {
    const m = translate(1, 2, 3);
    expect(combine(IDENTITY, m)).toEqual(m);
    expect(combine(m, IDENTITY)).toEqual(m);
  });

  it('applies the view first, then the projection', () => {
    // Scale after translating: the translation is scaled too.
    expect(combine(scale(2), translate(1, 2, 3))).toEqual([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 2, 4, 6, 1]);
    // Translate after scaling: it is not.
    expect(combine(translate(1, 2, 3), scale(2))).toEqual([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 1, 2, 3, 1]);
  });
});

describe('the outline path', () => {
  const square = (lng: number, lat: number, half: number): LngLat[] => [
    [lng - half, lat - half],
    [lng + half, lat - half],
    [lng + half, lat + half],
    [lng - half, lat + half],
    [lng - half, lat - half],
  ];
  const shapeOf = (...rings: LngLat[][]) =>
    prepareOutline({ type: 'Polygon', coordinates: rings.map((r) => r.map(([a, b]) => [a, b])) }, 1);

  it('draws a ring facing the camera as one closed run', () => {
    const d = outlinePath(shapeOf(square(0, 0, 10)), flat, 1000, 600);
    const [run, ...rest] = runs(d);
    expect(rest).toEqual([]);
    expect(run).toHaveLength(5);
    expect(run[0]).toEqual(run[4]);
    // Centred on the screen, as [0, 0] faces the camera.
    const xs = run.map(([x]) => x);
    const ys = run.map(([, y]) => y);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(500, 0);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(300, 0);
  });

  it('draws nothing for a ring behind the globe', () => {
    expect(outlinePath(shapeOf(square(180, 0, 10)), flat, 1000, 600)).toBe('');
  });

  it('lifts the pen where a ring goes behind the horizon', () => {
    // From 10 radii out the horizon is acos(1/10) ≈ 84.3° from the centre.
    // A band from 60° to 100° east, crossing it twice.
    const out: LngLat[] = [60, 70, 80, 90, 100].map((lng) => [lng, -5]);
    const back: LngLat[] = [100, 90, 80, 70, 60].map((lng) => [lng, 5]);
    const d = outlinePath(shapeOf([...out, ...back, [60, -5]]), flat, 1000, 600);
    // 90° and 100° are hidden, so the ring splits into the edge going out
    // and the edge coming back.
    const [going, coming, ...rest] = runs(d);
    expect(rest).toEqual([]);
    expect(going).toHaveLength(3);
    expect(coming).toHaveLength(4);
  });

  it('keeps the same points as the horizon test the rings use', () => {
    // A camera on +z at 10 radii is the view over [0, 0] at altitude 9.
    const view = { lat: 0, lng: 0, altitude: 9 };
    const points: LngLat[] = [];
    for (let lng = -100; lng <= 100; lng += 2) points.push([lng, 30]);
    const shape = prepareOutline({ type: 'Polygon', coordinates: [points.map(([a, b]) => [a, b])] }, 1);
    const drawn = runs(outlinePath(shape, flat, 1000, 600)).flat().length;
    expect(drawn).toBe(points.filter((p) => isWithinHorizon(view, p)).length);
  });

  it('skips points less than a pixel from the last one drawn, but keeps the end of a run', () => {
    const ring: LngLat[] = [
      [0, 0],
      [0.001, 0],
      [0.002, 0],
      [10, 0],
      [10.001, 0],
    ];
    const run = runs(outlinePath(shapeOf(ring), flat, 1000, 600))[0];
    expect(run).toHaveLength(3);
    expect(run[2][0]).toBeCloseTo(run[1][0], 0);
  });

  it('draws every polygon of a MultiPolygon, holes included', () => {
    const shape = prepareOutline(
      {
        type: 'MultiPolygon',
        coordinates: [
          [square(0, 0, 10), square(0, 0, 2)],
          [square(30, 0, 5)],
        ].map((polygon) => polygon.map((r) => r.map(([a, b]) => [a, b]))),
      },
      1,
    );
    expect(shape.rings).toHaveLength(3);
    expect(runs(outlinePath(shape, flat, 1000, 600))).toHaveLength(3);
  });

  it('draws a real country', () => {
    // Switzerland, seen from straight above it.
    const che = world.byId.get('CHE')!;
    const shape = prepareOutline(che.geometry, 1);
    const [lng, lat] = che.properties.anchor;
    // Turn the scene so the anchor faces +z: rotate by −lng about y, then
    // by lat about x. Column-major, like three.js's Matrix4.elements.
    const a = (-lng * Math.PI) / 180;
    const b = (lat * Math.PI) / 180;
    const [ca, sa, cb, sb] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)];
    const turn = [ca, sa * sb, -sa * cb, 0, 0, cb, sb, 0, sa, -ca * sb, ca * cb, 0, 0, 0, 0, 1];
    const [cx, cy, cz] = toCartesian([lng, lat], 10);
    const d = outlinePath(shape, { matrix: turn, position: [cx, cy, cz] }, 1000, 600);
    expect(runs(d)).toHaveLength(1);
    const xs = runs(d)[0].map(([x]) => x);
    // About 4° of longitude wide, on a unit sphere spread over 1000 px.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(20);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(60);
  });
});

describe('placing a single point on screen', () => {
  // Where the ✅ and ❌ marks go: a country's anchor.
  it('projects a point facing the camera like the outline does', () => {
    const point = toCartesian([10, 20], 1);
    const p = projectPoint(point, 1, flat, 1000, 600);
    const [run] = runs(outlinePath(prepareOutline({ type: 'Polygon', coordinates: [[[10, 20], [10, 20]]] }, 1), flat, 1000, 600));
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(run[0][0], 0);
    expect(p!.y).toBeCloseTo(run[0][1], 0);
  });

  it('returns null for a point behind the horizon', () => {
    expect(projectPoint(toCartesian([180, 0], 1), 1, flat, 1000, 600)).toBeNull();
    expect(projectPoint(toCartesian([90, 0], 1), 1, flat, 1000, 600)).toBeNull();
  });
});
