import { act, fireEvent, screen } from '@testing-library/react';
import raw from '../data/world.json?raw';
import { countriesOf, parseWorld, quizPool, type Area, type WorldTopology } from '../domain/world';
import type { GlobeViewProps } from '../components/GlobeView';
import { RIGHT_COLOR, WRONG_COLOR } from '../components/globeLook';
import { GameScreen } from '../screens/GameScreen';
import { renderWithLanguage } from './renderWithLanguage';

// jsdom has no WebGL: the globe becomes one button per country of its
// continent (or per ocean), plus one that stands for globe.gl finishing its
// first frame.
vi.mock('../components/GlobeView', () => ({
  GlobeView: ({ world, continent, skipTiny, onPick, onReady, highlight }: GlobeViewProps) => (
    <div
      data-testid="globe"
      data-continent={continent}
      data-skip-tiny={String(skipTiny)}
      data-correct={highlight?.correctId ?? ''}
      data-correct-color={highlight?.correctColor ?? ''}
      data-picked={highlight?.pickedId ?? ''}
      data-picked-color={highlight?.pickedColor ?? ''}
    >
      <button type="button" data-testid="globe-ready" onClick={() => onReady?.()}>
        ready
      </button>
      {[...world.countries, ...world.oceans]
        .filter((c) => c.properties.continent === continent)
        .map((c) => (
          <button key={c.id} type="button" data-testid={`tap-${c.id}`} onClick={() => onPick(c.id)}>
            {c.id}
          </button>
        ))}
    </div>
  ),
}));

const world = parseWorld(JSON.parse(raw) as WorldTopology);

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

type Options = {
  continent?: Area;
  /** `null`: the time limit switched off. */
  seconds?: number | null;
  countries?: number;
  skipTiny?: boolean;
  ready?: boolean;
};

const setup = ({
  continent = 'europe',
  seconds = 10,
  countries = 3,
  skipTiny = false,
  ready = true,
}: Options = {}) => {
  const onFinish = vi.fn();
  const onQuit = vi.fn();
  renderWithLanguage(
    <GameScreen
      world={world}
      continent={continent}
      secondsPerQuestion={seconds}
      countriesPerRound={countries}
      skipTiny={skipTiny}
      onFinish={onFinish}
      onQuit={onQuit}
    />,
  );
  if (ready) fireEvent.click(screen.getByTestId('globe-ready'));
  return { onFinish, onQuit };
};

const target = () => {
  const id = screen.getByTestId('game-target').dataset.id;
  if (!id) throw new Error('no target shown');
  return id;
};
const tap = (id: string) => fireEvent.click(screen.getByTestId(`tap-${id}`));
/** A country of the round's continent that is not the target. */
const notTarget = () => countriesOf(world, 'europe').find((c) => c.id !== target())!.id;
const nameOf = (id: string) => world.byId.get(id)!.properties.names.en;
const verdict = () => screen.queryByTestId('game-verdict');
const globe = () => screen.getByTestId('globe');
const secondsLeft = () => Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));

describe('GameScreen: asking', () => {
  it('asks a country of the continent by name, with the counter, the score and a full bar', () => {
    setup();
    expect(world.byId.get(target())?.properties.continent).toBe('europe');
    expect(screen.getByTestId('game-target')).toHaveTextContent(nameOf(target()));
    expect(screen.getByText('Find this country:')).toBeInTheDocument();
    expect(screen.getByTestId('game-counter')).toHaveTextContent('1 / 3');
    expect(screen.getByTestId('game-score')).toHaveTextContent('Score: 0');
    expect(secondsLeft()).toBe(10);
    expect(verdict()).not.toBeInTheDocument();
  });

  it('plays on the continent chosen, with no more countries than it has', () => {
    setup({ continent: 'south-america', countries: 50 });
    expect(globe()).toHaveAttribute('data-continent', 'south-america');
    expect(screen.getByTestId('game-counter')).toHaveTextContent('1 / 14');
  });

  it('asks the first country only once the globe is drawn, and starts the clock then', () => {
    setup({ ready: false });
    expect(screen.queryByTestId('game-target')).not.toBeInTheDocument();
    expect(screen.queryByText('Find this country:')).not.toBeInTheDocument();
    expect(screen.getByTestId('game-counter')).toHaveTextContent('1 / 3');
    advance(5_000);
    fireEvent.click(screen.getByTestId('globe-ready'));
    expect(screen.getByTestId('game-target')).toHaveTextContent(nameOf(target()));
    expect(screen.getByText('Find this country:')).toBeInTheDocument();
    expect(secondsLeft()).toBe(10);
  });

  it('keeps the clock still until the globe is drawn', () => {
    setup({ ready: false });
    advance(30_000);
    expect(secondsLeft()).toBe(10);
    expect(verdict()).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('globe-ready'));
    advance(4_500);
    expect(secondsLeft()).toBe(6);
  });

  it('ignores taps until the globe is drawn', () => {
    setup({ ready: false });
    // The target is not shown yet, so tap them all: it is among them.
    for (const c of countriesOf(world, 'europe')) tap(c.id);
    expect(verdict()).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('globe-ready'));
    expect(screen.getByTestId('game-score')).toHaveTextContent('Score: 0');
  });
});

