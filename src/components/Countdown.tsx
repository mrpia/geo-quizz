import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useI18n } from '../i18n/I18nContext';
import './Countdown.css';

type Props = {
  limitMs: number;
  /**
   * `performance.now()` when the question appeared: the same instant the game
   * measures a pick from, so the bar and the recorded time agree. Null while
   * the clock has not started (the globe is still loading).
   */
  startedAt: number | null;
  /** The time the answer took, once there is one: the bar stops there. */
  stoppedAtMs: number | null;
  /** Called once per question, when the time is up. */
  onTimeout: () => void;
};

/**
 * The bar that empties while a question is asked (plan, Phase 3), driven by
 * `requestAnimationFrame` and `performance.now()` like math-quizz's Timer.
 * It owns the frame loop, so only the bar re-renders on every frame, not
 * the screen with the globe in it.
 */
export const Countdown = ({ limitMs, startedAt, stoppedAtMs, onTimeout }: Props) => {
  const { t } = useI18n();
  const [now, setNow] = useState(() => performance.now());
  const timeout = useRef(onTimeout);
  useEffect(() => {
    timeout.current = onTimeout;
  });

  const running = startedAt !== null && stoppedAtMs === null;
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      const time = performance.now();
      setNow(time);
      if (time - startedAt >= limitMs) {
        timeout.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, startedAt, limitMs]);

  // `now` is from the last frame, so it can predate a new `startedAt` until
  // the next one: clamp rather than show a negative time.
  const elapsedMs = startedAt === null ? 0 : (stoppedAtMs ?? Math.max(0, now - startedAt));
  const leftMs = Math.max(0, limitMs - elapsedMs);

  return (
    <div
      className="countdown"
      data-testid="countdown"
      role="progressbar"
      aria-label={t('countdown.aria')}
      aria-valuemin={0}
      aria-valuemax={limitMs / 1000}
      aria-valuenow={Math.ceil(leftMs / 1000)}
      style={{ '--remaining': leftMs / limitMs } as CSSProperties}
    >
      <div className="countdown__bar" />
    </div>
  );
};
