import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import raw from '../data/world.json?raw';
import { parseWorld, type WorldTopology } from '../domain/world';
import { CONTINENT_VIEWS, type View } from '../domain/view';
import { LanguageProvider } from '../i18n/I18nContext';
import { GlobeView, MAX_ALTITUDE, MIN_ALTITUDE, type GlobeViewProps } from '../components/GlobeView';
import { ALTITUDE, MAP_PALETTE, OTHER_LAND_COLOR, type GlobeHighlight } from '../components/globeLook';

/**
 * globe.gl needs WebGL, which jsdom does not have. This fake records what
 * GlobeView sets and answers what it asks, with a flat projection of 10 px
 * per degree (x from 30° W, y from 75° N), so a test can tap a country by
 * its coordinates. The real globe is covered by the e2e spec.
 */
type Accessor = (d: object) => unknown;
type FakeGlobe = {
  props: Map<string, unknown>;
  pov: View;
  flights: { view: Partial<View>; ms: number }[];
  controls: { minDistance: number; maxDistance: number };
  oceanColor: string | null;
  destroyed: boolean;
  canvas: HTMLCanvasElement;
  /** Set to false to make the next taps land off the globe. */
  surface: boolean;
};

const fake = vi.hoisted(() => ({ globes: [] as unknown[], failCreate: false }));

const toScreen = (lng: number, lat: number) => ({ x: (lng + 30) * 10, y: (75 - lat) * 10 });

vi.mock('globe.gl', () => {
  function Globe(this: unknown, host: HTMLElement) {
    // What three.js throws on a device or browser without WebGL.
    if (fake.failCreate) throw new Error('Error creating WebGL context.');
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    const state: FakeGlobe = {
      props: new Map(),
      pov: { lat: 0, lng: 0, altitude: 2.5 },
      flights: [],
      controls: { minDistance: 100.055, maxDistance: 10_000 },
      oceanColor: null,
      destroyed: false,
      canvas,
      surface: true,
    };
    fake.globes.push(state);
    const api: Record<string, unknown> = {
      pointOfView: (view?: Partial<View>, ms = 0) => {
        if (!view) return state.pov;
        state.pov = { ...state.pov, ...view };
        state.flights.push({ view, ms });
        return proxy;
      },
      renderer: () => ({ domElement: canvas }),
      controls: () => state.controls,
      camera: () => ({ fov: 50 }),
      getGlobeRadius: () => 100,
      globeMaterial: () => ({ color: { set: (c: string) => (state.oceanColor = c) } }),
      getScreenCoords: (lat: number, lng: number) => toScreen(lng, lat),
      toGlobeCoords: (x: number, y: number) =>
        state.surface ? { lng: x / 10 - 30, lat: 75 - y / 10 } : null,
      _destructor: () => (state.destroyed = true),
    };
    // A function, like the real thing: a Kapsule instance is callable, and
    // calling it again re-runs its init on whatever it is given.
    const proxy: object = new Proxy(function globeInstance() {}, {
      get: (_, name: string) =>
        api[name] ??
        ((...args: unknown[]) => {
          if (args.length === 0) return state.props.get(name);
          state.props.set(name, args[0]);
          return proxy;
        }),
      apply: () => {
        throw new Error('the globe instance was called as a function');
      },
    });
    return proxy;
  }
  return { default: Globe };
});

