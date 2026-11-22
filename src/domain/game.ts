/**
 * One round, as a pure reducer. The screen owns the clock: it measures the
 * time of a pick and dispatches `timeout` when the countdown runs out. The
 * reducer never reads the time itself, so every rule below is testable with
 * plain data. A round without a time limit has no countdown and no timeout.
 */

export type Phase = 'asking' | 'feedback' | 'finished';

export type Answer = {
  targetId: string;
  /** `null` when the time ran out. */
  pickedId: string | null;
  correct: boolean;
  /** The time the player took; the full time limit on a timeout. */
  elapsedMs: number;
};

export type GameState = {
  questionIds: readonly string[];
  /** The round's places (`quizPool`): the only ones a pick can name. */
  continentIds: ReadonlySet<string>;
  /** `null`: no time limit, the question waits for a tap. */
  timeLimitMs: number | null;
  /** The question being asked, or shown in feedback. */
  index: number;
  phase: Phase;
  /** One per question asked so far, in order. */
  answers: readonly Answer[];
};

export type GameEvent =
  | { type: 'pick'; id: string; elapsedMs: number }
  | { type: 'timeout' }
  | { type: 'next' };

export const startGame = ({
  questionIds,
  continentIds,
  timeLimitMs,
}: {
  questionIds: readonly string[];
  continentIds: Iterable<string>;
  timeLimitMs: number | null;
}): GameState => {
  const continent = new Set(continentIds);
  if (questionIds.length === 0) throw new Error('startGame: no questions');
  if (new Set(questionIds).size !== questionIds.length) {
    throw new Error('startGame: a question is asked twice');
  }
  for (const id of questionIds) {
    if (!continent.has(id)) throw new Error(`startGame: ${id} is not on the round's continent`);
  }
  if (timeLimitMs !== null && !(Number.isFinite(timeLimitMs) && timeLimitMs > 0)) {
    throw new Error(`startGame: bad time limit ${timeLimitMs}`);
  }
  return {
    questionIds,
    continentIds: continent,
    timeLimitMs,
    index: 0,
    phase: 'asking',
    answers: [],
  };
};

export const currentTargetId = (state: GameState): string => {
  if (state.phase === 'finished') throw new Error('currentTargetId: the round is finished');
  return state.questionIds[state.index];
};

const answer = (state: GameState, pickedId: string | null, elapsedMs: number): GameState => {
  const targetId = currentTargetId(state);
  return {
    ...state,
    phase: 'feedback',
    answers: [
      ...state.answers,
      { targetId, pickedId, correct: pickedId === targetId, elapsedMs },
    ],
  };
};

/**
 * Events that do not apply return the state they were given (the same
 * object), so React skips the render: a second tap during feedback, a late
 * timeout, a tap on another continent.
 */
export const gameReducer = (state: GameState, event: GameEvent): GameState => {
  switch (event.type) {
    case 'pick':
      if (!(Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0)) {
        throw new Error(`gameReducer: bad elapsed time ${event.elapsedMs}`);
      }
      // A tap outside the continent missed the continent, not the answer.
      if (state.phase !== 'asking' || !state.continentIds.has(event.id)) return state;
      return answer(state, event.id, event.elapsedMs);
    case 'timeout':
      // Not a late event to shrug off: without a limit, no clock should run.
      if (state.timeLimitMs === null) throw new Error('gameReducer: a timeout in a round with no time limit');
      if (state.phase !== 'asking') return state;
      return answer(state, null, state.timeLimitMs);
    case 'next':
      if (state.phase !== 'feedback') return state;
      return state.index + 1 < state.questionIds.length
        ? { ...state, index: state.index + 1, phase: 'asking' }
        : { ...state, phase: 'finished' };
  }
};

export const score = (state: GameState): number =>
  state.answers.filter((a) => a.correct).length;

/**
 * How long an answer stays on screen before the next question (plan,
 * Phase 3): 1 s after a right answer, 2.5 s after a wrong one or a timeout,
 * long enough to find the answer on the globe.
 */
export const feedbackMs = (answer: Answer): number => (answer.correct ? 1_000 : 2_500);
