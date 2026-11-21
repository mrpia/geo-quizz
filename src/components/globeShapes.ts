import type { Country } from '../domain/world';

/**
 * Whether globe.gl has built the countries yet. Its `onGlobeReady` only says
 * the sphere is there: the 1,620 shapes are built in one of its later
 * updates, all at once, after `polygonsData` is set. GlobeView counts them
 * in the scene, which leans on three-globe's internals (2.45.6, the polygons
 * layer): one object per polygon, and one per part of a MultiPolygon
 * (`singlePolygons`), each tagged `__globeObjType: 'polygon'`, with its cap
 * and walls as the first child mesh, whose geometry gains its positions when
 * built. If an upgrade changes that, the globe never reports ready and every
 * e2e spec stops at "loading".
 */

/** The part of a three.js scene this needs. */
export type SceneTree = { traverse(visit: (object: object) => void): void };

type MaybeShape = {
  __globeObjType?: unknown;
  children?: { geometry?: { attributes?: { position?: unknown } } }[];
};

/** How many shapes globe.gl makes for these countries. */
export const shapeCount = (countries: readonly Country[]): number =>
  countries.reduce(
    (n, c) => n + (c.geometry.type === 'Polygon' ? 1 : c.geometry.coordinates.length),
    0,
  );

/** How many country shapes in the scene have their geometry built. */
export const countDrawnShapes = (scene: SceneTree): number => {
  let count = 0;
  scene.traverse((object) => {
    const shape = object as MaybeShape;
    if (shape.__globeObjType === 'polygon' && shape.children?.[0]?.geometry?.attributes?.position) count++;
  });
  return count;
};
