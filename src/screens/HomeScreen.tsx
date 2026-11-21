import { useId } from 'react';
import { LanguageToggle } from '../components/LanguageToggle';
import type { Settings } from '../domain/settings';
import { CONTINENTS } from '../domain/world';
import { continentName } from '../i18n';
import { useI18n } from '../i18n/I18nContext';
import './screens.css';
import './HomeScreen.css';

type Props = {
  settings: Settings;
  /**
   * How many countries the round will have: the setting, or fewer when the
   * continent has fewer (South America has 14).
   */
  roundSize: number;
  /** A changed continent or language, to save at once. */
  onChange: (next: Settings) => void;
  onStart: () => void;
  onOpenSettings: () => void;
};

export const HomeScreen = ({ settings, roundSize, onChange, onStart, onOpenSettings }: Props) => {
  const { t, lang } = useI18n();
  const titleId = useId();
  const seconds = settings.secondsPerQuestion;

  return (
    <div className="screen home">
      <header className="screen__header">
        <h1 className="screen__title">Geo Quizz</h1>
        <button
          type="button"
          className="screen__round-btn"
          data-testid="open-settings"
          aria-label={t('home.settingsAria')}
          onClick={onOpenSettings}
        >
          ⚙️
        </button>
      </header>
      <LanguageToggle value={settings.language} onChange={(language) => onChange({ ...settings, language })} />
      <section className="screen__panel">
        <h2 id={titleId} className="screen__panel-title">
          {t('home.continentTitle')}
        </h2>
        <div className="home__continents" role="radiogroup" aria-labelledby={titleId}>
          {CONTINENTS.map((continent) => (
            <button
              key={continent}
              type="button"
              role="radio"
              aria-checked={continent === settings.continent}
              className="home__continent"
              data-testid={`continent-${continent}`}
              onClick={() => onChange({ ...settings, continent })}
            >
              {continentName(continent, lang)}
            </button>
          ))}
        </div>
      </section>
      <p className="home__summary">
        {roundSize === 1
          ? t('home.summaryOne', { seconds })
          : t('home.summary', { count: roundSize, seconds })}
      </p>
      <button type="button" className="screen__primary-btn" data-testid="start-game" onClick={onStart}>
        <span aria-hidden="true">🌍</span> {t('home.start')}
      </button>
    </div>
  );
};
