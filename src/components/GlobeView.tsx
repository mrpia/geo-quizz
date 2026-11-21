import { useEffect, useMemo, useRef, useState } from 'react';
// Types only: erased at build time. The modules themselves arrive through
// the `import()` below, so three.js and d3-geo stay out of the first bundle.
import type { GlobeInstance } from 'globe.gl';
import { createTapTracker } from '../domain/gesture';
import type * as Pick from '../domain/pick';
import { ringedIds } from '../domain/rings';
import { CONTINENT_VIEWS, isWithinHorizon } from '../domain/view';
import { countriesOf, type Continent, type Country, type World } from '../domain/world';
import { useI18n } from '../i18n/I18nContext';
import type { GeoQuizzHook } from './geoQuizzHook';
import {
  ALTITUDE,
  BORDER_COLOR,
  NO_HIGHLIGHT,
  OCEAN_COLOR,
  SPACE_COLOR,
  capColorOf,
  polygonAltitudeOf,
  sideColorOf,
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
/** How long the camera takes to fly back to the continent. */
const FLY_MS = 800;
/** How long a country takes to rise or sink. */
const RAISE_MS = 250;

export type GlobeViewProps = {
  world: World;
  continent: Continent;
  /** What to show after a tap. Nothing by default. */
  highlight?: GlobeHighlight;
  /** A tap on a country of `continent`. Taps anywhere else, drags and pinches call nothing. */
  onPick: (id: string) => void;
  /** Change it to fly the camera back to the continent's view. */
  resetToken?: number;
};

type PolygonDatum = { country: Country };
type RingDatum = { id: string; lat: number; lng: number };
type Style = { cap: string; side: string; altitude: number };

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
  highlight = NO_HIGHLIGHT,
  onPick,
  resetToken = 0,
}: GlobeViewProps) => {
  const { t } = useI18n();
  const frameRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [globe, setGlobe] = useState<GlobeInstance | null>(null);
  const [pick, setPick] = useState<typeof Pick | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [altitude, setAltitude] = useState(CONTINENT_VIEWS[continent].altitude);
  const [height, setHeight] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const countries = useMemo(() => countriesOf(world, continent), [world, continent]);
  const inPlay = useMemo(() => new Set(countries.map((c) => c.id)), [countries]);
  const locate = useMemo(() => pick?.createLocator(countries) ?? null, [pick, countries]);
  // One datum per country for the life of the world: three-globe keys its
  // meshes by datum, so new objects would rebuild all 1,620 shapes.
  const polygons = useMemo<PolygonDatum[]>(
    () => world.countries.map((country) => ({ country })),
    [world],
  );

  const { pickedId, correctId, pickedColor, correctColor } = highlight;
  // Worked out here rather than inside globe.gl's accessors, so a bad value
  // (an unknown MAPCOLOR7) throws during render, where React reports it.
  const styles = useMemo(() => {
    const shown = { pickedId, correctId, pickedColor, correctColor };
    return new Map<string, Style>(
      world.countries.map((c) => {
        const play = inPlay.has(c.id);
        const altitude = polygonAltitudeOf(c, play, hoverId, shown);
        return [c.id, { cap: capColorOf(c, play, shown), side: sideColorOf(altitude), altitude }];
      }),
    );
  }, [world, inPlay, hoverId, pickedId, correctId, pickedColor, correctColor]);

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
  const latest = useRef({ onPick, locate, rings, inPlay });
  useEffect(() => {
    latest.current = { onPick, locate, rings, inPlay };
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
          .polygonStrokeColor(() => BORDER_COLOR)
          .polygonsTransitionDuration(RAISE_MS)
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
          .onGlobeReady(() => setStatus('ready'));
        const frame = frameRef.current;
        if (frame && frame.clientWidth > 0 && frame.clientHeight > 0) {
          g.width(frame.clientWidth).height(frame.clientHeight);
        }
        (g.globeMaterial() as unknown as { color: { set(css: string): void } }).color.set(OCEAN_COLOR);
        const radius = g.getGlobeRadius();
        const controls = g.controls();
        controls.minDistance = radius * (1 + MIN_ALTITUDE);
        controls.maxDistance = radius * (1 + MAX_ALTITUDE);
        instance = g;
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
        setStatus('error');
      });
    return () => {
      cancelled = true;
      instance?._destructor();
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    globe?.polygonsData(polygons);
  }, [globe, polygons]);

  useEffect(() => {
    if (!globe) return;
    const styleOf = (d: object): Style => {
      const style = styles.get(countryOf(d).id);
      if (!style) throw new Error(`GlobeView: no style for ${countryOf(d).id}`);
      return style;
    };
    globe
      .polygonCapColor((d) => styleOf(d).cap)
      .polygonSideColor((d) => styleOf(d).side)
      .polygonAltitude((d) => styleOf(d).altitude);
  }, [globe, styles]);

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