describe('GameScreen: feedback', () => {
  it('a right tap: ✅, the answer in green, the next question after 1 s', () => {
    setup();
    const first = target();
    advance(2_000);
    tap(first);
    expect(verdict()).toHaveAttribute('data-verdict', 'correct');
    expect(verdict()).toHaveTextContent('✅');
    expect(verdict()).toHaveTextContent('Well done!');
    expect(verdict()).toHaveAttribute('data-picked', first);
    expect(globe()).toHaveAttribute('data-correct', first);
    expect(globe()).toHaveAttribute('data-correct-color', RIGHT_COLOR);
    expect(globe()).toHaveAttribute('data-picked', '');
    expect(screen.getByTestId('game-score')).toHaveTextContent('Score: 1');
    advance(999);
    expect(verdict()).toBeInTheDocument();
    advance(1);
    expect(verdict()).not.toBeInTheDocument();
    expect(screen.getByTestId('game-counter')).toHaveTextContent('2 / 3');
    expect(target()).not.toBe(first);
    expect(globe()).toHaveAttribute('data-correct', '');
  });

  it('a wrong tap: ❌, names the country tapped, the pick in red and the answer in green, next after 4 s', () => {
    setup();
    const first = target();
    const wrong = notTarget();
    tap(wrong);
    expect(verdict()).toHaveAttribute('data-verdict', 'wrong');
    expect(verdict()).toHaveTextContent('❌');
    expect(verdict()).toHaveTextContent(`You tapped ${nameOf(wrong)}`);
    // For the e2e specs, which never read text: the language is a setting.
    expect(verdict()).toHaveAttribute('data-picked', wrong);
    // The question stays, so the player can find it on the globe.
    expect(screen.getByTestId('game-target')).toHaveTextContent(nameOf(first));
    expect(globe()).toHaveAttribute('data-picked', wrong);
    expect(globe()).toHaveAttribute('data-picked-color', WRONG_COLOR);
    expect(globe()).toHaveAttribute('data-correct', first);
    expect(globe()).toHaveAttribute('data-correct-color', RIGHT_COLOR);
    expect(screen.getByTestId('game-score')).toHaveTextContent('Score: 0');
    advance(3_999);
    expect(verdict()).toBeInTheDocument();
    advance(1);
    expect(screen.getByTestId('game-counter')).toHaveTextContent('2 / 3');
  });

  it("a timeout: ❌ Time's up!, the answer in green, next after 4 s", () => {
    setup({ seconds: 3 });
    const first = target();
    advance(3_100);
    expect(verdict()).toHaveAttribute('data-verdict', 'timeout');
    expect(verdict()).toHaveTextContent('❌');
    expect(verdict()).toHaveTextContent("Time's up!");
    expect(verdict()).toHaveAttribute('data-picked', '');
    expect(globe()).toHaveAttribute('data-correct', first);
    expect(globe()).toHaveAttribute('data-picked', '');
    advance(3_999);
    expect(verdict()).toBeInTheDocument();
    advance(1);
    expect(screen.getByTestId('game-counter')).toHaveTextContent('2 / 3');
  });

  it('pauses the countdown during feedback, and starts it afresh for the next question', () => {
    setup();
    advance(3_000);
    tap(target());
    expect(secondsLeft()).toBe(7);
    advance(900);
    expect(secondsLeft()).toBe(7);
    advance(100);
    expect(secondsLeft()).toBe(10);
  });

  it('takes one answer per question: a second tap during feedback changes nothing', () => {
    setup();
    const first = target();
    tap(notTarget());
    tap(first);
    expect(verdict()).toHaveAttribute('data-verdict', 'wrong');
    expect(screen.getByTestId('game-score')).toHaveTextContent('Score: 0');
  });
});

