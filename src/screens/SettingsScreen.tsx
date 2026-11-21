import { useId, useState } from 'react';
import { LanguageToggle } from '../components/LanguageToggle';
import { SETTINGS_BOUNDS, sanitizeSettings, type Settings } from '../domain/settings';
import { useI18n } from '../i18n/I18nContext';
import './screens.css';
import './SettingsScreen.css';

type Props = {
  settings: Settings;
  /** Saved settings: the numbers on Save, the language as soon as it is picked. */
  onSave: (next: Settings) => void;
  onBack: () => void;
};

// An emptied field, or text the browser cannot read as a number yet, reads
// as ''; Number('') is 0, which math-quizz once saved as the minimum without
// a word (its #49). Anything that does not parse keeps the saved value.
const readNumber = (raw: string, fallback: number): number => {
  const value = Number(raw);
  return raw.trim() !== '' && Number.isFinite(value) ? value : fallback;
};

export const SettingsScreen = ({ settings, onSave, onBack }: Props) => {
  const { t } = useI18n();
  const secondsId = useId();
  const countriesId = useId();
  // Held as the text in the field: a number state would turn an emptied
  // field into 0 and write it back into the field.
  const [seconds, setSeconds] = useState(String(settings.secondsPerQuestion));
  const [countries, setCountries] = useState(String(settings.countriesPerRound));

  const submit = () => {
    // The same gate as storage: clamped to the bounds, then rounded. The
    // language passed is never used, since `settings.language` is valid.
    onSave(
      sanitizeSettings(
        {
          ...settings,
          secondsPerQuestion: readNumber(seconds, settings.secondsPerQuestion),
          countriesPerRound: readNumber(countries, settings.countriesPerRound),
        },
        [settings.language],
      ),
    );
    onBack();
  };

  return (
    <div className="screen settings">
      <header className="screen__header settings__header">
        <button
          type="button"
          className="screen__round-btn"
          data-testid="settings-back"
          aria-label={t('common.backToHomeAria')}
          onClick={onBack}
        >
          🏠
        </button>
        <h2 className="screen__title">{t('settings.title')}</h2>
      </header>
      <section className="screen__panel">
        <label className="settings__field" htmlFor={secondsId}>
          <span>{t('settings.secondsPerQuestion')}</span>
          <input
            id={secondsId}
            className="settings__number"
            data-testid="settings-seconds"
            type="number"
            inputMode="numeric"
            min={SETTINGS_BOUNDS.secondsPerQuestion.min}
            max={SETTINGS_BOUNDS.secondsPerQuestion.max}
            step={1}
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
          />
        </label>
        <label className="settings__field" htmlFor={countriesId}>
          <span>{t('settings.countriesPerRound')}</span>
          <input
            id={countriesId}
            className="settings__number"
            data-testid="settings-countries"
            type="number"
            inputMode="numeric"
            min={SETTINGS_BOUNDS.countriesPerRound.min}
            max={SETTINGS_BOUNDS.countriesPerRound.max}
            step={1}
            value={countries}
            onChange={(e) => setCountries(e.target.value)}
          />
        </label>
      </section>
      <section className="screen__panel">
        <h3 className="screen__panel-title">{t('settings.language')}</h3>
        <LanguageToggle
          value={settings.language}
          onChange={(language) => onSave({ ...settings, language })}
        />
      </section>
      <button type="button" className="screen__primary-btn" data-testid="settings-save" onClick={submit}>
        {t('settings.save')}
      </button>
    </div>
  );
};
