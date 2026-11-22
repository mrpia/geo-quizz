import { useCallback, useState } from 'react';
import { GlobeView } from '../components/GlobeView';
import type { Continent, World } from '../domain/world';
import { countryName } from '../i18n';
import { useI18n } from '../i18n/I18nContext';
import './ExploreScreen.css';

type Props = {
  world: World;
  continent: Continent;
  /**
   * Leave out the tiny places (`quizPool`), as a round does: they are grey,
   * and a tap on one names nothing.
   */
  skipTiny: boolean;
  /** The 🏠: back home. */
  onHome: () => void;
};

/**
 * Explore mode (plan, Phase 6): the globe of a round with no question, no
 * countdown and no score. A tap on a place of the round shows its name in
 * the app's language and outlines it; the next tap replaces it. A tap on
 * the sea or on grey land changes nothing, so the name stays with its
 * outline. As in a round, nothing can be tapped until the map is drawn.
 */
export const ExploreScreen = ({ world, continent, skipTiny, onHome }: Props) => {
  const { t, lang } = useI18n();
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onReady = useCallback(() => setReady(true), []);
  const onPick = useCallback(
    (id: string) => {
      if (ready) setSelectedId(id);
    },
    [ready],
  );

  const selected = selectedId === null ? null : world.byId.get(selectedId);
  if (selected === undefined) throw new Error(`ExploreScreen: no country ${JSON.stringify(selectedId)}`);

  return (
    <div className="explore">
      <header className="explore__bar">
        <button
          type="button"
          className="explore__home"
          data-testid="explore-home"
          aria-label={t('common.backToHomeAria')}
          onClick={onHome}
        >
          🏠
        </button>
        <div className="explore__label">
          {/* Blank lines until there is something to read, so the header
              keeps its height and the globe is not resized. */}
          {ready ? (
            <p className="explore__prompt" data-testid="explore-prompt">
              {t('explore.prompt')}
            </p>
          ) : (
            <p className="explore__prompt" aria-hidden="true">
              &nbsp;
            </p>
          )}
          {selected ? (
            <strong className="explore__name" data-testid="explore-name" data-id={selected.id}>
              {countryName(selected, lang)}
            </strong>
          ) : (
            <strong className="explore__name" aria-hidden="true">
              &nbsp;
            </strong>
          )}
        </div>
        {/* As wide as 🏠, so the name is centred on the screen. */}
        <span className="explore__spacer" aria-hidden="true" />
      </header>
      <main className="explore__globe">
        <GlobeView
          world={world}
          continent={continent}
          skipTiny={skipTiny}
          selectedId={selectedId}
          onPick={onPick}
          onReady={onReady}
        />
      </main>
    </div>
  );
};
