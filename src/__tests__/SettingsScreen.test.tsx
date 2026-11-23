import { fireEvent, screen, within } from '@testing-library/react';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { Settings } from '../domain/settings';
import { renderWithLanguage } from './renderWithLanguage';

const settings: Settings = {
  language: 'en',
  secondsPerQuestion: 10,
  countriesPerRound: 10,
  continent: 'asia',
  // Not the defaults, so a Save that dropped them would show.
  timeLimitOn: false,
  skipTiny: true,
};

const setup = (lang = settings.language) => {
  const onSave = vi.fn();
  const onBack = vi.fn();
  renderWithLanguage(<SettingsScreen settings={settings} onSave={onSave} onBack={onBack} />, lang);
  return { onSave, onBack };
};

const seconds = () => screen.getByRole('spinbutton', { name: 'Seconds per question' });
const countries = () => screen.getByRole('spinbutton', { name: 'Questions per round' });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('SettingsScreen', () => {
  it('shows the saved values, with their bounds', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(seconds()).toHaveValue(10);
    expect(seconds()).toHaveAttribute('min', '3');
    expect(seconds()).toHaveAttribute('max', '60');
    expect(countries()).toHaveValue(10);
    expect(countries()).toHaveAttribute('min', '1');
    expect(countries()).toHaveAttribute('max', '50');
  });

  it('saves the new values, then goes back', () => {
    const { onSave, onBack } = setup();
    fireEvent.change(seconds(), { target: { value: '25' } });
    fireEvent.change(countries(), { target: { value: '5' } });
    save();
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ ...settings, secondsPerQuestion: 25, countriesPerRound: 5 });
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('clamps and rounds what it saves', () => {
    const { onSave } = setup();
    fireEvent.change(seconds(), { target: { value: '1' } });
    fireEvent.change(countries(), { target: { value: '7.6' } });
    save();
    expect(onSave).toHaveBeenCalledWith({ ...settings, secondsPerQuestion: 3, countriesPerRound: 8 });
  });

  it('keeps the saved value for a field left empty', () => {
    // An emptied number field reads as '', which Number() would turn into 0
    // (math-quizz #49).
    const { onSave } = setup();
    fireEvent.change(seconds(), { target: { value: '' } });
    save();
    expect(onSave).toHaveBeenCalledWith(settings);
  });

  it('switches the language at once, without saving the numbers being edited', () => {
    const { onSave, onBack } = setup();
    fireEvent.change(seconds(), { target: { value: '30' } });
    const toggle = screen.getByRole('radiogroup', { name: 'Language' });
    fireEvent.click(within(toggle).getByRole('radio', { name: /Deutsch/ }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ ...settings, language: 'de' });
    expect(onBack).not.toHaveBeenCalled();
    expect(seconds()).toHaveValue(30);
  });

  it('goes back home without saving', () => {
    const { onSave, onBack } = setup('fr');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Secondes par question' }), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: "retour à l'accueil" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
