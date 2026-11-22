import {
  currentTargetId,
  feedbackMs,
  gameReducer,
  score,
  startGame,
  type GameEvent,
  type GameState,
} from '../domain/game';

const CONTINENT = ['FRA', 'DEU', 'ITA', 'ESP', 'CHE'];

const start = (questionIds = ['FRA', 'DEU', 'ITA']) =>
  startGame({ questionIds, continentIds: CONTINENT, timeLimitMs: 10_000 });

const play = (state: GameState, ...events: GameEvent[]) => events.reduce(gameReducer, state);

const pick = (id: string, elapsedMs = 1000): GameEvent => ({ type: 'pick', id, elapsedMs });
const TIMEOUT: GameEvent = { type: 'timeout' };
const NEXT: GameEvent = { type: 'next' };

describe('startGame', () => {
  it('asks the first question with no answers yet', () => {
    const state = start();
    expect(state.phase).toBe('asking');
    expect(state.index).toBe(0);
    expect(state.answers).toEqual([]);
    expect(currentTargetId(state)).toBe('FRA');
    expect(score(state)).toBe(0);
  });

  it('refuses a round with no questions', () => {
    expect(() => start([])).toThrow(/no questions/);
  });

  it('refuses a question twice in one round', () => {
    expect(() => start(['FRA', 'FRA'])).toThrow(/twice/);
  });

  it('refuses a question from another continent', () => {
    expect(() => start(['FRA', 'JPN'])).toThrow(/JPN/);
  });

  it.each([0, -1, Number.NaN, Infinity])('refuses a time limit of %s ms', (timeLimitMs) => {
    expect(() =>
      startGame({ questionIds: ['FRA'], continentIds: CONTINENT, timeLimitMs }),
    ).toThrow(/time limit/);
  });

  it('plays without a time limit when given null', () => {
    const state = startGame({ questionIds: ['FRA'], continentIds: CONTINENT, timeLimitMs: null });
    expect(state.timeLimitMs).toBeNull();
    expect(state.phase).toBe('asking');
  });
});

describe('gameReducer, without a time limit', () => {
  const untimed = () =>
    startGame({ questionIds: ['FRA', 'DEU'], continentIds: CONTINENT, timeLimitMs: null });

  it('waits as long as the player needs', () => {
    const state = play(untimed(), pick('FRA', 95_000));
    expect(state.answers).toEqual([
      { targetId: 'FRA', pickedId: 'FRA', correct: true, elapsedMs: 95_000 },
    ]);
  });

  it('throws on a timeout, which nothing should send', () => {
    expect(() => gameReducer(untimed(), TIMEOUT)).toThrow(/no time limit/);
  });
});

describe('gameReducer', () => {
  it('records a correct pick and shows feedback', () => {
    const state = play(start(), pick('FRA', 2300));
    expect(state.phase).toBe('feedback');
    expect(state.answers).toEqual([
      { targetId: 'FRA', pickedId: 'FRA', correct: true, elapsedMs: 2300 },
    ]);
    expect(score(state)).toBe(1);
  });

  it('records a wrong pick inside the continent', () => {
    const state = play(start(), pick('CHE', 4100));
    expect(state.phase).toBe('feedback');
    expect(state.answers).toEqual([
      { targetId: 'FRA', pickedId: 'CHE', correct: false, elapsedMs: 4100 },
    ]);
    expect(score(state)).toBe(0);
  });

  it('records a timeout as no pick, at the time limit', () => {
    const state = play(start(), TIMEOUT);
    expect(state.phase).toBe('feedback');
    expect(state.answers).toEqual([
      { targetId: 'FRA', pickedId: null, correct: false, elapsedMs: 10_000 },
    ]);
  });

  it('ignores a pick outside the continent: the player missed the continent, not the answer', () => {
    const state = start();
    expect(gameReducer(state, pick('JPN'))).toBe(state);
  });

  it('allows one attempt per question', () => {
    const answered = play(start(), pick('CHE'));
    expect(gameReducer(answered, pick('FRA'))).toBe(answered);
    expect(gameReducer(answered, TIMEOUT)).toBe(answered);
  });

  it('ignores next while a question is being asked', () => {
    const state = start();
    expect(gameReducer(state, NEXT)).toBe(state);
  });

  it('moves on to the next question', () => {
    const state = play(start(), pick('FRA'), NEXT);
    expect(state.phase).toBe('asking');
    expect(state.index).toBe(1);
    expect(currentTargetId(state)).toBe('DEU');
    expect(state.answers).toHaveLength(1);
  });

  it('finishes after the last question and keeps one answer per question', () => {
    const state = play(start(), pick('FRA'), NEXT, pick('ITA', 3000), NEXT, TIMEOUT, NEXT);
    expect(state.phase).toBe('finished');
    expect(state.answers.map((a) => [a.targetId, a.pickedId, a.correct])).toEqual([
      ['FRA', 'FRA', true],
      ['DEU', 'ITA', false],
      ['ITA', null, false],
    ]);
    expect(score(state)).toBe(1);
  });

  it('ignores every event once finished', () => {
    const finished = play(start(['FRA']), pick('FRA'), NEXT);
    expect(finished.phase).toBe('finished');
    for (const event of [pick('DEU'), TIMEOUT, NEXT]) {
      expect(gameReducer(finished, event)).toBe(finished);
    }
  });

  it('counts the correct answers as the score', () => {
    const state = play(
      start(['FRA', 'DEU', 'ITA']),
      pick('FRA'),
      NEXT,
      pick('DEU'),
      NEXT,
      pick('ITA'),
      NEXT,
    );
    expect(score(state)).toBe(3);
  });

  it.each([-1, Number.NaN, Infinity])('refuses an elapsed time of %s ms', (elapsedMs) => {
    expect(() => gameReducer(start(), pick('FRA', elapsedMs))).toThrow(/elapsed/);
  });

  it('never changes the state it is given', () => {
    const state = start();
    const before = structuredClone({ ...state, continentIds: [...state.continentIds] });
    play(state, pick('FRA'), NEXT);
    expect({ ...state, continentIds: [...state.continentIds] }).toEqual(before);
  });
});

describe('currentTargetId', () => {
  it('throws once the round is finished', () => {
    const finished = play(start(['FRA']), TIMEOUT, NEXT);
    expect(() => currentTargetId(finished)).toThrow(/finished/);
  });
});

describe('feedback', () => {
  // Plan, Phase 3: the next question comes 1 s after a right answer, and
  // 2.5 s after a wrong one or a timeout, to leave time to see the answer.
  it('pauses 1 s after a right answer and 2.5 s otherwise', () => {
    expect(feedbackMs({ targetId: 'FRA', pickedId: 'FRA', correct: true, elapsedMs: 900 })).toBe(1_000);
    expect(feedbackMs({ targetId: 'FRA', pickedId: 'DEU', correct: false, elapsedMs: 900 })).toBe(2_500);
    expect(feedbackMs({ targetId: 'FRA', pickedId: null, correct: false, elapsedMs: 10_000 })).toBe(2_500);
  });
});
