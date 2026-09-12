/** Standard chip denominations, largest-first for stack breakdown. */
export const DENOMINATIONS = [100, 25, 10] as const;

export type Denomination = (typeof DENOMINATIONS)[number];

/**
 * Breaks an amount into chips, largest first, so a bet reads as a real stack
 * rather than a pile of $10s.
 *
 * `max` caps the rendered count - beyond a dozen discs the visual stops
 * conveying anything, and a $1,000 all-in should not draw 100 chips.
 */
export function toChips(amount: number, max = 12): number[] {
  const chips: number[] = [];
  let left = amount;
  for (const d of DENOMINATIONS) {
    while (left >= d && chips.length < max) {
      chips.push(d);
      left -= d;
    }
  }
  return chips;
}
