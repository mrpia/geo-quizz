import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import raw from '../data/world.json?raw';
import { countriesOf, parseWorld, type WorldTopology } from '../domain/world';
import type { GlobeViewProps } from '../components/GlobeView';
import { loadWorld } from '../data/loadWorld';
import { SETTINGS_KEY } from '../storage/settingsStore';
import { App } from '../App';

// jsdom has no WebGL: the globe becomes one button per country of its
// continent, plus one that stands for globe.gl finishing its first frame.
vi.mock('../components/GlobeView', () => ({
  GlobeView: ({ world, continent, skipTiny, onPick, onReady }: GlobeViewProps) => (
    <div data-testid="globe" data-continent={continent} data-skip-tiny={String(skipTiny)}>
      <button type="button" data-testid="globe-ready" onClick={() => onReady?.()}>
        ready
      </button>
      {world.countries
        .filter((c) => c.properties.continent === continent)
        .map((c) => (
          <button key={c.id} type="button" data-testid={`tap-${c.id}`} onClick={() => onPick(c.id)}>
            {c.id}
          </button>
        ))}
    </div>
  ),
}));

vi.mock('../data/loadWorld', () => ({ loadWorld: vi.fn() }));

const world = parseWorld(JSON.parse(raw) as WorldTopology);

beforeEach(() => {
  vi.mocked(loadWorld).mockResolvedValue(world);
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const stored = (settings: object) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
const saved = () => JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Record<string, unknown>;

/** Renders the app as main.tsx does, and lets the map finish loading. */
const open = async () => {
  const view = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await act(async () => {});
  return view;
};

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const click = (testId: string) => fireEvent.click(screen.getByTestId(testId));
const target = () => screen.getByTestId('game-target').dataset.id!;

describe('App: Home', () => {
  it('opens on Home, in the saved language, with the saved continent chosen', async () => {
    stored({ language: 'de', continent: 'oceania' });
    await open();
    expect(screen.getByRole('button', { name: /Starten/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Ozeanien' })).toHaveAttribute('aria-checked', 'true');
  });

  it('remembers the continent chosen, for the next visit', async () => {
    stored({ language: 'en' });
    const { unmount } = await open();
    expect(screen.getByTestId('continent-europe')).toHaveAttribute('aria-checked', 'true');
    click('continent-asia');
    expect(saved().continent).toBe('asia');
    unmount();
    await open();
    expect(screen.getByTestId('continent-asia')).toHaveAttribute('aria-checked', 'true');
  });

  it("counts the round's countries from the continent once the map is loaded", async () => {
    stored({ language: 'en', countriesPerRound: 50, continent: 'south-america' });
    await open();
    expect(screen.getByText('14 countries · 10 s each')).toBeInTheDocument();
    click('continent-europe');
    expect(screen.getByText('50 countries · 10 s each')).toBeInTheDocument();
  });

  it('switches the whole app to the language picked', async () => {
    stored({ language: 'en' });
    await open();
    click('language-fr');
    expect(screen.getByRole('button', { name: /Lancer/ })).toBeInTheDocument();
    expect(saved().language).toBe('fr');
  });
});

describe('App: the two switches on Home', () => {
  const isOn = (testId: string) => screen.getByTestId(testId).getAttribute('aria-checked');

  it('starts with the time limit on and every place asked', async () => {
    stored({ language: 'en' });
    await open();
    expect(isOn('switch-time-limit')).toBe('true');
    expect(isOn('switch-skip-tiny')).toBe('false');
  });

  it('remembers both, for the next visit', async () => {
    stored({ language: 'en' });
    const { unmount } = await open();
    click('switch-time-limit');
    click('switch-skip-tiny');
    expect(saved()).toMatchObject({ timeLimitOn: false, skipTiny: true });
    unmount();
    await open();
    expect(isOn('switch-time-limit')).toBe('false');
    expect(isOn('switch-skip-tiny')).toBe('true');
  });

  it('counts and plays only the places of 1,000 km² or more when the tiny ones are left out', async () => {
    stored({ language: 'en', continent: 'oceania' });
    await open();
    expect(screen.getByText('10 countries · 10 s each')).toBeInTheDocument();
    click('switch-skip-tiny');
    // Oceania keeps 9 of its 25 places (world.test.ts).
    expect(screen.getByText('9 countries · 10 s each')).toBeInTheDocument();
    click('start-game');
    click('globe-ready');
    expect(screen.getByTestId('game-counter')).toHaveTextContent('1 / 9');
    expect(world.byId.get(target())!.properties.areaKm2).toBeGreaterThanOrEqual(1_000);
  });

  it('plays without a countdown when the time limit is off, and keeps the seconds for later', async () => {
    stored({ language: 'en', secondsPerQuestion: 20 });
    await open();
    click('switch-time-limit');
    expect(screen.getByText('10 countries · no time limit')).toBeInTheDocument();
    click('start-game');
    click('globe-ready');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    advance(60_000);
    expect(screen.queryByTestId('game-verdict')).not.toBeInTheDocument();
    click('quit-game');
    click('switch-time-limit');
    expect(screen.getByText('10 countries · 20 s each')).toBeInTheDocument();
  });
});

describe('App: a round', () => {
  it('plays a round from Home to the results, then again on the same continent', async () => {
    stored({ language: 'en', countriesPerRound: 2, continent: 'africa' });
    await open();
    click('start-game');
    expect(screen.getByTestId('globe')).toHaveAttribute('data-continent', 'africa');
    click('globe-ready');
    const first = target();
    click(`tap-${first}`);
    advance(1_000);
    const wrong = countriesOf(world, 'africa').find((c) => c.id !== target())!.id;
    click(`tap-${wrong}`);
    advance(2_500);

    expect(screen.getByTestId('results-score')).toHaveTextContent('1 / 2');
    const rows = screen.getAllByTestId('results-row');
    expect(rows.map((r) => r.dataset.outcome)).toEqual(['correct', 'wrong']);

    click('play-again');
    expect(screen.getByTestId('globe')).toHaveAttribute('data-continent', 'africa');
    expect(screen.getByTestId('game-counter')).toHaveTextContent('1 / 2');
    expect(screen.queryByTestId('game-verdict')).not.toBeInTheDocument();
  });

  it('goes home from the results', async () => {
    stored({ language: 'en', countriesPerRound: 1, secondsPerQuestion: 3 });
    await open();
    click('start-game');
    click('globe-ready');
    advance(3_100);
    advance(2_500);
    expect(within(screen.getAllByTestId('results-row')[0]).getByRole('img', { name: 'wrong' })).toBeInTheDocument();
    click('results-home');
    expect(screen.getByTestId('start-game')).toBeInTheDocument();
  });

  it('quits back home with the ✕, and shows no results', async () => {
    stored({ language: 'en' });
    await open();
    click('start-game');
    click('globe-ready');
    click(`tap-${target()}`);
    click('quit-game');
    expect(screen.getByTestId('start-game')).toBeInTheDocument();
    advance(5_000);
    expect(screen.queryByTestId('results-score')).not.toBeInTheDocument();
  });
});

describe('App: explore', () => {
  const name = () => screen.queryByTestId('explore-name');

  it('explores the continent chosen, with the switch for the tiny countries, and goes home', async () => {
    stored({ language: 'en', continent: 'oceania' });
    await open();
    click('switch-skip-tiny');
    click('start-explore');
    expect(screen.getByTestId('globe')).toHaveAttribute('data-continent', 'oceania');
    expect(screen.getByTestId('globe')).toHaveAttribute('data-skip-tiny', 'true');
    click('globe-ready');
    click('tap-AUS');
    expect(name()).toHaveTextContent('Australia');
    // No clock: nothing happens however long the player looks.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    advance(60_000);
    expect(name()).toHaveTextContent('Australia');
    click('explore-home');
    expect(screen.getByTestId('start-game')).toBeInTheDocument();
    expect(saved()).toMatchObject({ continent: 'oceania', skipTiny: true });
  });

  it('starts with no name each time', async () => {
    stored({ language: 'en' });
    await open();
    click('start-explore');
    click('globe-ready');
    click('tap-FRA');
    click('explore-home');
    click('start-explore');
    click('globe-ready');
    expect(name()).not.toBeInTheDocument();
  });

  it('waits for the map, as a round does', async () => {
    let resolve: (value: typeof world) => void = () => {};
    vi.mocked(loadWorld).mockReturnValue(new Promise((r) => (resolve = r)));
    stored({ language: 'en' });
    await open();
    click('start-explore');
    expect(screen.getByText('Loading the map…')).toBeInTheDocument();
    click('status-home');
    expect(screen.getByTestId('start-game')).toBeInTheDocument();
    click('start-explore');
    await act(async () => resolve(world));
    expect(screen.getByTestId('explore-home')).toBeInTheDocument();
    expect(screen.getByTestId('globe')).toBeInTheDocument();
  });
});

describe('App: settings', () => {
  it('saves the settings and plays the next round with them', async () => {
    stored({ language: 'en' });
    await open();
    click('open-settings');
    fireEvent.change(screen.getByTestId('settings-countries'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('settings-seconds'), { target: { value: '20' } });
    click('settings-save');
    expect(screen.getByText('4 countries · 20 s each')).toBeInTheDocument();
    expect(saved()).toMatchObject({ countriesPerRound: 4, secondsPerQuestion: 20 });
    click('start-game');
    expect(screen.getByTestId('game-counter')).toHaveTextContent('1 / 4');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '20');
  });

  it('goes back home without saving', async () => {
    stored({ language: 'en' });
    await open();
    click('open-settings');
    fireEvent.change(screen.getByTestId('settings-countries'), { target: { value: '4' } });
    click('settings-back');
    expect(screen.getByText('10 countries · 10 s each')).toBeInTheDocument();
  });
});

describe('App: about', () => {
  it('shows the version of this build, and goes back home', async () => {
    stored({ language: 'en' });
    await open();
    click('open-about');
    expect(screen.getByTestId('about-version')).toHaveTextContent(`version ${__APP_VERSION__}`);
    click('about-back');
    expect(screen.getByTestId('start-game')).toBeInTheDocument();
  });
});

describe('App: the map', () => {
  it('waits for the map, then starts the round', async () => {
    let resolve: (value: typeof world) => void = () => {};
    vi.mocked(loadWorld).mockReturnValue(new Promise((r) => (resolve = r)));
    stored({ language: 'en' });
    await open();
    click('start-game');
    expect(screen.getByText('Loading the map…')).toBeInTheDocument();
    await act(async () => resolve(world));
    expect(screen.getByTestId('globe')).toBeInTheDocument();
  });

  it('says so when the map cannot be loaded, and lets the player go home', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(loadWorld).mockRejectedValue(new Error('world data: HTTP 404'));
    stored({ language: 'en' });
    await open();
    click('start-game');
    expect(screen.getByRole('alert')).toHaveTextContent('The map could not be loaded.');
    expect(logged).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'back to home' }));
    expect(screen.getByTestId('start-game')).toBeInTheDocument();
    logged.mockRestore();
  });
});
