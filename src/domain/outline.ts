import type { MultiPolygon, Polygon } from 'geojson';
import type { LngLat } from './view';

/**
 * The outline that marks the answer during feedback: a thick line with a
 * faint glow, drawn as an SVG path over the globe's canvas. The owner chose
 * it on 2026-11-21 over raising the country, which cannot be seen from
 * straight above, and the camera flies to put the answer there (plan,
 * Phase 3, "never colour alone").
 *
 * GlobeView redraws the path after every frame globe.gl renders, so it has
 * to be cheap for Canada's 11,573 vertices: they become 3D points once
 * (`prepareOutline`), and each frame costs one dot product and one matrix
 * product per vertex (`outlinePath`), with no allocation per vertex.
 */

export type Vec3 = readonly [number, number, number];

const RAD = Math.PI / 180;

/** A point drawn less than this far from the last one is skipped, in pixels. */
const MIN_STEP_PX = 1;

/**
 * A `[lng, lat]` point in globe.gl's scene, at `radius` from the centre.
 * Same formula as three-globe 2.45.6's `polar2Cartesian`: y is the polar
 * axis, and lng 0 on the equator faces +z.
 */
export const toCartesian = ([lng, lat]: LngLat, radius: number): Vec3 => {
  const phi = (90 - lat) * RAD;
  const theta = (90 - lng) * RAD;
  const s = Math.sin(phi);
  return [radius * s * Math.cos(theta), radius * Math.cos(phi), radius * s * Math.sin(theta)];
};

/** A country's rings in the scene: x, y, z per vertex, one array per ring. */
export type OutlineShape = { radius: number; rings: Float64Array[] };

/** Every ring of the shape, holes included (they are borders too). */
export const prepareOutline = (geometry: Polygon | MultiPolygon, radius: number): OutlineShape => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const rings = polygons.flat().map((ring) => {
    const xyz = new Float64Array(ring.length * 3);
    ring.forEach((position, i) => {
      xyz.set(toCartesian([position[0], position[1]], radius), i * 3);
    });
    return xyz;
  });
  return { radius, rings };
};

export type OutlineCamera = {
  /**
   * Projection times view (three.js's `projectionMatrix` times
   * `matrixWorldInverse`), column-major like `Matrix4.elements`.
   */
  matrix: ArrayLike<number>;
  /** Where the camera is, in the scene. */
  position: Vec3;
};

/**
 * The outline as SVG path data in canvas pixels, the way globe.gl's
 * `getScreenCoords` places a point (three.js's `Vector3.project`, then
 * `(x + 1) · width / 2`, `(1 − y) · height / 2`).
 *
 * A vertex is drawn only on the camera's side of the globe: where the
 * camera is above the vertex's tangent plane (`P · C > |P|²`), the test
 * `isWithinHorizon` makes in degrees. Where a ring goes behind the horizon
 * the pen lifts, so the far side never shows through.
 */
export const outlinePath = (
  shape: OutlineShape,
  camera: OutlineCamera,
  width: number,
  height: number,
): string => {
  const m = camera.matrix;
  const [cx, cy, cz] = camera.position;
  const horizon = shape.radius * shape.radius;
  const parts: string[] = [];
  const point = (command: 'M' | 'L', x: number, y: number) =>
    parts.push(`${command}${x.toFixed(1)} ${y.toFixed(1)}`);

  for (const ring of shape.rings) {
    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    // A point skipped as too close, still owed if the run ends on it.
    let owed = false;
    let owedX = 0;
    let owedY = 0;
    const endRun = () => {
      if (owed) point('L', owedX, owedY);
      owed = false;
      drawing = false;
    };
    for (let i = 0; i < ring.length; i += 3) {
      const x = ring[i];
      const y = ring[i + 1];
      const z = ring[i + 2];
      if (x * cx + y * cy + z * cz <= horizon) {
        endRun();
        continue;
      }
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      const sx = (((m[0] * x + m[4] * y + m[8] * z + m[12]) / w + 1) * width) / 2;
      const sy = ((1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * height) / 2;
      if (!drawing) {
        point('M', sx, sy);
        drawing = true;
      } else if (Math.hypot(sx - lastX, sy - lastY) < MIN_STEP_PX) {
        owed = true;
        owedX = sx;
        owedY = sy;
        continue;
      } else {
        point('L', sx, sy);
      }
      owed = false;
      lastX = sx;
      lastY = sy;
    }
    endRun();
  }
  return parts.join('');
};

/**
 * `a × b` for 4 × 4 matrices stored column-major (three.js's
 * `Matrix4.elements`): `b` applies first. GlobeView combines the camera's
 * projection with its view this way once per frame.
 */
export const combine = (a: ArrayLike<number>, b: ArrayLike<number>): number[] => {
  const out = new Array<number>(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
};
