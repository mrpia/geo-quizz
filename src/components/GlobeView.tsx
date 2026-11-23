import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
// Types only: erased at build time. The modules themselves arrive through
// the `import()` below, so three.js and d3-geo stay out of the first bundle.
import type { GlobeInstance } from 'globe.gl';
import { createTapTracker } from '../domain/gesture';
import type * as Pick from '../domain/pick';
import {
  combine,
  outlinePath,
  prepareOutline,
  projectPoint,
  toCartesian,
  type OutlineShape,
} from '../domain/outline';
import { ringedIds } from '../domain/rings';
import { CONTINENT_VIEWS, isInFrame, isWithinHorizon, viewOver } from '../domain/view';
import { quizPool, type Area, type Country, type World } from '../domain/world';
import { useI18n } from '../i18n/I18nContext';
import type { GeoQuizzHook } from './geoQuizzHook';
import { countDrawnShapes, shapeCount } from './globeShapes';
import {
  ALTITUDE,
  NO_HIGHLIGHT,
  OCEAN_COLOR,
  SPACE_COLOR,
  altitudeOf,
  capColorOf,
  strokeColorOf,
  type GlobeHighlight,
} from './globeLook';
import './GlobeView.css';

/**
 * Closest zoom, as a `pointOfView` altitude (globe radii above the surface).
 * At 0.02 Sint Maarten (42 km²) is about 43 px across on a 700 px tall globe,
 * so it and Saint-Martin can be told apart and tapped without rings
 * (`screenDiameterPx` in `src/domain/view.ts`). globe.gl's own minimum is
 * the camera's near plane, 0.00055.
 */
export const MIN_ALTITUDE = 0.02;
/** Farthest zoom: the whole globe, about 300 px across on a 700 px globe area. */
export const MAX_ALTITUDE = 4;
/** How long the camera takes to fly to a view: the continent's, or the answer's. */
const FLY_MS = 800;

export type GlobeViewProps = {
  world: World;
  /**
   * The round's continent, or the oceans (plan, Phase 7): then the oceans'
   * discs are drawn under the land, all land is grey, and only a disc can be
   * picked.
   */
  continent: Area;
  /**
   * Leave out the continent's tiny places (`quizPool`): they turn grey, get
   * no ring and cannot be picked, like land outside the continent.
   */
  skipTiny: boolean;
  /**
   * What to show after a tap or a timeout. Nothing by default. The answer
   * (`correctId`) is outlined and marked ✅, a wrong pick marked ❌, and the
   * camera flies over the answer, at the altitude it has, when it is out of
   * frame (plan, Phase 3).
   */
  highlight?: GlobeHighlight;
  /**
   * Explore mode (plan, Phase 6): the place whose name is shown, green
   * (`SELECTED_COLOR`) and outlined in white. Unlike the answer it gets no
   * mark, and the camera never moves for it: the player just tapped it.
   */
  selectedId?: string | null;
  /** A tap on a place of the round (`quizPool`). Taps anywhere else, drags and pinches call nothing. */
  onPick: (id: string) => void;
  /**
   * Called once, when the map is drawn: the sphere and every country's shape
   * on screen. The game asks its first country then, not while it loads.
   */
  onReady?: () => void;
  /** Change it to fly the camera back to the continent's view. */
  resetToken?: number;
};

type PolygonDatum = { country: Country };
type RingDatum = { id: string; lat: number; lng: number };
/** An outlined country: the answer, the one selected in Explore, or the one under the mouse. */
type Outline = { kind: 'answer' | 'selected' | 'hover'; id: string };
/** ✅ on the answer, ❌ on a wrong pick (the owner's call, 2026-11-21). */
type Mark = { id: string; mark: 'right' | 'wrong' };

