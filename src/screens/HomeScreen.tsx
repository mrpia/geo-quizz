import { useId } from 'react';
import { LanguageToggle } from '../components/LanguageToggle';
import type { Settings } from '../domain/settings';
import { AREAS } from '../domain/world';
import { continentName } from '../i18n';
import { useI18n } from '../i18n/I18nContext';
import './screens.css';
import './HomeScreen.css';

type Props = {
  settings: Settings;
  /**
   * How many countries the round will have: the setting, or fewer when the
   * round has fewer places (South America has 14; Oceania without the tiny
   * countries has 9; the oceans are five).
   */
  roundSize: number;
  /** A changed continent, switch or language, to save at once. */
  onChange: (next: Settings) => void;
  onStart: () => void;
  /** Explore mode (plan, Phase 6): the same globe, no question. */
  onExplore: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
};

type SwitchProps = {
  label: string;
  on: boolean;
  testId: string;
  onToggle: () => void;
};

/**
 * An on/off switch the size of a finger: the whole row is the target. The
 * thumb's side says on or off, so the colour is never the only sign.
 */
const Switch = ({ label, on, testId, onToggle }: SwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    className="home__switch"
    data-testid={testId}
    onClick={onToggle}
  >
    <span className="home__switch-label">{label}</span>
    <span className="home__switch-track" aria-hidden="true">
      <span className="home__switch-thumb" />
    </span>
  </button>
);

export const HomeScreen = ({
  settings,
  roundSize,
  onChange,
  onStart,
  onExplore,
  onOpenSettings,
  onOpenAbout,
}: Props) => {
  const { t, lang } = useI18n();
  const titleId = useId();
  const seconds = settings.secondsPerQuestion;

  const oceans = settings.continent === 'oceans';
  const one = roundSize === 1;
  const summary = settings.timeLimitOn
    ? oceans
      ? one
        ? t('home.summaryOneOcean', { seconds })
        : t('home.summaryOceans', { count: roundSize, seconds })
      : one
        ? t('home.summaryOne', { seconds })
        : t('home.summary', { count: roundSize, seconds })
    : oceans
      ? one
        ? t('home.summaryOneOceanUntimed')
        : t('home.summaryOceansUntimed', { count: roundSize })
      : one
        ? t('home.summaryOneUntimed')
        : t('home.summaryUntimed', { count: roundSize });

  return (
    <div className="screen home">
      <header className="screen__header">
        <h1 className="screen__title">Geo Quizz</h1>
        <div className="home__actions">
          <button
            type="button"
            className="screen__round-btn"
            data-testid="open-about"
            aria-label={t('home.aboutAria')}
            onClick={onOpenAbout}
          >
            ℹ️
          </button>
          <button
            type="button"
            className="screen__round-btn"
            data-testid="open-settings"
            aria-label={t('home.settingsAria')}
            onClick={onOpenSettings}
          >
            ⚙️
          </button>
        </div>
      </header>
      <LanguageToggle value={settings.language} onChange={(language) => onChange({ ...settings, language })} />
      <section className="screen__panel">
        <h2 id={titleId} className="screen__panel-title">
          {t('home.continentTitle')}
        </h2>
        <div className="home__continents" role="radiogroup" aria-labelledby={titleId}>
          {AREAS.map((continent) => (
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
      <section className="screen__panel home__switches">
        <Switch
          label={t('home.timeLimit')}
          on={settings.timeLimitOn}
          testId="switch-time-limit"
          onToggle={() => onChange({ ...settings, timeLimitOn: !settings.timeLimitOn })}
        />
        {/* On asks the tiny countries: every switch that is on makes the game
            harder. The oceans have no tiny places, so it is hidden for them
            (plan, Phase 7); the setting keeps its value for the continents. */}
        {!oceans && (
          <Switch
            label={t('home.tinyCountries')}
            on={!settings.skipTiny}
            testId="switch-tiny"
            onToggle={() => onChange({ ...settings, skipTiny: !settings.skipTiny })}
          />
        )}
      </section>
      <p className="home__summary">{summary}</p>
      <button type="button" className="screen__primary-btn" data-testid="start-game" onClick={onStart}>
        <span aria-hidden="true">🌍</span> {t('home.start')}
      </button>
      <button type="button" className="screen__secondary-btn" data-testid="start-explore" onClick={onExplore}>
        <span aria-hidden="true">🧭</span> {t('home.explore')}
      </button>
    </div>
  );
};
