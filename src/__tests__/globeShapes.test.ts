import raw from '../data/world.json?raw';
import { parseWorld, type WorldTopology } from '../domain/world';
import { countDrawnShapes, shapeCount, type SceneTree } from '../components/globeShapes';

const world = parseWorld(JSON.parse(raw) as WorldTopology);

/** A scene shaped like three.js's, with `traverse` visiting every object. */
const tree = (objects: object[]): SceneTree => ({
  traverse: (visit) => objects.forEach(visit),
});
const built = () => ({ __globeObjType: 'polygon', children: [{ geometry: { attributes: { position: {} } } }] });
const empty = () => ({ __globeObjType: 'polygon', children: [{ geometry: { attributes: {} } }] });

describe('how many shapes the globe builds', () => {
  it('counts one per polygon, and one per part of a multipolygon', () => {
    // three-globe 2.45.6 makes one object per part (`singlePolygons`).
    expect(shapeCount(world.countries)).toBe(1_620);
    const fra = world.byId.get('FRA')!;
    expect(fra.geometry.type).toBe('MultiPolygon');
    expect(shapeCount([fra])).toBe(fra.geometry.coordinates.length);
  });
});

describe('counting the shapes in the scene', () => {
  it('counts the polygon objects whose geometry is built', () => {
    expect(countDrawnShapes(tree([built(), built(), empty()]))).toBe(2);
  });

  it('ignores every other object', () => {
    const sphere = { __globeObjType: 'globe', children: [{ geometry: { attributes: { position: {} } } }] };
    expect(countDrawnShapes(tree([sphere, {}, { children: [] }, built()]))).toBe(1);
  });
});
