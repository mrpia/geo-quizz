import { useEffect, useMemo, useState } from 'react';
import { GlobeView } from './components/GlobeView';
import { NO_HIGHLIGHT, type GlobeHighlight } from './components/globeLook';
import { loadWorld } from './data/loadWorld';
import { CONTINENTS, type Continent, type World } from './domain/world';
import { continentName, countryName, type Language } from './i18n';
import { LanguageProvider, useI18n } from './i18n/I18nContext';
import { loadSettings } from './storage/settingsStore';
import './App.css';

/** `--color-success` in global.css. */
const PICKED_COLOR = '#22c55e';

/**
 * Phase 2 preview: the globe on its own, to check the views, taps, rings and
 * zoom (and for the e2e spec to drive). Phase 3 of docs/plan.md replaces it
 * with the screen state machine.
 */
export const App = () => {
  const [lang] = useState<Language>(() => loadSettings().language);
  return (
    <LanguageProvider lang={lang}>
      <Preview lang={lang} />
    </LanguageProvider>
  );
};

const Preview = ({ lang }: { lang: Language }) => {
  const { t } = useI18n();
  const [world, setWorld] = useState<World | null>(null);
  const [failed, setFailed] = useState(false);
  const [continent, setContinent] = useState<Continent>('europe');
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    loadWorld().then(setWorld, (e: unknown) => {
      console.error(e);
      setFailed(true);
    });
  }, []);

  const highlight = useMemo<GlobeHighlight>(
    () => (picked ? { ...NO_HIGHLIGHT, correctId: picked, correctColor: PICKED_COLOR } : NO_HIGHLIGHT),
    [picked],
  );
  const pickedCountry = picked ? world?.byId.get(picked) : undefined;

  return (
    <div className="preview">
      <header className="preview__bar">
        <h1 className="preview__title">Geo Quizz</h1>
        <nav className="preview__continents">
          {CONTINENTS.map((c) => (
            <button
              key={c}
              type="button"
              data-testid={`continent-${c}`}
              aria-pressed={c === continent}
              onClick={() => {
                setContinent(c);
                setPicked(null);
              }}
            >
              {continentName(c, lang)}
            </button>
          ))}
        </nav>
        <output className="preview__picked" data-testid="picked" data-id={picked ?? ''}>
          {pickedCountry ? countryName(pickedCountry, lang) : ''}
        </output>
      </header>
      <main className="preview__globe">
        {world ? (
          <GlobeView world={world} continent={continent} highlight={highlight} onPick={setPicked} />
        ) : (
          <p className="preview__status" role={failed ? 'alert' : undefined}>
            {failed ? t('common.loadError') : t('common.loading')}
          </p>
        )}
      </main>
    </div>
  );
};
