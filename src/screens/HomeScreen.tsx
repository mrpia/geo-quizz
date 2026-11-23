import { useId } from 'react';
import { LanguageToggle } from '../components/LanguageToggle';
import type { Settings } from '../domain/settings';
import { CONTINENTS, type Area } from '../domain/world';
import { continentName } from '../i18n';
import { useI18n } from '../i18n/I18nContext';
import './screens.css';
import './HomeScreen.css';

type Props = {
  settings: Settings;
  /**
   * How many countries the round will have: the setting, or fewer when the
   * round has fewer places (South America has 14; Oceania without the tiny
   * countries has 9; the oceans are five, 29 with the seas).
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
  const landId = useId();
  const waterId = useId();
  const seconds = settings.secondsPerQuestion;

  const oceans = settings.continent === 'oceans';
  // What the round asks, as the summary counts it: countries, oceans, or
  // oceans and seas (plan, Phase 8).
  const asked = !oceans ? 'countries' : settings.includeSeas ? 'waters' : 'oceans';
  const one = roundSize === 1;
  const summary = settings.timeLimitOn
    ? {
        countries: one ? t('home.summaryOne', { seconds }) : t('home.summary', { count: roundSize, seconds }),
        oceans: one
          ? t('home.summaryOneOcean', { seconds })
          : t('home.summaryOceans', { count: roundSize, seconds }),
        waters: one
          ? t('home.summaryOneWater', { seconds })
          : t('home.summaryWaters', { count: roundSize, seconds }),
      }[asked]
    : {
        countries: one ? t('home.summaryOneUntimed') : t('home.summaryUntimed', { count: roundSize }),
        oceans: one ? t('home.summaryOneOceanUntimed') : t('home.summaryOceansUntimed', { count: roundSize }),
        waters: one ? t('home.summaryOneWaterUntimed') : t('home.summaryWatersUntimed', { count: roundSize }),
      }[asked];

  const tile = (area: Area) => (
    <button
      key={area}
      type="button"
      role="radio"
      aria-checked={area === settings.continent}
      className="home__continent"
      data-testid={`continent-${area}`}
      onClick={() => onChange({ ...settings, continent: area })}
    >
      {continentName(area, lang)}
    </button>
  );

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
        {/* One choice in two groups, so that Oceania and the oceans no
            longer sit side by side looking alike (plan, Phase 8). Two radio
            groups, each named by the question and its title: a radiogroup
            may hold only radios. */}
        <div className="home__areas">
          <div className="home__group">
            <h3 id={landId} className="home__group-title">
              {t('home.landTitle')}
            </h3>
            <div className="home__continents" role="radiogroup" aria-labelledby={`${titleId} ${landId}`}>
              {CONTINENTS.map(tile)}
            </div>
          </div>
          <div className="home__group">
            <h3 id={waterId} className="home__group-title">
              {t('home.waterTitle')}
            </h3>
            <div className="home__continents" role="radiogroup" aria-labelledby={`${titleId} ${waterId}`}>
              {tile('oceans')}
            </div>
          </div>
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
            (plan, Phase 7); the setting keeps its value for the continents.
            The seas switch takes its place there (plan, Phase 8), and is
            hidden on a continent in the same way. */}
        {oceans ? (
          <Switch
            label={t('home.seas')}
            on={settings.includeSeas}
            testId="switch-seas"
            onToggle={() => onChange({ ...settings, includeSeas: !settings.includeSeas })}
          />
        ) : (
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