/** What the outline reads from globe.gl's three.js camera, after each render. */
type CameraMatrices = {
  projectionMatrix: { elements: ArrayLike<number> };
  matrixWorldInverse: { elements: ArrayLike<number> };
  position: { x: number; y: number; z: number };
};
/** three.js calls a scene's `onAfterRender` at the end of every `render()`. */
type RenderHook = { onAfterRender: () => void };

const countryOf = (d: object): Country => (d as PolygonDatum).country;

const makeRing = (d: object): HTMLElement => {
  const ring = document.createElement('div');
  ring.className = 'globe-ring';
  ring.dataset.testid = 'globe-ring';
  ring.dataset.id = (d as RingDatum).id;
  return ring;
};

const showRing = (ring: HTMLElement, visible: boolean) => {
  ring.classList.toggle('globe-ring--hidden', !visible);
};

/**
 * The 3D globe (globe.gl), wrapped for React. globe.gl is imperative: one
 * instance is created in an effect and destroyed in its cleanup, and the
 * other effects push props into it.
 *
 * Taps are not globe.gl's `onPolygonClick`: that reports the country under
 * the pointer's last hover raycast, which runs at most every 50 ms, so a
 * quick tap was credited to the previously touched country (measured on
 * 2026-11-21, see docs/plan.md, Phase 2). GlobeView tells taps from drags
 * itself and looks up the point under the finger at the moment of the tap.
 */
