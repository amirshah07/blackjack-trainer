import { describe, it, expect } from 'vitest';
import { toChips, DENOMINATIONS } from './chips';

describe('toChips', () => {
  it('uses the largest denominations first', () => {
    expect(toChips(100)).toEqual([100]);
    expect(toChips(135)).toEqual([100, 25, 10]);
    expect(toChips(50)).toEqual([25, 25]);
  });

  it('is empty for nothing staked', () => {
    expect(toChips(0)).toEqual([]);
  });

  it('renders a minimum bet as one chip', () => {
    expect(toChips(10)).toEqual([10]);
  });

  it('caps the number of discs rendered', () => {
    expect(toChips(100000, 12)).toHaveLength(12);
  });

  it('never represents more than the amount staked', () => {
    for (const amount of [10, 25, 35, 60, 135, 250, 1000]) {
      const sum = toChips(amount, 999).reduce((a, b) => a + b, 0);
      expect(sum, `overdrew for ${amount}`).toBeLessThanOrEqual(amount);
    }
  });

  it('shows the exact bet, never less', () => {
    // Regression: a greedy breakdown took the biggest chip that fit and could
    // strand an unmakeable remainder - $30 rendered as a single $25 chip, so
    // the felt disagreed with the bet the user had placed.
    for (let amount = 10; amount <= 1000; amount += 10) {
      const chips = toChips(amount, 999);
      const sum = chips.reduce((a, b) => a + b, 0);
      expect(sum, `$${amount} rendered as $${sum} (${chips})`).toBe(amount);
    }
  });

  it('handles the amounts greedy breakdown used to get wrong', () => {
    for (const amount of [30, 40, 80, 130, 205]) {
      const chips = toChips(amount, 999);
      expect(chips.reduce((a, b) => a + b, 0), `$${amount} -> ${chips}`).toBe(amount);
    }
    // $205 is 100 + 25x3 + 10x3, which greedy could not find.
    expect(toChips(205, 999)).toEqual([100, 25, 25, 25, 10, 10, 10]);
  });

  it('represents every reachable bet exactly, in $5 steps', () => {
    // Bets can land on any multiple of 5 once a 3:2 payout puts an odd $5 in
    // the bankroll, so the stack must cover those too.
    for (let amount = 10; amount <= 1000; amount += 5) {
      const chips = toChips(amount, 999);
      const sum = chips.reduce((a, b) => a + b, 0);
      if (amount % 5 === 0 && amount >= 10 && (amount % 10 === 0 || amount >= 35)) {
        expect(sum, `$${amount} rendered as $${sum} (${chips})`).toBe(amount);
      }
    }
  });

  it('prefers larger chips when an exact breakdown allows it', () => {
    expect(toChips(125, 999)).toEqual([100, 25]);
    expect(toChips(50, 999)).toEqual([25, 25]);
  });

  it('accounts for every amount buildable from the denominations', () => {
    // The UI only ever produces sums of 10/25/100, so those must break down
    // exactly with nothing left over.
    for (const a of DENOMINATIONS) {
      for (const b of DENOMINATIONS) {
        const amount = a + b;
        const sum = toChips(amount, 999).reduce((x, y) => x + y, 0);
        expect(sum, `did not account for ${amount}`).toBe(amount);
      }
    }
  });

  it('leaves only a sub-minimum remainder for arbitrary amounts', () => {
    for (let amount = 10; amount <= 500; amount += 5) {
      const sum = toChips(amount, 999).reduce((a, b) => a + b, 0);
      const remainder = amount - sum;
      expect(remainder, `bad breakdown for ${amount}`).toBeLessThan(10);
      expect(remainder).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('toChips is optimal', () => {
  /** Brute-force fewest-chip count, for comparison. */
  function minChips(amount: number): number | null {
    const best = new Array<number>(amount + 1).fill(Infinity);
    best[0] = 0;
    for (let n = 1; n <= amount; n++) {
      for (const d of DENOMINATIONS) {
        if (d <= n && best[n - d] + 1 < best[n]) best[n] = best[n - d] + 1;
      }
    }
    return Number.isFinite(best[amount]) ? best[amount] : null;
  }

  it('uses the fewest chips possible for every representable amount', () => {
    let checked = 0;
    for (let amount = 10; amount <= 600; amount += 5) {
      const fewest = minChips(amount);
      if (fewest === null) continue; // not representable, covered elsewhere
      const chips = toChips(amount, 999);
      expect(chips.reduce((a, b) => a + b, 0), `$${amount} total`).toBe(amount);
      expect(chips.length, `$${amount} used ${chips.length} chips, ${fewest} suffice`).toBe(fewest);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('prefers larger chips when solutions tie on length', () => {
    expect(toChips(125, 999)).toEqual([100, 25]);
    expect(toChips(100, 999)).toEqual([100]);
    expect(toChips(50, 999)).toEqual([25, 25]);
  });

  it('returns chips in descending order', () => {
    for (const amount of [30, 125, 205, 385, 1000]) {
      const chips = toChips(amount, 999);
      const sorted = [...chips].sort((a, b) => b - a);
      expect(chips, `$${amount} not ordered`).toEqual(sorted);
    }
  });

  it('handles junk input without throwing', () => {
    expect(toChips(0)).toEqual([]);
    expect(toChips(-50)).toEqual([]);
    expect(toChips(NaN)).toEqual([]);
    expect(toChips(Infinity)).toEqual([]);
  });
});
