import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Countdown } from '../components/Countdown';
import { GlobeView } from '../components/GlobeView';
import { NO_HIGHLIGHT, RIGHT_COLOR, WRONG_COLOR, type GlobeHighlight } from '../components/globeLook';
import { feedbackMs, gameReducer, score, startGame, type Answer } from '../domain/game';
import { drawRound } from '../domain/round';
import { countriesOf, type Continent, type World } from '../domain/world';
import { countryName } from '../i18n';
import { useI18n } from '../i18n/I18nContext';
import './GameScreen.css';

type Props = {
  world: World;
  continent: Continent;
  secondsPerQuestion: number;
  countriesPerRound: number;
  /** Every answer, in order, once the last one has been shown. */
  onFinish: (answers: readonly Answer[]) => void;
  /** The ✕: back home, the round dropped. */
  onQuit: () => void;
};

type Verdict = 'correct' | 'wrong' | 'timeout';

const verdictOf = (answer: Answer): Verdict =>
  answer.correct ? 'correct' : answer.pickedId === null ? 'timeout' : 'wrong';

/**
 * One round (plan, Phase 3). The screen owns the clock: a question's time
 * runs from the moment it is shown. The first country is not shown, and its
 * clock does not run, until the globe has drawn the map. The rules are
 * `gameReducer`'s.
 */
export const GameScreen = ({
  world,
  continent,
  secondsPerQuestion,
  countriesPerRound,
  onFinish,
  onQuit,
}: Props) => {
  const { t, lang } = useI18n();
  const [game, dispatch] = useReducer(gameReducer, null, () => {
    const ids = countriesOf(world, continent).map((c) => c.id);
    return startGame({
      questionIds: drawRound(ids, countriesPerRound),
      continentIds: ids,
      timeLimitMs: secondsPerQuestion * 1000,
    });
  });
  /** `performance.now()` when the current question appeared; null until the globe is drawn. */
  const [askedAt, setAskedAt] = useState<number | null>(null);

  const nameOf = (id: string) => {
    const country = world.byId.get(id);
    if (!country) throw new Error(`GameScreen: no country ${JSON.stringify(id)}`);
    return countryName(country, lang);
  };

  const onReady = useCallback(() => setAskedAt((at) => at ?? performance.now()), []);
  const onPick = useCallback(
    (id: string) => {
      if (askedAt === null) return;
      dispatch({ type: 'pick', id, elapsedMs: performance.now() - askedAt });
    },
    [askedAt],
  );
  const onTimeout = useCallback(() => dispatch({ type: 'timeout' }), []);

  const shown = game.phase === 'feedback' ? game.answers[game.answers.length - 1] : null;

  // The pause after an answer, then the next question and its clock, in
  // one render. A late tap returns the same state, so this runs once per answer.
  useEffect(() => {
    if (game.phase !== 'feedback') return;
    const timer = setTimeout(
      () => {
        dispatch({ type: 'next' });
        setAskedAt(performance.now());
      },
      feedbackMs(game.answers[game.answers.length - 1]),
    );
    return () => clearTimeout(timer);
  }, [game]);

  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  });
  useEffect(() => {
    if (game.phase === 'finished') finish.current(game.answers);
  }, [game]);

  const highlight = useMemo<GlobeHighlight>(
    () =>
      shown
        ? {
            pickedId: shown.correct ? null : shown.pickedId,
            correctId: shown.targetId,
            pickedColor: WRONG_COLOR,
            correctColor: RIGHT_COLOR,
          }
        : NO_HIGHLIGHT,
    [shown],
  );

  // `index` stays on the last question once the round is finished.
  const targetId = game.questionIds[game.index];
  const verdict = shown ? verdictOf(shown) : null;

  return (
    <div className="game">
      <header className="game__bar">
        <button
          type="button"
          className="game__quit"
          data-testid="quit-game"
          aria-label={t('game.quitAria')}
          onClick={onQuit}
        >
          ✕
        </button>
        <span className="game__counter" data-testid="game-counter">
          {t('game.counter', { n: game.index + 1, total: game.questionIds.length })}
        </span>
        <div className="game__question">
          {askedAt === null ? (
            // Nothing to read until the map is drawn. Blank lines of the same
            // size, so the header keeps its height and the globe is not
            // resized when the question appears.
            <>
              <p className="game__prompt" aria-hidden="true">
                &nbsp;
              </p>
              <strong className="game__target" aria-hidden="true">
                &nbsp;
              </strong>
            </>
          ) : shown && verdict ? (
            <p
              className={`game__verdict game__verdict--${verdict}`}
              data-testid="game-verdict"
              data-verdict={verdict}
              data-picked={shown.pickedId ?? ''}
            >
              {/* The mark says right or wrong; the colour only repeats it. */}
              <span className="game__mark" aria-hidden="true">
                {shown.correct ? '✅' : '❌'}
              </span>{' '}
              {verdict === 'correct'
                ? t('game.correct')
                : verdict === 'timeout'
                  ? t('game.timeUp')
                  : t('game.wrong', { country: nameOf(shown.pickedId ?? '') })}
            </p>
          ) : (
            <p className="game__prompt">{t('game.prompt')}</p>
          )}
          {askedAt !== null && (
            <strong className="game__target" data-testid="game-target" data-id={targetId}>
              {nameOf(targetId)}
            </strong>
          )}
        </div>
        <span className="game__score" data-testid="game-score">
          {t('game.score', { score: score(game) })}
        </span>
      </header>
      <Countdown
        limitMs={game.timeLimitMs}
        startedAt={askedAt}
        stoppedAtMs={game.phase === 'asking' ? null : (game.answers.at(-1)?.elapsedMs ?? 0)}
        onTimeout={onTimeout}
      />
      <main className="game__globe">
        <GlobeView world={world} continent={continent} highlight={highlight} onPick={onPick} onReady={onReady} />
      </main>
    </div>
  );
};
