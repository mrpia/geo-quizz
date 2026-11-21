/**
 * `count` distinct items from `pool`, in random order, without replacement.
 * Asking for more than the pool holds returns the whole pool shuffled (the
 * settings allow 50 countries; South America has 14).
 *
 * A partial Fisher–Yates shuffle on a copy: one `random()` call per item
 * drawn, so tests can script the draw with a fixed sequence.
 */
export const drawRound = <T>(
  pool: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] => {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`drawRound: count must be a positive integer, got ${count}`);
  }
  if (pool.length === 0) throw new RangeError('drawRound: the pool is empty');
  const items = [...pool];
  const n = Math.min(count, items.length);
  for (let i = 0; i < n; i++) {
    const r = random();
    if (!(r >= 0 && r < 1)) throw new RangeError(`drawRound: random() returned ${r}`);
    const j = i + Math.floor(r * (items.length - i));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, n);
};
