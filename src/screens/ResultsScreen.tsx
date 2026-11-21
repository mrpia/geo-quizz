import type { Answer } from '../domain/game';
import type { World } from '../domain/world';
import { countryName, formatSeconds } from '../i18n';
import { useI18n } from '../i18n/I18nContext';
import './screens.css';
import './ResultsScreen.css';

type Props = {
  world: World;
  /** One per question of the round, in order. */
  answers: readonly Answer[];
  /** Another round on the same continent. */
  onReplay: () => void;
  onHome: () => void;
};

type Outcome = 'correct' | 'wrong' | 'timeout';

const outcomeOf = (answer: Answer): Outcome =>
  answer.correct ? 'correct' : answer.pickedId === null ? 'timeout' : 'wrong';

export const ResultsScreen = ({ world, answers, onReplay, onHome }: Props) => {
  const { t, lang } = useI18n();
  const nameOf = (id: string) => {
    const country = world.byId.get(id);
    if (!country) throw new Error(`ResultsScreen: no country ${JSON.stringify(id)}`);
    return countryName(country, lang);
  };
  const score = answers.filter((a) => a.correct).length;

  return (
    <div className="screen results">
      <header className="screen__header">
        <h2 className="screen__title">{t('results.title')}</h2>
        <span className="results__score" data-testid="results-score">
          {t('results.score', { score, total: answers.length })}
        </span>
      </header>
      <ol className="results__list">
        {answers.map((answer, i) => {
          const outcome = outcomeOf(answer);
          return (
            <li
              key={i}
              className={`results__row results__row--${outcome}`}
              data-testid="results-row"
              data-outcome={outcome}
            >
              {/* The mark, not the row's colour, says right or wrong: green
                  and red are the pair colour-blind players confuse most. */}
              <span
                className="results__mark"
                role="img"
                aria-label={t(answer.correct ? 'results.correctAria' : 'results.wrongAria')}
              >
                {answer.correct ? '✓' : '✗'}
              </span>
              <span className="results__target">{nameOf(answer.targetId)}</span>
              <span className="results__detail">
                {outcome === 'wrong' && answer.pickedId !== null && (
                  <span className="results__picked">{nameOf(answer.pickedId)}</span>
                )}
                {outcome === 'timeout' && t('results.timeUp')}
              </span>
              <span className="results__time">
                {t('results.seconds', { seconds: formatSeconds(answer.elapsedMs, lang) })}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="results__actions">
        <button type="button" className="screen__primary-btn" data-testid="play-again" onClick={onReplay}>
          <span aria-hidden="true">🔁</span> {t('results.playAgain')}
        </button>
        <button type="button" className="screen__secondary-btn" data-testid="results-home" onClick={onHome}>
          <span aria-hidden="true">🏠</span> {t('common.home')}
        </button>
      </div>
    </div>
  );
};
