import { act, screen } from '@testing-library/react';
import { Countdown } from '../components/Countdown';
import { renderWithLanguage } from './renderWithLanguage';

// The countdown bar (plan, Phase 3): requestAnimationFrame and
// performance.now(), like math-quizz's Timer, so both are faked here.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});

afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const bar = () => screen.getByRole('progressbar', { name: 'time remaining' });
const remaining = () => Number(bar().getAttribute('aria-valuenow'));
const fill = () => screen.getByTestId('countdown').style.getPropertyValue('--remaining');

describe('Countdown', () => {
  it('stays full while the clock has not started (the globe is still loading)', () => {
    const onTimeout = vi.fn();
    renderWithLanguage(<Countdown limitMs={10_000} startedAt={null} stoppedAtMs={null} onTimeout={onTimeout} />);
    advance(30_000);
    expect(remaining()).toBe(10);
    expect(fill()).toBe('1');
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('empties as time runs, counting in whole seconds left', () => {
    renderWithLanguage(
      <Countdown limitMs={10_000} startedAt={performance.now()} stoppedAtMs={null} onTimeout={() => {}} />,
    );
    expect(bar()).toHaveAttribute('aria-valuemax', '10');
    advance(2_500);
    expect(remaining()).toBe(8);
    expect(Number(fill())).toBeCloseTo(0.75, 1);
    advance(5_000);
    expect(remaining()).toBe(3);
  });

  it('calls onTimeout once, when the time is up', () => {
    const onTimeout = vi.fn();
    renderWithLanguage(
      <Countdown limitMs={3_000} startedAt={performance.now()} stoppedAtMs={null} onTimeout={onTimeout} />,
    );
    advance(2_900);
    expect(onTimeout).not.toHaveBeenCalled();
    advance(200);
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(remaining()).toBe(0);
    advance(5_000);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('counts from the start it is given, not from its own mount', () => {
    const onTimeout = vi.fn();
    // The game's clock started 1 s before the bar committed.
    renderWithLanguage(
      <Countdown limitMs={3_000} startedAt={performance.now() - 1_000} stoppedAtMs={null} onTimeout={onTimeout} />,
    );
    advance(2_100);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('stops where the player answered, and stays there (paused during feedback)', () => {
    const onTimeout = vi.fn();
    const startedAt = performance.now();
    const { rerender } = renderWithLanguage(
      <Countdown limitMs={10_000} startedAt={startedAt} stoppedAtMs={null} onTimeout={onTimeout} />,
    );
    advance(2_500);
    rerender(<Countdown limitMs={10_000} startedAt={startedAt} stoppedAtMs={2_500} onTimeout={onTimeout} />);
    advance(20_000);
    expect(remaining()).toBe(8);
    expect(fill()).toBe('0.75');
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('starts over for the next question', () => {
    const onTimeout = vi.fn();
    const first = performance.now();
    const { rerender } = renderWithLanguage(
      <Countdown limitMs={3_000} startedAt={first} stoppedAtMs={null} onTimeout={onTimeout} />,
    );
    advance(3_100);
    rerender(<Countdown limitMs={3_000} startedAt={first} stoppedAtMs={3_000} onTimeout={onTimeout} />);
    advance(2_500);
    rerender(<Countdown limitMs={3_000} startedAt={performance.now()} stoppedAtMs={null} onTimeout={onTimeout} />);
    expect(remaining()).toBe(3);
    advance(3_100);
    expect(onTimeout).toHaveBeenCalledTimes(2);
  });
});
