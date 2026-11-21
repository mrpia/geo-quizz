import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import raw from '../data/world.json?raw';
import { parseWorld, type WorldTopology } from '../domain/world';
import type { GlobeViewProps } from '../components/GlobeView';
import { SETTINGS_KEY } from '../storage/settingsStore';
import { App } from '../App';

// jsdom has no WebGL: the globe becomes a list of buttons, one per country
// of the continent it was given (the pattern Phase 3's screen tests follow).
vi.mock('../components/GlobeView', () => ({
  GlobeView: ({ world, continent, onPick, highlight }: GlobeViewProps) => (
    <div data-testid="globe" data-continent={continent} data-highlight={highlight?.correctId ?? ''}>
      {world.countries
        .filter((c) => c.properties.continent === continent)
        .map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c.id)}>
            {c.id}
          </button>
        ))}
    </div>
  ),
}));

vi.mock('../data/loadWorld', () => ({
  loadWorld: async () => parseWorld(JSON.parse(raw) as WorldTopology),
}));

describe('App (Phase 2 globe preview)', () => {
  it('starts on Europe, with one button per continent in the chosen language', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ language: 'de' }));
    render(<App />);
    expect(await screen.findByTestId('globe')).toHaveAttribute('data-continent', 'europe');
    for (const name of ['Europa', 'Afrika', 'Asien', 'Nordamerika', 'Südamerika', 'Ozeanien']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Europa' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches the globe to another continent', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ language: 'en' }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByTestId('globe');
    await user.click(screen.getByTestId('continent-africa'));
    expect(screen.getByTestId('globe')).toHaveAttribute('data-continent', 'africa');
    expect(screen.getByTestId('continent-africa')).toHaveAttribute('aria-pressed', 'true');
  });

  it('names and highlights the country picked, until the continent changes', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ language: 'fr' }));
    const user = userEvent.setup();
    render(<App />);
    const globe = await screen.findByTestId('globe');
    expect(screen.getByTestId('picked')).toHaveAttribute('data-id', '');
    await user.click(within(globe).getByRole('button', { name: 'CHE' }));
    expect(screen.getByTestId('picked')).toHaveAttribute('data-id', 'CHE');
    expect(screen.getByTestId('picked')).toHaveTextContent('Suisse');
    expect(globe).toHaveAttribute('data-highlight', 'CHE');
    await user.click(screen.getByTestId('continent-asia'));
    expect(screen.getByTestId('picked')).toHaveAttribute('data-id', '');
    expect(screen.getByTestId('globe')).toHaveAttribute('data-highlight', '');
  });
});
