import { fireEvent, screen, within } from '@testing-library/react';
import { HomeScreen } from '../screens/HomeScreen';
import type { Settings } from '../domain/settings';
import { renderWithLanguage } from './renderWithLanguage';

const settings: Settings = {
  language: 'en',
  secondsPerQuestion: 10,
  countriesPerRound: 10,
  continent: 'africa',
  timeLimitOn: true,
  skipTiny: false,
};

const setup = (props: Partial<Parameters<typeof HomeScreen>[0]> = {}, lang = settings.language) => {
  const handlers = {
    onChange: vi.fn(),
    onStart: vi.fn(),
    onExplore: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenAbout: vi.fn(),
  };
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

  it('offers two switches, set as saved', () => {
    setup({ settings: { ...settings, timeLimitOn: false, skipTiny: true } });
    expect(screen.getByRole('switch', { name: 'Time limit' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Without the tiny countries' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('names the switches in the language of the app', () => {
    setup({ settings: { ...settings, language: 'de' } }, 'de');
    expect(screen.getByRole('switch', { name: 'Zeitlimit' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Ohne die ganz kleinen Länder' })).toBeInTheDocument();
  });

  it('saves each switch on its own, at once', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByTestId('switch-time-limit'));
    expect(onChange).toHaveBeenLastCalledWith({ ...settings, timeLimitOn: false });
    fireEvent.click(screen.getByTestId('switch-skip-tiny'));
    expect(onChange).toHaveBeenLastCalledWith({ ...settings, skipTiny: true });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('says "no time limit" in the summary, in place of the seconds, when the limit is off', () => {
    setup({ settings: { ...settings, timeLimitOn: false } });
    expect(screen.getByText('10 countries · no time limit')).toBeInTheDocument();
  });

  it('says it for a round of one too', () => {
    setup({ settings: { ...settings, timeLimitOn: false }, roundSize: 1 }, 'fr');
    expect(screen.getByText('1 pays · sans limite de temps')).toBeInTheDocument();
  });

  it('starts the round and opens the settings', () => {
    const { onStart, onOpenSettings } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Start/ }));
    expect(onStart).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'settings' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('offers Explore under Start', () => {
    const { onExplore, onStart } = setup({}, 'de');
    const start = screen.getByRole('button', { name: /Starten/ });
    const explore = screen.getByRole('button', { name: /Entdecken/ });
    expect(start.compareDocumentPosition(explore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(explore);
    expect(onExplore).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('opens the About screen with ℹ️', () => {
    const { onOpenAbout } = setup({}, 'fr');
    const about = screen.getByRole('button', { name: 'à propos' });
    expect(about).toHaveTextContent('ℹ️');
    fireEvent.click(about);
    expect(onOpenAbout).toHaveBeenCalledOnce();
  });

  it('switches the language at once', () => {
    const { onChange } = setup();
    const toggle = screen.getByRole('radiogroup', { name: 'Language' });
    expect(within(toggle).getByRole('radio', { name: /English/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(toggle).getByRole('radio', { name: /Français/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...settings, language: 'fr' });
  });
});
