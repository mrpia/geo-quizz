import { useEffect, useState } from 'react';
import { loadWorld } from './data/loadWorld';
import type { Answer } from './domain/game';
import { OCEAN_IDS } from './domain/oceans';
import { SEA_IDS } from './domain/seas';
import type { Settings } from './domain/settings';
import { quizPool, type World } from './domain/world';
import { LanguageProvider, useI18n } from './i18n/I18nContext';
import { AboutScreen } from './screens/AboutScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { loadSettings, saveSettings } from './storage/settingsStore';
import './App.css';

type Screen = 'home' | 'game' | 'explore' | 'results' | 'settings' | 'about';

/**
 * The screen state machine, as in math-quizz: one screen at a time, chosen
 * by `screen`, with the settings held here and saved on every change.
 */
export const App = () => {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [screen, setScreen] = useState<Screen>('home');
  const [world, setWorld] = useState<World | null>(null);
  const [failed, setFailed] = useState(false);
  // Keys the game screen, so every round, "play again" included, draws afresh.
  const [round, setRound] = useState(0);
  const [answers, setAnswers] = useState<readonly Answer[]>([]);

  // Loaded once, while the player is still on Home.
  useEffect(() => {
    loadWorld().then(setWorld, (error: unknown) => {
      console.error('App: the map could not be loaded', error);
      setFailed(true);
    });
  }, []);

  const save = (next: Settings) => setSettings(saveSettings(next));
  const home = () => setScreen('home');
  const play = () => {
    setRound((n) => n + 1);
    setScreen('game');
  };
  // A continent's places are known once the map has loaded; the oceans are
  // always five, and 29 with the seas, so Home never shows "10 oceans" while
  // the map loads.
  const pool = { skipTiny: settings.skipTiny, includeSeas: settings.includeSeas };
  const poolSize =
    settings.continent === 'oceans'
      ? OCEAN_IDS.length + (settings.includeSeas ? SEA_IDS.length : 0)
      : world
        ? quizPool(world, settings.continent, pool).length
        : null;
  const roundSize = poolSize === null ? settings.countriesPerRound : Math.min(settings.countriesPerRound, poolSize);

  return (
    <LanguageProvider lang={settings.language}>
      <div className="app">
        {screen === 'home' && (
          <HomeScreen
            settings={settings}
            roundSize={roundSize}
            onChange={save}
            onStart={play}
            onExplore={() => setScreen('explore')}
            onOpenSettings={() => setScreen('settings')}
            onOpenAbout={() => setScreen('about')}
          />
        )}
        {screen === 'game' &&
          (world ? (
            <GameScreen
              key={round}
              world={world}
              continent={settings.continent}
              secondsPerQuestion={settings.timeLimitOn ? settings.secondsPerQuestion : null}
              countriesPerRound={settings.countriesPerRound}
              skipTiny={settings.skipTiny}
              includeSeas={settings.includeSeas}
              onFinish={(done) => {
                setAnswers(done);
                setScreen('results');
              }}
              onQuit={home}
            />
          ) : (
            <MapStatus failed={failed} onHome={home} />
          ))}
        {screen === 'explore' &&
          (world ? (
            <ExploreScreen
              world={world}
              continent={settings.continent}
              skipTiny={settings.skipTiny}
              includeSeas={settings.includeSeas}
              onHome={home}
            />
          ) : (
            <MapStatus failed={failed} onHome={home} />
          ))}
        {screen === 'results' && world && (
          <ResultsScreen world={world} answers={answers} onReplay={play} onHome={home} />
        )}
        {screen === 'settings' && <SettingsScreen settings={settings} onSave={save} onBack={home} />}
        {screen === 'about' && <AboutScreen version={__APP_VERSION__} onBack={home} />}
      </div>
    </LanguageProvider>
  );
};

/** Shown in place of the game or Explore while the map loads, or when it could not. */
const MapStatus = ({ failed, onHome }: { failed: boolean; onHome: () => void }) => {
  const { t } = useI18n();
  return (
    <div className="app__status">
      <button
        type="button"
        className="app__home"
        data-testid="status-home"
        aria-label={t('common.backToHomeAria')}
        onClick={onHome}
      >
        🏠
      </button>
      <p role={failed ? 'alert' : undefined}>{failed ? t('common.loadError') : t('common.loading')}</p>
    </div>
  );
};
