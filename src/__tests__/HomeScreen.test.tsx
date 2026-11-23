import { cleanup, fireEvent, screen, within } from '@testing-library/react';
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
  includeSeas: false,
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
  it('offers the six continents and the oceans as large buttons, the saved one chosen', () => {
    setup({ settings: { ...settings, language: 'de' } }, 'de');
    // The tiles of both groups; the language toggle has radios of its own.
    const names = screen.getAllByTestId(/^continent-/).map((b) => b.textContent);
    expect(names).toEqual([
      'Europa',
      'Afrika',
      'Asien',
      'Nord- und Mittelamerika',
      'Südamerika',
      'Ozeanien',
      'Ozeane und Meere',
    ]);
    expect(screen.getByRole('radio', { name: 'Afrika' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Europa' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Ozeane und Meere' })).toHaveAttribute('aria-checked', 'false');
  });

  // docs/plan.md, Phase 8: Oceania and the oceans, side by side, looked
  // alike; the tiles now sit under "Land" and "Water". Two radio groups, one
  // choice: a radiogroup may hold only radios, not a group or a heading.
  it('groups the continents under "Land" and the oceans and seas under "Water"', () => {
    setup();
    const land = screen.getByRole('radiogroup', { name: 'Where do you want to play? Land' });
    const water = screen.getByRole('radiogroup', { name: 'Where do you want to play? Water' });
    expect(screen.getByRole('heading', { name: 'Land' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Water' })).toBeInTheDocument();
    expect(within(land).getAllByRole('radio').map((b) => b.dataset.testid)).toEqual([
      'continent-europe',
      'continent-africa',
      'continent-asia',
      'continent-north-america',
      'continent-south-america',
      'continent-oceania',
    ]);
    expect(within(water).getAllByRole('radio').map((b) => b.textContent)).toEqual(['Oceans & seas']);
  });

  it('names the groups in every language', () => {
    setup({}, 'fr');
    expect(screen.getByRole('radiogroup', { name: 'Où veux-tu jouer ? Sur terre' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('radiogroup', { name: "Où veux-tu jouer ? Sur l'eau" })).getByRole('radio'),
    ).toHaveTextContent('Océans et mers');
    cleanup();
    setup({}, 'de');
    expect(screen.getByRole('radiogroup', { name: 'Wo möchtest du spielen? Land' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Wo möchtest du spielen? Wasser' })).toBeInTheDocument();
  });

  it('puts no group and no heading inside a radio group', () => {
    setup();
    for (const group of screen.getAllByRole('radiogroup')) {
      expect(within(group).queryAllByRole('group')).toHaveLength(0);
      expect(within(group).queryAllByRole('heading')).toHaveLength(0);
    }
  });

  it('saves the continent the player chooses', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByTestId('continent-oceania'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...settings, continent: 'oceania' });
  });

  it('saves the oceans as the continent, the field that holds the choice', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByTestId('continent-oceans'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...settings, continent: 'oceans' });
  });

  it('asks where to play in every language', () => {
    setup({}, 'fr');
    expect(screen.getByRole('heading', { name: 'Où veux-tu jouer ?' })).toBeInTheDocument();
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

  it('counts oceans, not countries, in an oceans round', () => {
    const oceans = { ...settings, continent: 'oceans' as const };
    setup({ settings: oceans, roundSize: 5 });
    expect(screen.getByText('5 oceans · 10 s each')).toBeInTheDocument();
  });

  it('says it in every language, with or without a time limit, for one ocean or more', () => {
    const oceans = { ...settings, continent: 'oceans' as const };
    setup({ settings: oceans, roundSize: 5 }, 'de');
    expect(screen.getByText('5 Ozeane · 10 s pro Ozean')).toBeInTheDocument();
    cleanup();
    setup({ settings: { ...oceans, timeLimitOn: false }, roundSize: 5 }, 'fr');
    expect(screen.getByText('5 océans · sans limite de temps')).toBeInTheDocument();
    cleanup();
    setup({ settings: oceans, roundSize: 1 }, 'fr');
    expect(screen.getByText('1 océan · 10 s')).toBeInTheDocument();
    cleanup();
    setup({ settings: { ...oceans, timeLimitOn: false }, roundSize: 1 }, 'en');
    expect(screen.getByText('1 ocean · no time limit')).toBeInTheDocument();
  });

  it('hides the tiny-countries switch while the oceans are chosen, and keeps the time limit', () => {
    setup({ settings: { ...settings, continent: 'oceans' } });
    expect(screen.queryByRole('switch', { name: 'Tiny countries' })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Time limit' })).toBeInTheDocument();
  });

  it('offers the seas switch only while the oceans are chosen, set as saved', () => {
    setup();
    expect(screen.queryByTestId('switch-seas')).not.toBeInTheDocument();
    cleanup();
    setup({ settings: { ...settings, continent: 'oceans', includeSeas: true } }, 'de');
    expect(screen.getByRole('switch', { name: 'Meere' })).toHaveAttribute('aria-checked', 'true');
    cleanup();
    setup({ settings: { ...settings, continent: 'oceans' } }, 'fr');
    expect(screen.getByRole('switch', { name: 'Mers' })).toHaveAttribute('aria-checked', 'false');
  });

  it('saves the seas switch at once, and keeps the time limit beside it', () => {
    const oceans = { ...settings, continent: 'oceans' as const };
    const { onChange } = setup({ settings: oceans });
    expect(screen.getByRole('switch', { name: 'Time limit' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Seas' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...oceans, includeSeas: true });
  });

  it('counts oceans and seas when the seas are on, in every language', () => {
    const waters = { ...settings, continent: 'oceans' as const, includeSeas: true };
    setup({ settings: waters, roundSize: 10 });
    expect(screen.getByText('10 oceans and seas · 10 s each')).toBeInTheDocument();
    cleanup();
    setup({ settings: { ...waters, timeLimitOn: false }, roundSize: 10 }, 'de');
    expect(screen.getByText('10 Ozeane und Meere · ohne Zeitlimit')).toBeInTheDocument();
    cleanup();
    setup({ settings: waters, roundSize: 1 }, 'fr');
    expect(screen.getByText('1 océan ou mer · 10 s')).toBeInTheDocument();
    cleanup();
    setup({ settings: { ...waters, timeLimitOn: false }, roundSize: 1 }, 'en');
    expect(screen.getByText('1 ocean or sea · no time limit')).toBeInTheDocument();
  });

  it('keeps counting countries on a continent, whatever the seas switch says', () => {
    setup({ settings: { ...settings, includeSeas: true } });
    expect(screen.getByText('10 countries · 10 s each')).toBeInTheDocument();
  });

  it('says "1 country" for a round of one', () => {
    setup({ roundSize: 1 }, 'fr');
    expect(screen.getByText('1 pays · 10 s')).toBeInTheDocument();
  });

  it('offers two switches, set as saved, each one on for the harder game', () => {
    // docs/plan.md, Phase 5: "Tiny countries" on means they are asked, so it
    // shows the stored `skipTiny` the other way round.
    setup({ settings: { ...settings, timeLimitOn: true, skipTiny: false } });
    expect(screen.getByRole('switch', { name: 'Time limit' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Tiny countries' })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows both off for the easier game', () => {
    setup({ settings: { ...settings, timeLimitOn: false, skipTiny: true } });
    expect(screen.getByRole('switch', { name: 'Time limit' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Tiny countries' })).toHaveAttribute('aria-checked', 'false');
  });

  it('names the switches in the language of the app', () => {
    setup({ settings: { ...settings, language: 'de' } }, 'de');
    expect(screen.getByRole('switch', { name: 'Zeitlimit' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Ganz kleine Länder' })).toBeInTheDocument();
  });

  it('saves each switch on its own, at once', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByTestId('switch-time-limit'));
    expect(onChange).toHaveBeenLastCalledWith({ ...settings, timeLimitOn: false });
    // On (the tiny countries asked) to off: they are left out.
    fireEvent.click(screen.getByTestId('switch-tiny'));
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

  it('names the ℹ️ button "Über die App" in German, not a bare "über"', () => {
    setup({ settings: { ...settings, language: 'de' } }, 'de');
    expect(screen.getByRole('button', { name: 'Über die App' })).toHaveTextContent('ℹ️');
  });

  it('switches the language at once', () => {
    const { onChange } = setup();
    const toggle = screen.getByRole('radiogroup', { name: 'Language' });
    expect(within(toggle).getByRole('radio', { name: /English/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(toggle).getByRole('radio', { name: /Français/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...settings, language: 'fr' });
  });
});
