import { fireEvent, screen } from '@testing-library/react';
import raw from '../data/world.json?raw';
import { parseWorld, type Continent, type WorldTopology } from '../domain/world';
import type { GlobeViewProps } from '../components/GlobeView';
import type { Language } from '../i18n';
import { ExploreScreen } from '../screens/ExploreScreen';
import { renderWithLanguage } from './renderWithLanguage';

// jsdom has no WebGL: the globe becomes one button per country of its
// continent, plus one that stands for globe.gl finishing its first frame.
vi.mock('../components/GlobeView', () => ({
  GlobeView: ({ world, continent, skipTiny, selectedId, highlight, onPick, onReady }: GlobeViewProps) => (
    <div
      data-testid="globe"
      data-continent={continent}
      data-skip-tiny={String(skipTiny)}
      data-selected={selectedId ?? ''}
      data-correct={highlight?.correctId ?? ''}
    >
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

const world = parseWorld(JSON.parse(raw) as WorldTopology);

type Options = { continent?: Continent; skipTiny?: boolean; ready?: boolean; lang?: Language };

const setup = ({ continent = 'europe', skipTiny = false, ready = true, lang = 'en' }: Options = {}) => {
  const onHome = vi.fn();
  renderWithLanguage(
    <ExploreScreen world={world} continent={continent} skipTiny={skipTiny} onHome={onHome} />,
    lang,
  );
  if (ready) fireEvent.click(screen.getByTestId('globe-ready'));
  return { onHome };
};

const tap = (id: string) => fireEvent.click(screen.getByTestId(`tap-${id}`));
const name = () => screen.queryByTestId('explore-name');
const globe = () => screen.getByTestId('globe');

describe('ExploreScreen', () => {
  it('asks the player to tap a country, and names none yet', () => {
    setup();
    expect(screen.getByText('Tap a country to see its name')).toBeInTheDocument();
    expect(name()).not.toBeInTheDocument();
    expect(globe()).toHaveAttribute('data-selected', '');
  });

  it('names the place tapped, in large type, and has the globe outline it', () => {
    setup();
    tap('FRA');
    expect(name()).toHaveTextContent('France');
    expect(name()).toHaveAttribute('data-id', 'FRA');
    expect(name()?.tagName).toBe('STRONG');
    expect(globe()).toHaveAttribute('data-selected', 'FRA');
    // It judges nothing: no answer to show on the globe.
    expect(globe()).toHaveAttribute('data-correct', '');
  });

  it('replaces the name with the next place tapped', () => {
    setup();
    tap('FRA');
    tap('POL');
    expect(name()).toHaveTextContent('Poland');
    expect(globe()).toHaveAttribute('data-selected', 'POL');
    tap('POL');
    expect(name()).toHaveTextContent('Poland');
  });

  it("names it in the app's language only", () => {
    setup({ lang: 'de' });
    expect(screen.getByText('Tippe auf ein Land, um seinen Namen zu sehen')).toBeInTheDocument();
    tap('DEU');
    expect(name()).toHaveTextContent(/^Deutschland$/);
  });

  it('says it in French too', () => {
    setup({ lang: 'fr' });
    expect(screen.getByText('Touche un pays pour voir son nom')).toBeInTheDocument();
    tap('DEU');
    expect(name()).toHaveTextContent(/^Allemagne$/);
  });

  it('shows nothing to read, and takes no tap, until the globe is drawn', () => {
    setup({ ready: false });
    expect(screen.queryByText('Tap a country to see its name')).not.toBeInTheDocument();
    tap('FRA');
    expect(name()).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('globe-ready'));
    expect(screen.getByText('Tap a country to see its name')).toBeInTheDocument();
    expect(name()).not.toBeInTheDocument();
    expect(globe()).toHaveAttribute('data-selected', '');
  });

  it('explores the continent chosen, with the switch for the tiny countries', () => {
    setup({ continent: 'oceania', skipTiny: true });
    expect(globe()).toHaveAttribute('data-continent', 'oceania');
    expect(globe()).toHaveAttribute('data-skip-tiny', 'true');
  });

  it('has no countdown, no counter and no score', () => {
    setup();
    tap('FRA');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    for (const testId of ['game-counter', 'game-score', 'game-target', 'game-verdict']) {
      expect(screen.queryByTestId(testId), testId).not.toBeInTheDocument();
    }
  });

  it('goes home with 🏠', () => {
    const { onHome } = setup({ ready: false });
    const home = screen.getByRole('button', { name: 'back to home' });
    expect(home).toHaveTextContent('🏠');
    fireEvent.click(home);
    expect(onHome).toHaveBeenCalledOnce();
  });
});