describe('GameScreen: the end of the round', () => {
  it('hands over every answer, with the time each took from when it was asked', () => {
    const { onFinish } = setup();
    const ids: string[] = [];
    ids.push(target());
    advance(2_000);
    tap(ids[0]);
    advance(1_000);
    ids.push(target());
    advance(1_500);
    const wrong = notTarget();
    tap(wrong);
    advance(4_000);
    ids.push(target());
    advance(10_100);
    expect(onFinish).not.toHaveBeenCalled();
    advance(4_000);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith([
      { targetId: ids[0], pickedId: ids[0], correct: true, elapsedMs: 2_000 },
      { targetId: ids[1], pickedId: wrong, correct: false, elapsedMs: 1_500 },
      { targetId: ids[2], pickedId: null, correct: false, elapsedMs: 10_000 },
    ]);
  });

  it('asks every country of the round once', () => {
    setup({ continent: 'south-america', countries: 14, seconds: 3 });
    const seen = new Set<string>();
    for (let i = 0; i < 14; i++) {
      seen.add(target());
      tap(target());
      advance(1_000);
    }
    expect([...seen].sort()).toEqual(countriesOf(world, 'south-america').map((c) => c.id).sort());
  });

  it('quits with the ✕, at any time', () => {
    const { onQuit, onFinish } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'quit the game' }));
    expect(onQuit).toHaveBeenCalledOnce();
    expect(onFinish).not.toHaveBeenCalled();
  });
});

describe('GameScreen: without a time limit', () => {
  it('shows no countdown and waits for the tap, however long it takes', () => {
    const { onFinish } = setup({ seconds: null, countries: 1 });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    advance(10 * 60_000);
    expect(verdict()).not.toBeInTheDocument();
    const id = target();
    tap(id);
    expect(verdict()).toHaveAttribute('data-verdict', 'correct');
    advance(1_000);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith([
      { targetId: id, pickedId: id, correct: true, elapsedMs: 10 * 60_000 },
    ]);
  });

  it('leaves a wrong answer up for 4 s, as with the limit on', () => {
    // The owner's call, 2026-11-22: finding the answer on the globe takes as
    // long without a countdown as with one.
    setup({ seconds: null });
    tap(notTarget());
    advance(3_999);
    expect(verdict()).toHaveAttribute('data-verdict', 'wrong');
    advance(1);
    expect(screen.getByTestId('game-counter')).toHaveTextContent('2 / 3');
  });

  it('still waits for the globe before the clock that times the answer starts', () => {
    const { onFinish } = setup({ seconds: null, countries: 1, ready: false });
    advance(5_000);
    fireEvent.click(screen.getByTestId('globe-ready'));
    advance(3_000);
    tap(target());
    advance(1_000);
    expect(onFinish.mock.calls[0][0][0].elapsedMs).toBe(3_000);
  });
});

describe('GameScreen: without the tiny countries', () => {
  it('asks only the places of 1,000 km² or more, and shortens the round to them', () => {
    // Oceania keeps 9 of its 25 places (world.test.ts).
    setup({ continent: 'oceania', countries: 50, skipTiny: true });
    expect(globe()).toHaveAttribute('data-skip-tiny', 'true');
    expect(screen.getByTestId('game-counter')).toHaveTextContent('1 / 9');
    const seen = new Set<string>();
    for (let i = 0; i < 9; i++) {
      seen.add(target());
      tap(target());
      advance(1_000);
    }
    expect([...seen].sort()).toEqual(
      quizPool(world, 'oceania', { skipTiny: true })
        .map((c) => c.id)
        .sort(),
    );
  });

  it('treats a tap on a place left out like a tap outside the continent: nothing happens', () => {
    setup({ skipTiny: true });
    tap('MLT');
    tap('VAT');
    expect(verdict()).not.toBeInTheDocument();
    expect(screen.getByTestId('game-score')).toHaveTextContent('Score: 0');
  });

  it('tells the globe when every place is asked', () => {
    setup();
    expect(globe()).toHaveAttribute('data-skip-tiny', 'false');
  });
});

// The oceans (docs/plan.md, Phase 7).
describe('GameScreen: the oceans', () => {
  it('asks an ocean by name, and each of the five once', () => {
    setup({ continent: 'oceans', countries: 10 });
    expect(globe()).toHaveAttribute('data-continent', 'oceans');
    expect(screen.getByText('Find this ocean:')).toBeInTheDocument();
    expect(screen.getByTestId('game-counter')).toHaveTextContent('1 / 5');
    const asked = new Set<string>();
    for (let i = 0; i < 5; i++) {
      asked.add(target());
      expect(screen.getByTestId('game-target')).toHaveTextContent(nameOf(target()));
      tap(target());
      advance(1_000);
    }
    expect([...asked].sort()).toEqual(['arctic', 'atlantic', 'indian', 'pacific', 'southern']);
  });

  it('names the ocean tapped on a wrong answer', () => {
    setup({ continent: 'oceans' });
    const wrong = world.oceans.find((o) => o.id !== target())!;
    tap(wrong.id);
    expect(verdict()).toHaveTextContent(`❌ You tapped ${wrong.properties.names.en}`);
    expect(globe()).toHaveAttribute('data-picked', wrong.id);
  });
});
