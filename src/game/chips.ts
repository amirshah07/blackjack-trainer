/** Standard chip denominations, largest first. */
export const DENOMINATIONS = [100, 25, 10] as const;

export type Denomination = (typeof DENOMINATIONS)[number];

/**
 * Breaks an amount into chips, using as few as possible.
 *
 * A greedy largest-first pass is wrong for this denomination set: taking the
 * biggest chip that fits can strand a remainder no chip can cover ($30 -> 25,
 * leaving an unmakeable 5), and the stack then silently shows less than the
 * bet. This is exact change by dynamic programming, so it finds 10+10+10 for
 * $30 and 100+25+25+25+10+10+10 for $205.
 *
 * Among equally short solutions it prefers larger chips, so $125 draws a black
 * and a green rather than five greens.
 *
 * `max` caps the rendered count: beyond a dozen discs the visual stops
 * conveying anything, and a $1,000 all-in should not draw 100 chips.
 */
export function toChips(amount: number, max = 12): number[] {
  if (amount <= 0 || !Number.isFinite(amount)) return [];

  const target = Math.floor(amount);

  // best[n] = fewest-chip breakdown of exactly n, or null if impossible.
  const best: (number[] | null)[] = new Array(target + 1).fill(null);
  best[0] = [];

  for (let n = 1; n <= target; n++) {
    // DENOMINATIONS is largest-first, so on a tie the larger chip is kept.
    for (const d of DENOMINATIONS) {
      if (d > n) continue;
      const rest = best[n - d];
      if (!rest) continue;
      const candidate = rest.length + 1;
      if (best[n] === null || candidate < best[n]!.length) {
        best[n] = [d, ...rest];
      }
    }
  }

  const exact = best[target];
  if (exact) return exact.slice(0, max);

  // No exact change (an amount below the smallest chip, or an odd remainder):
  // approximate without ever drawing more than the stake.
  const chips: number[] = [];
  let left = target;
  for (const d of DENOMINATIONS) {
    while (left >= d && chips.length < max) {
      chips.push(d);
      left -= d;
    }
  }
  return chips;
}
