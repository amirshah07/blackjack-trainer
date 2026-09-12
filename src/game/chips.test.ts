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
