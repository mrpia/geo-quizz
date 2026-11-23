import { fireEvent, screen } from '@testing-library/react';
import raw from '../data/world.json?raw';
import { parseWorld, type Area, type WorldTopology } from '../domain/world';
import type { GlobeViewProps } from '../components/GlobeView';
import type { Language } from '../i18n';
import { ExploreScreen } from '../screens/ExploreScreen';
import { renderWithLanguage } from './renderWithLanguage';

// jsdom has no WebGL: the globe becomes one button per country of its
// continent, plus one that stands for globe.gl finishing its first frame.
vi.mock('../components/GlobeView', () => ({
  GlobeView: ({ world, continent, skipTiny, includeSeas, selectedId, highlight, onPick, onReady }: GlobeViewProps) => (
    <div
      data-testid="globe"
      data-continent={continent}
      data-skip-tiny={String(skipTiny)}
      data-include-seas={String(includeSeas)}
      data-selected={selectedId ?? ''}
      data-correct={highlight?.correctId ?? ''}
    >
      <button type="button" data-testid="globe-ready" onClick={() => onReady?.()}>
        ready
      </button>
      {[...world.countries, ...world.oceans, ...(includeSeas ? world.seas : [])]
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

type Options = { continent?: Area; skipTiny?: boolean; includeSeas?: boolean; ready?: boolean; lang?: Language };

const setup = ({
  continent = 'europe',
  skipTiny = false,
  includeSeas = false,
  ready = true,
  lang = 'en',
}: Options = {}) => {
  const onHome = vi.fn();
  renderWithLanguage(
    <ExploreScreen
      world={world}
      continent={continent}
      skipTiny={skipTiny}
      includeSeas={includeSeas}
      onHome={onHome}
    />,
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

// The oceans (docs/plan.md, Phase 7).
describe('ExploreScreen: the oceans', () => {
  it('asks for an ocean, and names the one tapped in the language of the app', () => {
    setup({ continent: 'oceans', lang: 'de' });
    expect(screen.getByText('Tippe auf einen Ozean, um seinen Namen zu sehen')).toBeInTheDocument();
    expect(globe()).toHaveAttribute('data-continent', 'oceans');
    tap('southern');
    expect(name()).toHaveTextContent('Südlicher Ozean');
    expect(globe()).toHaveAttribute('data-selected', 'southern');
  });
});

// The seas (docs/plan.md, Phase 8): the switch applies to Explore too.
describe('ExploreScreen: the oceans with the seas', () => {
  it('asks for an ocean or a sea, and names the sea tapped', () => {
    setup({ continent: 'oceans', includeSeas: true, lang: 'de' });
    expect(screen.getByText('Tippe auf einen Ozean oder ein Meer, um seinen Namen zu sehen')).toBeInTheDocument();
    expect(globe()).toHaveAttribute('data-include-seas', 'true');
    tap('north-sea');
    expect(name()).toHaveTextContent('Nordsee');
    expect(globe()).toHaveAttribute('data-selected', 'north-sea');
  });

  it('asks for an ocean only while the seas are off', () => {
    setup({ continent: 'oceans' });
    expect(screen.getByText('Tap an ocean to see its name')).toBeInTheDocument();
    expect(globe()).toHaveAttribute('data-include-seas', 'false');
  });
});
