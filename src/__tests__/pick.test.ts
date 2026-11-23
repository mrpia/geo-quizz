import raw from '../data/world.json?raw';
import { CONTINENTS, countriesOf, parseWorld, type WorldTopology } from '../domain/world';
import { createLocator, resolveTap } from '../domain/pick';
import type { LngLat } from '../domain/view';

const world = parseWorld(JSON.parse(raw) as WorldTopology);

// The locator relies on the data's winding, which world.test.ts checks.
describe('finding the country at a point', () => {
  it.each(CONTINENTS)("finds each %s country at its own anchor", (continent) => {
    const countries = countriesOf(world, continent);
    const locate = createLocator(countries);
    for (const c of countries) expect(locate(c.properties.anchor)?.id, c.id).toBe(c.id);
  });

  it('finds the enclave, not the country around it', () => {
    const europe = createLocator(countriesOf(world, 'europe'));
    const africa = createLocator(countriesOf(world, 'africa'));
    const anchor = (id: string) => world.byId.get(id)!.properties.anchor;
    expect(europe(anchor('VAT'))?.id).toBe('VAT');
    expect(europe(anchor('SMR'))?.id).toBe('SMR');
    expect(africa(anchor('LSO'))?.id).toBe('LSO');
    // And the country around it just outside the enclave.
    expect(europe([12.5, 41.85])?.id).toBe('ITA');
  });

  it('finds nothing in the sea', () => {
    const europe = createLocator(countriesOf(world, 'europe'));
    expect(europe([-30, 45])).toBeNull(); // mid-Atlantic
    expect(europe([18, 35])).toBeNull(); // Ionian Sea
  });

  it("finds nothing on another continent's land", () => {
    // A tap outside the round's continent picks nothing (plan, Phase 2 item 5).
    const europe = createLocator(countriesOf(world, 'europe'));
    expect(europe([-50, -10])).toBeNull(); // Brazil
    expect(europe([2.5, 28])).toBeNull(); // Algeria
  });

  it('finds countries on both sides of the antimeridian', () => {
    const europe = createLocator(countriesOf(world, 'europe'));
    // Chukotka, east of 180° (the centroid of that part of Russia), and Moscow.
    expect(europe([-175.77, 66.48])?.id).toBe('RUS');
    expect(europe([37.6, 55.75])?.id).toBe('RUS');
    // Not every point inside Russia's wrapped bounding box is Russia.
    expect(europe([-150, 66])).toBeNull(); // Alaska, North America
    const oceania = createLocator(countriesOf(world, 'oceania'));
    const fiji = world.byId.get('FJI')!;
    expect(oceania(fiji.properties.anchor)?.id).toBe('FJI');
  });
});

// The oceans (docs/plan.md, Phase 7): the land is drawn over the discs.
describe('finding the ocean at a point', () => {
  const land = createLocator(world.countries);
  const oceans = createLocator(world.oceans, world.countries);

  it('finds each ocean on every one of its discs', () => {
    for (const ocean of world.oceans) {
      expect(oceans(ocean.properties.anchor)?.id, ocean.id).toBe(ocean.id);
    }
    expect(oceans([-125, -28])?.id).toBe('pacific'); // the South Pacific's disc
    expect(oceans([-17, -24])?.id).toBe('atlantic'); // the South Atlantic's
    expect(oceans([-110, -63])?.id).toBe('southern'); // off West Antarctica
    expect(oceans([-170, 30])?.id).toBe('pacific'); // west of the antimeridian's 180°…
    expect(oceans([178, 25])?.id).toBe('pacific'); // …and east of it
  });

  it('finds nothing on land that lies on a disc', () => {
    const hawaii: LngLat = [-155.5, 19.6];
    const greenland: LngLat = [-40, 82.5];
    expect(land(hawaii)?.id).toBe('USA');
    expect(land(greenland)?.id).toBe('GRL');
    expect(oceans(hawaii)).toBeNull();
    expect(oceans(greenland)).toBeNull();
  });

  it('finds nothing in the water between the discs', () => {
    expect(oceans([-60, 30])).toBeNull(); // the Atlantic, off Bermuda
    expect(oceans([18, 35])).toBeNull(); // the Ionian Sea
    expect(oceans([-80, -45])).toBeNull(); // the Pacific, off Chile
  });
});

