import { fireEvent, screen, within } from '@testing-library/react';
import { HomeScreen } from '../screens/HomeScreen';
import type { Settings } from '../domain/settings';
import { renderWithLanguage } from './renderWithLanguage';

const settings: Settings = {
  language: 'en',
  secondsPerQuestion: 10,
  countriesPerRound: 10,
  continent: 'africa',
};

const setup = (props: Partial<Parameters<typeof HomeScreen>[0]> = {}, lang = settings.language) => {
  const handlers = { onChange: vi.fn(), onStart: vi.fn(), onOpenSettings: vi.fn() };
  const all = { settings, roundSize: 10, ...handlers, ...props };
  renderWithLanguage(<HomeScreen {...all} />, lang);
  return handlers;
};

describe('HomeScreen', () => {
  it('offers the six continents as large buttons, the saved one chosen', () => {
    setup({ settings: { ...settings, language: 'de' } }, 'de');
    const group = screen.getByRole('radiogroup', { name: 'Wähle einen Kontinent' });
    const names = within(group).getAllByRole('radio').map((b) => b.textContent);
    expect(names).toEqual(['Europa', 'Afrika', 'Asien', 'Nordamerika', 'Südamerika', 'Ozeanien']);
    expect(within(group).getByRole('radio', { name: 'Afrika' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByRole('radio', { name: 'Europa' })).toHaveAttribute('aria-checked', 'false');
  });

  it('saves the continent the player chooses', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByTestId('continent-oceania'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...settings, continent: 'oceania' });
  });

  it('sums up the round', () => {
    setup();
    expect(screen.getByText('10 countries · 10 s each')).toBeInTheDocument();
  });

  it('counts the countries the round will really have', () => {
    // 50 countries asked of South America, which has 14: App passes 14.
    setup({ settings: { ...settings, countriesPerRound: 50, secondsPerQuestion: 7 }, roundSize: 14 });
    expect(screen.getByText('14 countries · 7 s each')).toBeInTheDocument();
  });

  it('says "1 country" for a round of one', () => {
    setup({ roundSize: 1 }, 'fr');
    expect(screen.getByText('1 pays · 10 s')).toBeInTheDocument();
  });

  it('starts the round and opens the settings', () => {
    const { onStart, onOpenSettings } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Start/ }));
    expect(onStart).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'settings' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('switches the language at once', () => {
    const { onChange } = setup();
    const toggle = screen.getByRole('radiogroup', { name: 'Language' });
    expect(within(toggle).getByRole('radio', { name: /English/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(toggle).getByRole('radio', { name: /Français/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...settings, language: 'fr' });
  });
});
