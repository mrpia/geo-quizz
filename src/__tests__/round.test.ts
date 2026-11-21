import { drawRound } from '../domain/round';

/** A `random` that returns the given values in turn, then fails the test. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('random called too often');
    return values[i++];
  };
};

const POOL = ['A', 'B', 'C', 'D', 'E'] as const;

describe('drawRound', () => {
  it('draws the requested number of distinct items from the pool', () => {
    const round = drawRound(POOL, 3, sequence(0.5, 0.1, 0.9));
    expect(round).toHaveLength(3);
    expect(new Set(round).size).toBe(3);
    for (const item of round) expect(POOL).toContain(item);
  });

  it('is deterministic for a given random sequence', () => {
    // 0 always takes the first remaining item.
    expect(drawRound(POOL, 3, sequence(0, 0, 0))).toEqual(['A', 'B', 'C']);
    // Just below 1 always takes the last remaining one. The drawn item's
    // slot gets the one it displaced: [E B C D A] → [E A C D B] → [E A B D C].
    expect(drawRound(POOL, 3, sequence(0.99, 0.99, 0.99))).toEqual(['E', 'A', 'B']);
  });

  it('clamps the count to the pool', () => {
    const round = drawRound(POOL, 50, () => 0.3);
    expect([...round].sort()).toEqual([...POOL]);
  });

  it('can draw every item first', () => {
    const firsts = new Set(
      [0, 0.2, 0.4, 0.6, 0.8].map((r) => drawRound(POOL, 1, sequence(r))[0]),
    );
    expect(firsts.size).toBe(POOL.length);
  });

  it('leaves the pool untouched', () => {
    const pool = ['A', 'B', 'C'];
    drawRound(pool, 3, () => 0.7);
    expect(pool).toEqual(['A', 'B', 'C']);
  });

  it('defaults to Math.random', () => {
    expect(drawRound(POOL, 2)).toHaveLength(2);
  });

  it.each([0, -1, 2.5, Number.NaN])('refuses a count of %s', (count) => {
    expect(() => drawRound(POOL, count, () => 0)).toThrow(/count/);
  });

  it('refuses an empty pool', () => {
    expect(() => drawRound([], 10, () => 0)).toThrow(/empty/);
  });

  it.each([1, -0.1, Number.NaN])('refuses a random value of %s', (value) => {
    expect(() => drawRound(POOL, 2, () => value)).toThrow(/random/);
  });
});