describe('resolving a tap', () => {
  const europe = countriesOf(world, 'europe');
  const locate = createLocator(europe);
  const view = { lat: 52, lng: 15, altitude: 0.9 };
  // A fake projection: 10 px per degree, origin at [0, 60]. Enough to place
  // rings and taps; the real one comes from globe.gl.
  const project = ([lng, lat]: LngLat) => ({ x: lng * 10, y: (60 - lat) * 10 });
  const unproject = ({ x, y }: { x: number; y: number }): LngLat => [x / 10, 60 - y / 10];
  const anchor = (id: string) => world.byId.get(id)!.properties.anchor;
  const at = (id: string) => project(anchor(id));
  const ringsOf = (...ids: string[]) => ids.map((id) => ({ id, anchor: anchor(id) }));

  it('picks the country under the pointer', () => {
    const tap = at('FRA');
    expect(resolveTap(tap, { rings: [], view, project, unproject, locate })).toBe('FRA');
  });

  it('picks nothing off the globe or in the sea', () => {
    expect(resolveTap({ x: 0, y: 0 }, { rings: [], view, project, unproject: () => null, locate })).toBeNull();
    expect(resolveTap(project([-30, 45]), { rings: [], view, project, unproject, locate })).toBeNull();
  });

  // The owner's rule of 2026-11-21 (PR #3 had a ring win anywhere within
  // 26 px, which handed a third of Italy to Vatican City and San Marino).
  describe('over a country big enough to tap', () => {
    it("lets a ring win only within its bullseye", () => {
      // Vatican's ring is drawn over Rome; 8 px off its centre is Italy.
      const tap = { x: at('VAT').x + 8, y: at('VAT').y };
      expect(locate(unproject(tap))?.id).toBe('ITA');
      expect(resolveTap(tap, { rings: ringsOf('VAT'), view, project, unproject, locate })).toBe('VAT');
    });

    it('gives the rest of the drawn ring to the country underneath', () => {
      for (const dx of [11, 20, 25]) {
        const tap = { x: at('VAT').x + dx, y: at('VAT').y };
        expect(resolveTap(tap, { rings: ringsOf('VAT'), view, project, unproject, locate }), `${dx} px`).toBe('ITA');
      }
    });
  });

  it('lets a ring win anywhere within 26 px over the sea', () => {
    // Malta: 20 px east of its anchor is the open sea.
    const tap = { x: at('MLT').x + 20, y: at('MLT').y };
    expect(locate(unproject(tap))).toBeNull();
    expect(resolveTap(tap, { rings: ringsOf('MLT'), view, project, unproject, locate })).toBe('MLT');
    const beyond = { x: at('MLT').x + 27, y: at('MLT').y };
    expect(resolveTap(beyond, { rings: ringsOf('MLT'), view, project, unproject, locate })).toBeNull();
  });

  it('lets a ring win anywhere within 26 px over land outside the round', () => {
    // Only the continent's countries can be found, so another continent's
    // land counts as nothing underneath, like the sea.
    const elsewhere = () => null;
    const tap = { x: at('VAT').x + 20, y: at('VAT').y };
    expect(resolveTap(tap, { rings: ringsOf('VAT'), view, project, unproject, locate: elsewhere })).toBe('VAT');
  });

  it('lets the nearest ring win within 26 px over a country that has a ring of its own', () => {
    // A tap on San Marino's land that is nearer Vatican's ring: both are too
    // small to hit, so the rings decide, as before.
    const sanMarino = world.byId.get('SMR')!;
    const onSanMarino = () => sanMarino;
    const tap = { x: at('VAT').x + 20, y: at('VAT').y };
    expect(
      resolveTap(tap, { rings: ringsOf('VAT', 'SMR'), view, project, unproject, locate: onSanMarino }),
    ).toBe('VAT');
  });

  it('ignores rings on the far side of the globe', () => {
    // Seen from over the Pacific, Europe's rings are behind the horizon even
    // if the projection puts them under the pointer.
    const farView = { lat: 0, lng: -160, altitude: 0.9 };
    const tap = at('VAT');
    expect(resolveTap(tap, { rings: ringsOf('VAT'), view: farView, project, unproject: () => null, locate })).toBeNull();
  });
});
