import { render, screen } from '@testing-library/react';
import raw from '../data/world.json?raw';
import { parseWorld, type WorldTopology } from '../domain/world';
import { LanguageProvider } from '../i18n/I18nContext';
import { GlobeView } from '../components/GlobeView';

// Its own file: the chunk that holds globe.gl and three.js fails to load
// (offline after a deploy, say), so every import of it throws.
vi.mock('globe.gl', () => {
  throw new Error('chunk failed to load');
});

const world = parseWorld(JSON.parse(raw) as WorldTopology);

it('says so when globe.gl cannot be loaded', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <LanguageProvider lang="en">
      <GlobeView world={world} continent="europe" skipTiny={false} onPick={vi.fn()} />
    </LanguageProvider>,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('The map could not be loaded.');
  expect(screen.getByTestId('globe')).toHaveAttribute('data-state', 'error');
  expect(screen.queryByText('Loading the map…')).not.toBeInTheDocument();
  expect(logged).toHaveBeenCalled();
  logged.mockRestore();
});