class FakeResizeObserver {
  static last: FakeResizeObserver | null = null;
  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.last = this;
  }
  observe() {}
  disconnect() {}
  resize(width: number, height: number) {
    this.callback(
      [{ contentRect: { width, height } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

const world = parseWorld(JSON.parse(raw) as WorldTopology);
const anchor = (id: string) => world.byId.get(id)!.properties.anchor;
const pointOf = (id: string) => toScreen(...anchor(id));

const live = () => {
  const globes = (fake.globes as FakeGlobe[]).filter((g) => !g.destroyed);
  expect(globes).toHaveLength(1);
  return globes[0];
};
const accessor = (name: string) => live().props.get(name) as Accessor;
const datum = (id: string) => (live().props.get('polygonsData') as { country: { id: string } }[]).find((d) => d.country.id === id)!;

const setup = async (props: Partial<GlobeViewProps> = {}) => {
  const onPick = vi.fn();
  const all: GlobeViewProps = { world, continent: 'europe', onPick, ...props };
  const ui = (p: GlobeViewProps) => (
    <StrictMode>
      <LanguageProvider lang="en">
        <GlobeView {...p} />
      </LanguageProvider>
    </StrictMode>
  );
  const view = render(ui(all));
  await waitFor(() => expect(fake.globes.length).toBeGreaterThan(0));
  await waitFor(() => live());
  act(() => FakeResizeObserver.last!.resize(1180, 700));
  return { onPick, rerender: (p: Partial<GlobeViewProps>) => view.rerender(ui({ ...all, ...p })), unmount: view.unmount };
};

const tap = (x: number, y: number, pointerType = 'touch', pointerId = 1) => {
  const canvas = live().canvas;
  fireEvent.pointerDown(canvas, { pointerId, clientX: x, clientY: y, pointerType });
  fireEvent.pointerUp(canvas, { pointerId, clientX: x, clientY: y, pointerType });
};

beforeEach(() => {
  fake.globes.length = 0;
  fake.failCreate = false;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.__geoQuizz;
});

describe('GlobeView: setup', () => {
  it('loads globe.gl, keeps one live globe under StrictMode, and says when it is ready', async () => {
    await setup();
    const frame = screen.getByTestId('globe');
    expect(frame).toHaveAttribute('data-state', 'loading');
    expect(screen.getByText('Loading the map…')).toBeInTheDocument();
    act(() => (live().props.get('onGlobeReady') as () => void)());
    expect(frame).toHaveAttribute('data-state', 'ready');
    expect(screen.queryByText('Loading the map…')).not.toBeInTheDocument();
  });

  it('says so when the globe cannot be created, instead of loading forever', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.failCreate = true;
    render(
      <LanguageProvider lang="en">
        <GlobeView world={world} continent="europe" onPick={vi.fn()} />
      </LanguageProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('The map could not be loaded.');
    expect(screen.getByTestId('globe')).toHaveAttribute('data-state', 'error');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it('destroys the globe when it unmounts', async () => {
    const { unmount } = await setup();
    const globe = live();
    unmount();
    expect(globe.destroyed).toBe(true);
    expect(window.__geoQuizz).toBeUndefined();
  });

  it('sizes the globe to its frame', async () => {
    await setup();
    expect(live().props.get('width')).toBe(1180);
    expect(live().props.get('height')).toBe(700);
  });

  it('limits zoom: close enough for Sint Maarten, never so far the globe vanishes', async () => {
    await setup();
    expect(live().controls.minDistance).toBeCloseTo(100 * (1 + MIN_ALTITUDE));
    expect(live().controls.maxDistance).toBeCloseTo(100 * (1 + MAX_ALTITUDE));
    // Close enough that Sint Maarten (42 km²) is a target of its own on a
    // 700 px globe, without a ring.
    expect(MIN_ALTITUDE).toBeLessThan(0.03);
    // Every highlight stays below the camera, however close it gets.
    expect(ALTITUDE.correct).toBeLessThan(MIN_ALTITUDE);
  });

  it('draws an ocean colour, no image textures', async () => {
    await setup();
    expect(live().oceanColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(live().props.get('globeImageUrl')).toBeUndefined();
    expect(live().props.get('bumpImageUrl')).toBeUndefined();
  });
});

describe('GlobeView: the countries', () => {
  it('draws every country of the world once', async () => {
    await setup();
    const data = live().props.get('polygonsData') as { country: { id: string } }[];
    expect(data.map((d) => d.country.id).sort()).toEqual(world.countries.map((c) => c.id).sort());
  });

  it("colours the continent's countries and leaves the rest grey", async () => {
    await setup();
    const cap = accessor('polygonCapColor');
    expect(MAP_PALETTE).toContain(cap(datum('FRA')));
    expect(cap(datum('BRA'))).toBe(OTHER_LAND_COLOR);
  });

  it('recolours when the continent changes, without rebuilding the shapes', async () => {
    const { rerender } = await setup();
    const before = live().props.get('polygonsData');
    rerender({ continent: 'south-america' });
    expect(live().props.get('polygonsData')).toBe(before);
    const cap = accessor('polygonCapColor');
    expect(cap(datum('FRA'))).toBe(OTHER_LAND_COLOR);
    expect(MAP_PALETTE).toContain(cap(datum('BRA')));
  });

  it('shows the highlight in colour and height', async () => {
    const highlight: GlobeHighlight = {
      pickedId: 'DEU',
      correctId: 'FRA',
      pickedColor: '#ef4444',
      correctColor: '#22c55e',
    };
    await setup({ highlight });
    expect(accessor('polygonCapColor')(datum('FRA'))).toBe('#22c55e');
    expect(accessor('polygonCapColor')(datum('DEU'))).toBe('#ef4444');
    expect(accessor('polygonAltitude')(datum('FRA'))).toBe(ALTITUDE.correct);
    expect(accessor('polygonAltitude')(datum('DEU'))).toBe(ALTITUDE.picked);
    expect(accessor('polygonAltitude')(datum('ESP'))).toBe(ALTITUDE.base);
    expect(accessor('polygonSideColor')(datum('FRA'))).toBeTruthy();
    expect(accessor('polygonSideColor')(datum('ESP'))).toBeFalsy();
  });

  it('raises a country under the mouse, but not under a finger', async () => {
    await setup();
    const frame = live().canvas;
    const hover = live().props.get('onPolygonHover') as (d: object | null) => void;
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 5, clientY: 5, pointerType: 'mouse' });
    act(() => hover(datum('FRA')));
    expect(accessor('polygonAltitude')(datum('FRA'))).toBe(ALTITUDE.hover);
    act(() => hover(datum('BRA')));
    expect(accessor('polygonAltitude')(datum('BRA'))).toBe(ALTITUDE.base);
    expect(accessor('polygonAltitude')(datum('FRA'))).toBe(ALTITUDE.base);
    // A touch leaves globe.gl's hover on the last country touched; ignore it.
    fireEvent.pointerDown(frame, { pointerId: 2, clientX: 5, clientY: 5, pointerType: 'touch' });
    act(() => hover(datum('DEU')));
    expect(accessor('polygonAltitude')(datum('DEU'))).toBe(ALTITUDE.base);
  });
});

describe('GlobeView: the camera', () => {
  it("starts at the continent's view", async () => {
    await setup({ continent: 'africa' });
    expect(live().pov).toEqual(CONTINENT_VIEWS.africa);
    expect(live().flights.at(-1)?.ms).toBe(0);
  });

  it('flies to the new view when the continent changes', async () => {
    const { rerender } = await setup();
    rerender({ continent: 'oceania' });
    expect(live().pov).toEqual(CONTINENT_VIEWS.oceania);
    expect(live().flights.at(-1)?.ms).toBeGreaterThan(0);
  });

  it('flies back when the reset token changes, and only then', async () => {
    const { rerender } = await setup({ resetToken: 1 });
    live().pov = { lat: -40, lng: 170, altitude: 0.3 };
    const flights = live().flights.length;
    rerender({ resetToken: 1, highlight: undefined });
    expect(live().flights).toHaveLength(flights);
    rerender({ resetToken: 2 });
    expect(live().pov).toEqual(CONTINENT_VIEWS.europe);
  });

  it('flies back when the player presses recentre', async () => {
    const { onPick } = await setup({ continent: 'asia' });
    live().pov = { lat: -40, lng: 170, altitude: 0.3 };
    const button = screen.getByRole('button', { name: 'recentre the globe' });
    // A press on the button is not a tap on the globe underneath it.
    fireEvent.pointerDown(button, { pointerId: 1, clientX: 300, clientY: 300, pointerType: 'touch' });
    fireEvent.pointerUp(button, { pointerId: 1, clientX: 300, clientY: 300, pointerType: 'touch' });
    fireEvent.click(button);
    expect(live().pov).toEqual(CONTINENT_VIEWS.asia);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('GlobeView: picks', () => {
  it('picks the country under a tap', async () => {
    const { onPick } = await setup();
    const p = pointOf('FRA');
    tap(p.x, p.y);
    expect(onPick).toHaveBeenCalledExactlyOnceWith('FRA');
  });

  it('picks with a mouse click too', async () => {
    const { onPick } = await setup();
    const p = pointOf('POL');
    tap(p.x, p.y, 'mouse');
    expect(onPick).toHaveBeenCalledExactlyOnceWith('POL');
  });

  it('ignores the sea, the space around the globe and other continents', async () => {
    const { onPick } = await setup();
    const sea = toScreen(-30, 45);
    tap(sea.x, sea.y);
    const brazil = toScreen(-50, -10);
    tap(brazil.x, brazil.y);
    live().surface = false;
    tap(10, 10);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('never picks at the end of a drag or a pinch', async () => {
    const { onPick } = await setup();
    const frame = live().canvas;
    const p = pointOf('FRA');
    fireEvent.pointerDown(frame, { pointerId: 1, clientX: p.x - 60, clientY: p.y, pointerType: 'touch' });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: p.x - 30, clientY: p.y, pointerType: 'touch' });
    fireEvent.pointerUp(frame, { pointerId: 1, clientX: p.x, clientY: p.y, pointerType: 'touch' });
    fireEvent.pointerDown(frame, { pointerId: 2, clientX: p.x, clientY: p.y, pointerType: 'touch' });
    fireEvent.pointerDown(frame, { pointerId: 3, clientX: p.x + 80, clientY: p.y, pointerType: 'touch' });
    fireEvent.pointerUp(frame, { pointerId: 3, clientX: p.x + 80, clientY: p.y, pointerType: 'touch' });
    fireEvent.pointerUp(frame, { pointerId: 2, clientX: p.x, clientY: p.y, pointerType: 'touch' });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('lets a ring win over the country underneath', async () => {
    const { onPick } = await setup();
    // Vatican City is ringed at the Europe view; 20 px off its centre is Italy.
    const p = pointOf('VAT');
    tap(p.x + 20, p.y);
    expect(onPick).toHaveBeenCalledExactlyOnceWith('VAT');
  });

  it('uses the latest onPick', async () => {
    const { onPick, rerender } = await setup();
    const next = vi.fn();
    rerender({ onPick: next });
    const p = pointOf('FRA');
    tap(p.x, p.y);
    expect(onPick).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith('FRA');
  });
});

describe('GlobeView: tap rings', () => {
  const ringIds = () => (live().props.get('htmlElementsData') as { id: string }[]).map((d) => d.id);

  it("rings the continent's tiny countries at the starting zoom", async () => {
    await setup();
    expect(ringIds()).toEqual(expect.arrayContaining(['VAT', 'MCO', 'SMR', 'LIE', 'AND', 'MLT', 'LUX']));
    expect(ringIds()).not.toContain('FRA');
    expect(ringIds().every((id) => world.byId.get(id)?.properties.continent === 'europe')).toBe(true);
  });

  it('drops rings as the player zooms in', async () => {
    await setup();
    expect(ringIds()).toContain('LUX');
    act(() => (live().props.get('onZoom') as (pov: View) => void)({ lat: 50, lng: 6, altitude: 0.1 }));
    expect(ringIds()).not.toContain('LUX');
    expect(ringIds()).toContain('VAT');
  });

  it('makes a 44 px ring element with no name, that lets pointers through', async () => {
    await setup();
    const make = live().props.get('htmlElement') as (d: object) => HTMLElement;
    const el = make({ id: 'VAT', lat: 41.9, lng: 12.45 });
    expect(el).toHaveAttribute('data-testid', 'globe-ring');
    expect(el).toHaveAttribute('data-id', 'VAT');
    expect(el.className).toBe('globe-ring');
    expect(el.textContent).toBe('');
  });

  it('hides rings on the far side', async () => {
    await setup();
    const make = live().props.get('htmlElement') as (d: object) => HTMLElement;
    const hide = live().props.get('htmlElementVisibilityModifier') as (el: HTMLElement, visible: boolean) => void;
    const el = make({ id: 'VAT', lat: 41.9, lng: 12.45 });
    hide(el, false);
    expect(el).toHaveClass('globe-ring--hidden');
    hide(el, true);
    expect(el).not.toHaveClass('globe-ring--hidden');
  });
});

describe('GlobeView: the e2e hook', () => {
  it('gives the viewport position of a country anchor, for page.mouse.click', async () => {
    await setup();
    live().canvas.getBoundingClientRect = () => ({ left: 15, top: 120 }) as DOMRect;
    const p = pointOf('CHE');
    expect(window.__geoQuizz?.screenPoint('CHE')).toEqual({ x: p.x + 15, y: p.y + 120 });
  });

  it('returns null for a country behind the globe, and throws for an unknown id', async () => {
    await setup();
    expect(window.__geoQuizz?.screenPoint('NZL')).toBeNull();
    expect(() => window.__geoQuizz?.screenPoint('XXX')).toThrow(/XXX/);
  });

  it("reports the camera's view and field of view", async () => {
    await setup({ continent: 'asia' });
    expect(window.__geoQuizz?.camera()).toEqual({ ...CONTINENT_VIEWS.asia, fov: 50 });
  });
});
