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

  it('lets a ring win over the country underneath', () => {
    // Vatican's ring is drawn over Rome; a tap 20 px off its centre lands on
    // Italy but still picks Vatican City.
    const tap = { x: at('VAT').x + 20, y: at('VAT').y };
    expect(locate(unproject(tap))?.id).toBe('ITA');
    expect(resolveTap(tap, { rings: ringsOf('VAT'), view, project, unproject, locate })).toBe('VAT');
  });

  it('lets the country win once the tap is outside every ring', () => {
    const tap = { x: at('VAT').x + 30, y: at('VAT').y };
    expect(resolveTap(tap, { rings: ringsOf('VAT'), view, project, unproject, locate })).toBe('ITA');
  });

  it('ignores rings on the far side of the globe', () => {
    // Seen from over the Pacific, Europe's rings are behind the horizon even
    // if the projection puts them under the pointer.
    const farView = { lat: 0, lng: -160, altitude: 0.9 };
    const tap = at('VAT');
    expect(resolveTap(tap, { rings: ringsOf('VAT'), view: farView, project, unproject: () => null, locate })).toBeNull();
  });
});