export const GlobeView = ({
  world,
  continent,
  skipTiny,
  highlight = NO_HIGHLIGHT,
  selectedId = null,
  onPick,
  onReady,
  resetToken = 0,
}: GlobeViewProps) => {
  const { t } = useI18n();
  const frameRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [globe, setGlobe] = useState<GlobeInstance | null>(null);
  // Where the outlines go: right after globe.gl's canvas, so its HTML layer
  // (rings, marks), which comes after, stays on top of them.
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const [pick, setPick] = useState<typeof Pick | null>(null);
  const [failed, setFailed] = useState(false);
  // Ready means drawn: the sphere is up (globe.gl's onGlobeReady) and every
  // country's shape has been on screen for a frame (see globeShapes.ts).
  const [sphereShown, setSphereShown] = useState(false);
  const [shapesDrawn, setShapesDrawn] = useState(false);
  const status = failed ? 'error' : sphereShown && shapesDrawn ? 'ready' : 'loading';
  const [altitude, setAltitude] = useState(CONTINENT_VIEWS[continent].altitude);
  const [height, setHeight] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const oceansRound = continent === 'oceans';
  // The round's places: everything below (colours, rings, hover, picks) reads these.
  const countries = useMemo(() => quizPool(world, continent, { skipTiny }), [world, continent, skipTiny]);
  const inPlay = useMemo(() => new Set(countries.map((c) => c.id)), [countries]);
  // In an oceans round the land is drawn over the discs, so a tap on it is
  // not a tap on the ocean underneath.
  const locate = useMemo(
    () => pick?.createLocator(countries, oceansRound ? world.countries : []) ?? null,
    [pick, countries, oceansRound, world],
  );
  // One datum per shape for the life of the world: three-globe keys its
  // meshes by datum, so new objects would rebuild all 1,620 shapes. The
  // oceans' discs join the land in an oceans round only.
  const landData = useMemo<PolygonDatum[]>(() => world.countries.map((country) => ({ country })), [world]);
  const oceanData = useMemo<PolygonDatum[]>(() => world.oceans.map((country) => ({ country })), [world]);
  const polygons = useMemo(
    () => (oceansRound ? [...landData, ...oceanData] : landData),
    [landData, oceanData, oceansRound],
  );
  const drawn = useMemo(() => polygons.map(({ country }) => country), [polygons]);

  const { pickedId, correctId, pickedColor, correctColor } = highlight;
  // Worked out here rather than inside globe.gl's accessors, so a bad value
  // (an unknown MAPCOLOR7) throws during render, where React reports it.
  const caps = useMemo(() => {
    const shown = { pickedId, correctId, pickedColor, correctColor };
    return new Map<string, string>(
      drawn.map((c) => [c.id, capColorOf(c, inPlay.has(c.id), hoverId, shown, selectedId)]),
    );
  }, [drawn, inPlay, hoverId, pickedId, correctId, pickedColor, correctColor, selectedId]);

  if (selectedId !== null && !world.byId.has(selectedId)) {
    throw new Error(`GlobeView: no country ${JSON.stringify(selectedId)} to select`);
  }

  const countryById = useCallback(
    (id: string, use: string): Country => {
      const country = world.byId.get(id);
      if (!country) throw new Error(`GlobeView: no country ${JSON.stringify(id)} to ${use}`);
      return country;
    },
    [world],
  );

  // ✅ on the answer, ❌ on a wrong pick (none on a timeout, or when the pick
  // is the answer).
  const marks = useMemo<Mark[]>(
    () => [
      ...(correctId ? [{ id: correctId, mark: 'right' as const }] : []),
      ...(pickedId && pickedId !== correctId ? [{ id: pickedId, mark: 'wrong' as const }] : []),
    ],
    [correctId, pickedId],
  );

  // The answer, the place selected in Explore, and the country under the
  // mouse unless it is one of those or the pick: one outline per country.
  const hoverOutlineId =
    hoverId && hoverId !== correctId && hoverId !== pickedId && hoverId !== selectedId ? hoverId : null;
  const outlines = useMemo<Outline[]>(
    () => [
      ...(correctId ? [{ kind: 'answer' as const, id: correctId }] : []),
      ...(selectedId ? [{ kind: 'selected' as const, id: selectedId }] : []),
      ...(hoverOutlineId ? [{ kind: 'hover' as const, id: hoverOutlineId }] : []),
    ],
    [correctId, selectedId, hoverOutlineId],
  );

  // A string, so zooming that leaves the same countries ringed changes nothing.
  const ringKey = useMemo(
    () => (height > 0 ? ringedIds(countries, altitude, height).join(',') : ''),
    [countries, altitude, height],
  );
  const rings = useMemo<RingDatum[]>(() => {
    const ids = new Set(ringKey.split(','));
    return countries
      .filter((c) => ids.has(c.id))
      .map((c) => ({ id: c.id, lng: c.properties.anchor[0], lat: c.properties.anchor[1] }));
  }, [countries, ringKey]);

  // What the long-lived listeners need, always current.
  const latest = useRef({ onPick, onReady, locate, rings, inPlay });
  useEffect(() => {
    latest.current = { onPick, onReady, locate, rings, inPlay };
  });
  const pointerType = useRef('mouse');

  // Create the globe once; StrictMode's second mount gets a fresh one.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) throw new Error('GlobeView: host element missing');
    let cancelled = false;
    let instance: GlobeInstance | null = null;
    Promise.all([import('globe.gl'), import('../domain/pick')])
      .then(([{ default: Globe }, pickModule]) => {
        if (cancelled) return;
        const g = new Globe(host, { animateIn: false })
          .backgroundColor(SPACE_COLOR)
          .showAtmosphere(true)
          // three-globe 2.45.6 types `coordinates` as `number[]`, which no
          // Polygon or MultiPolygon matches; at runtime it takes either.
          .polygonGeoJsonGeometry(
            (d) => countryOf(d).geometry as unknown as { type: string; coordinates: number[] },
          )
          .polygonStrokeColor((d) => strokeColorOf(countryOf(d)))
          // Nothing rises (the owner's call, 2026-11-21): one altitude for
          // the land, no walls, nothing to animate. three-globe builds walls
          // only for a truthy side colour, and walls under all 1,620 shapes
          // made a SwiftShader frame seven times slower (2,280 ms against
          // 319 ms). The oceans' discs sit lower, under the land.
          .polygonAltitude((d) => altitudeOf(countryOf(d)))
          .polygonSideColor(() => '')
          .polygonsTransitionDuration(0)
          .htmlElement(makeRing)
          .htmlLat((d) => (d as RingDatum).lat)
          .htmlLng((d) => (d as RingDatum).lng)
          .htmlAltitude(ALTITUDE.base)
          .htmlElementVisibilityModifier(showRing)
          .htmlTransitionDuration(0)
          .onZoom((pov) => setAltitude(pov.altitude))
          .onPolygonHover((d) => {
            const id = d ? countryOf(d).id : null;
            const hoverable = id && pointerType.current === 'mouse' && latest.current.inPlay.has(id);
            setHoverId(hoverable ? id : null);
          })
          .onGlobeReady(() => setSphereShown(true));
        const frame = frameRef.current;
        if (frame && frame.clientWidth > 0 && frame.clientHeight > 0) {
          g.width(frame.clientWidth).height(frame.clientHeight);
        }
        (g.globeMaterial() as unknown as { color: { set(css: string): void } }).color.set(OCEAN_COLOR);
        const radius = g.getGlobeRadius();
        const controls = g.controls();
        controls.minDistance = radius * (1 + MIN_ALTITUDE);
        controls.maxDistance = radius * (1 + MAX_ALTITUDE);
        const layer = document.createElement('div');
        layer.className = 'globe__overlay';
        g.renderer().domElement.insertAdjacentElement('afterend', layer);
        instance = g;
        setOverlay(layer);
        setPick(pickModule);
        // A Kapsule instance is a function, and React calls a function given
        // to a state setter as an updater: `setGlobe(g)` would run `g(null)`,
        // which re-runs globe.gl's init on null.
        setGlobe(() => g);
      })
      // A chunk that fails to load, and a globe that cannot be created (no
      // WebGL: three.js throws), both end here rather than loading forever.
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('GlobeView: the globe could not be set up', error);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      instance?._destructor();
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (status === 'ready') latest.current.onReady?.();
  }, [status]);

  useEffect(() => {
    globe?.polygonsData(polygons);
  }, [globe, polygons]);

  // globe.gl builds the shapes in one of its later updates, all at once. The
  // map counts as drawn on the first frame after one that had all of them:
  // globe.gl renders on every frame, so by then they have been on screen.
  useEffect(() => {
    if (!globe || shapesDrawn) return;
    const expected = shapeCount(drawn);
    let built = false;
    let frame = 0;
    const check = () => {
      if (built) {
        setShapesDrawn(true);
        return;
      }
      built = countDrawnShapes(globe.scene()) >= expected;
      frame = requestAnimationFrame(check);
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, [globe, drawn, shapesDrawn]);

  useEffect(() => {
    if (!globe) return;
    globe.polygonCapColor((d) => {
      const cap = caps.get(countryOf(d).id);
      if (!cap) throw new Error(`GlobeView: no colour for ${countryOf(d).id}`);
      return cap;
    });
  }, [globe, caps]);

  useEffect(() => {
    globe?.htmlElementsData(rings);
  }, [globe, rings]);

  // Straight to the view on creation; a flight on every later change.
  const placed = useRef<GlobeInstance | null>(null);
  useEffect(() => {
    if (!globe) return;
    const first = placed.current !== globe;
    placed.current = globe;
    globe.pointOfView(CONTINENT_VIEWS[continent], first ? 0 : FLY_MS);
  }, [globe, continent, resetToken]);

  // The answer, when it is out of frame: the camera flies over it and keeps
  // its altitude. Declared after the continent's view, so a highlight given
  // at mount starts from that view.
  useEffect(() => {
    if (!globe || !correctId) return;
    const country = world.byId.get(correctId);
    if (!country) throw new Error(`GlobeView: no country ${JSON.stringify(correctId)} to show`);
    const anchor = country.properties.anchor;
    const view = globe.pointOfView();
    const point = isWithinHorizon(view, anchor)
      ? globe.getScreenCoords(anchor[1], anchor[0], ALTITUDE.base)
      : null;
    if (!isInFrame(point, { width: globe.width(), height: globe.height() })) {
      globe.pointOfView(viewOver(anchor, view), FLY_MS);
    }
  }, [globe, world, correctId]);

  // The outlines (the answer's, the selected place's, the hovered
  // country's) and the ✅ and ❌ marks: SVG over the canvas, placed again
  // after every frame globe.gl renders so they move with the globe
  // (src/domain/outline.ts). React puts a mark in the page in the same
  // render as the verdict; globe.gl's own HTML layer would only show it a
  // few frames later, which on a slow device can outlast a 1 s answer. A
  // layout effect, so nothing paints before it has its place. Prepared
  // shapes are kept, as the mouse comes back to the same countries.
  const outlineRef = useRef<SVGSVGElement>(null);
  const prepared = useMemo(() => new Map<string, OutlineShape>(), [globe, world]);
  useLayoutEffect(() => {
    const svg = outlineRef.current;
    if (!globe || !svg) return;
    const radius = globe.getGlobeRadius() * (1 + ALTITUDE.base);
    const lines = outlines.map(({ kind, id }) => {
      let shape = prepared.get(id);
      if (!shape) {
        shape = prepareOutline(countryById(id, 'outline').geometry, radius);
        prepared.set(id, shape);
      }
      return { shape, paths: [...svg.querySelectorAll(`g[data-kind="${kind}"] path`)] };
    });
    const pins = marks.map(({ id }) => ({
      point: toCartesian(countryById(id, 'mark').properties.anchor, radius),
      element: svg.querySelector(`[data-testid="globe-mark"][data-id="${id}"]`),
    }));
    const camera = globe.camera() as unknown as CameraMatrices;
    const scene = globe.scene() as unknown as RenderHook;
    const draw = () => {
      const { x, y, z } = camera.position;
      const view = {
        matrix: combine(camera.projectionMatrix.elements, camera.matrixWorldInverse.elements),
        position: [x, y, z] as const,
      };
      const [width, height] = [globe.width(), globe.height()];
      for (const { shape, paths } of lines) {
        const d = outlinePath(shape, view, width, height);
        for (const path of paths) path.setAttribute('d', d);
      }
      for (const { point, element } of pins) {
        const at = projectPoint(point, radius, view, width, height);
        element?.classList.toggle('globe-mark--hidden', !at);
        if (at) element?.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`);
      }
    };
    const previous = scene.onAfterRender;
    scene.onAfterRender = draw;
    draw();
    return () => {
      scene.onAfterRender = previous;
    };
  }, [globe, prepared, outlines, marks, countryById]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!globe || !frame) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height: h } = entry.contentRect;
      if (width === 0 || h === 0) return;
      globe.width(width).height(h);
      setHeight(h);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [globe]);

  // Taps. Listening on the host, not the frame, so a press on the recentre
  // button is not also a tap on the country under it. Capture phase: the
  // orbit controls take pointer capture on the canvas and must not hide
  // anything from the tracker.
  useEffect(() => {
    const host = hostRef.current;
    if (!globe || !host) return;
    const tracker = createTapTracker();
    const canvas = globe.renderer().domElement;
    const local = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const down = (e: PointerEvent) => {
      pointerType.current = e.pointerType;
      if (e.pointerType !== 'mouse') setHoverId(null);
      const p = local(e);
      tracker.down(e.pointerId, p.x, p.y);
    };
    const move = (e: PointerEvent) => {
      pointerType.current = e.pointerType;
      const p = local(e);
      tracker.move(e.pointerId, p.x, p.y);
    };
    const up = (e: PointerEvent) => {
      const p = local(e);
      const tap = tracker.up(e.pointerId, p.x, p.y);
      if (!tap) return;
      const { onPick: picked, locate: find, rings: ringed } = latest.current;
      // Both arrive in the same step as the globe, so neither is missing here.
      if (!pick || !find) throw new Error('GlobeView: tap before the picker loaded');
      const id = pick.resolveTap(tap, {
        rings: ringed.map((r) => ({ id: r.id, anchor: [r.lng, r.lat] })),
        view: globe.pointOfView(),
        project: ([lng, lat]) => globe.getScreenCoords(lat, lng, ALTITUDE.base),
        unproject: ({ x, y }) => {
          const geo = globe.toGlobeCoords(x, y);
          return geo ? [geo.lng, geo.lat] : null;
        },
        locate: find,
      });
      if (id) picked(id);
    };
    const cancel = (e: PointerEvent) => tracker.cancel(e.pointerId);
    const options = { capture: true };
    host.addEventListener('pointerdown', down, options);
    host.addEventListener('pointermove', move, options);
    host.addEventListener('pointerup', up, options);
    host.addEventListener('pointercancel', cancel, options);
    return () => {
      host.removeEventListener('pointerdown', down, options);
      host.removeEventListener('pointermove', move, options);
      host.removeEventListener('pointerup', up, options);
      host.removeEventListener('pointercancel', cancel, options);
    };
  }, [globe, pick]);

  useEffect(() => {
    if (!globe) return;
    const hook: GeoQuizzHook = {
      screenPoint: (id) => {
        const country = world.byId.get(id);
        if (!country) throw new Error(`screenPoint: no country ${JSON.stringify(id)}`);
        const [lng, lat] = country.properties.anchor;
        if (!isWithinHorizon(globe.pointOfView(), [lng, lat])) return null;
        const p = globe.getScreenCoords(lat, lng, ALTITUDE.base);
        const rect = globe.renderer().domElement.getBoundingClientRect();
        return { x: rect.left + p.x, y: rect.top + p.y };
      },
      camera: () => ({
        ...globe.pointOfView(),
        fov: (globe.camera() as unknown as { fov: number }).fov,
      }),
    };
    window.__geoQuizz = hook;
    return () => {
      if (window.__geoQuizz === hook) delete window.__geoQuizz;
    };
  }, [globe, world]);

  return (
    <div
      ref={frameRef}
      className="globe"
      data-testid="globe"
      data-state={status}
      data-hover={hoverId ? '' : undefined}
    >
      <div ref={hostRef} className="globe__host" />
      {overlay &&
        (outlines.length > 0 || marks.length > 0) &&
        createPortal(
          <svg ref={outlineRef} className="globe__outline" aria-hidden="true">
            {outlines.map(({ kind, id }) => (
              // Three strokes of one path: two faint, wide ones for the glow,
              // and the line. SVG blends a stroke once, so the glow stays faint
              // where the border's vertices crowd (three.js wide lines overlap
              // there).
              <g key={kind} data-testid={`globe-${kind}-outline`} data-kind={kind} data-id={id}>
                <path className="globe__outline-glow globe__outline-glow--wide" />
                <path className="globe__outline-glow" />
                <path className="globe__outline-line" />
              </g>
            ))}
            {marks.map(({ id, mark }) => (
              // Placed and shown by the layout effect above: a mark starts
              // hidden, so it never shows at the corner before its place is known.
              <text
                key={`${mark}-${id}`}
                className="globe-mark globe-mark--hidden"
                data-testid="globe-mark"
                data-id={id}
                data-mark={mark}
              >
                {mark === 'right' ? '✅' : '❌'}
              </text>
            ))}
          </svg>,
          overlay,
        )}
      {status === 'loading' && <p className="globe__status">{t('common.loading')}</p>}
      {status === 'error' && (
        <p className="globe__status" role="alert">
          {t('common.loadError')}
        </p>
      )}
      <button
        type="button"
        className="globe__recentre"
        data-testid="globe-recentre"
        aria-label={t('globe.recentreAria')}
        disabled={!globe}
        onClick={() => globe?.pointOfView(CONTINENT_VIEWS[continent], FLY_MS)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
        </svg>
      </button>
    </div>
  );
};
