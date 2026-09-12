import { describe, it, expect } from 'vitest';
import { getCorrectAction, chartAction, chartActionIgnoringPairs, UPCARDS, type Action, type Upcard } from './strategy';
import type { Card, Rank, Suit } from './cards';

/**
 * These expected grids are a SECOND, INDEPENDENT transcription of the chart
 * image - deliberately not imported from strategy.ts. If the implementation
 * table has a typo, it has to be made identically twice to slip through here.
 *
 * Columns are dealer upcard:  2  3  4  5  6  7  8  9  10  A
 */

let uid = 0;
function card(rank: Rank, suit: Suit = 'spades'): Card {
  return { rank, suit, id: `t${uid++}-${rank}${suit}` };
}

/** Parse a chart row string like "H  D  D  D  D  H  H  H  H  H". */
function row(spec: string): Action[] {
  const map: Record<string, Action> = { H: 'hit', ST: 'stand', D: 'double', SP: 'split' };
  return spec.trim().split(/\s+/).map((t) => {
    const a = map[t];
    if (!a) throw new Error(`bad token ${t}`);
    return a;
  });
}

function checkRow(cards: Card[], spec: string, label: string) {
  const expected = row(spec);
  expect(expected).toHaveLength(10);
  UPCARDS.forEach((up: Upcard, i: number) => {
    const got = chartAction(cards, up);
    expect(got, `${label} vs dealer ${up === 11 ? 'A' : up}`).toBe(expected[i]);
  });
}

describe('hard totals - transcribed from chart', () => {
  //                                        2   3   4   5   6   7   8   9  10   A
  it('5-8 always hits', () => {
    checkRow([card('2'), card('3')], 'H   H   H   H   H   H   H   H   H   H', 'hard 5');
    checkRow([card('2'), card('4')], 'H   H   H   H   H   H   H   H   H   H', 'hard 6');
    checkRow([card('3'), card('4')], 'H   H   H   H   H   H   H   H   H   H', 'hard 7');
    checkRow([card('3'), card('5')], 'H   H   H   H   H   H   H   H   H   H', 'hard 8');
  });

  it('9 doubles vs 3-6 only', () => {
    checkRow([card('4'), card('5')], 'H   D   D   D   D   H   H   H   H   H', 'hard 9');
  });

  it('10 doubles vs 2-9', () => {
    checkRow([card('6'), card('4')], 'D   D   D   D   D   D   D   D   H   H', 'hard 10');
  });

  it('11 doubles vs 2-10, hits vs A', () => {
    checkRow([card('6'), card('5')], 'D   D   D   D   D   D   D   D   D   H', 'hard 11');
  });

  it('12 stands vs 4-6 only', () => {
    checkRow([card('10'), card('2')], 'H   H   ST  ST  ST  H   H   H   H   H', 'hard 12');
  });

  it('13-16 stand vs 2-6', () => {
    checkRow([card('10'), card('3')], 'ST  ST  ST  ST  ST  H   H   H   H   H', 'hard 13');
    checkRow([card('10'), card('4')], 'ST  ST  ST  ST  ST  H   H   H   H   H', 'hard 14');
    checkRow([card('10'), card('5')], 'ST  ST  ST  ST  ST  H   H   H   H   H', 'hard 15');
    checkRow([card('10'), card('6')], 'ST  ST  ST  ST  ST  H   H   H   H   H', 'hard 16');
  });

  it('17+ always stands', () => {
    checkRow([card('10'), card('7')], 'ST  ST  ST  ST  ST  ST  ST  ST  ST  ST', 'hard 17');
    checkRow([card('10'), card('8')], 'ST  ST  ST  ST  ST  ST  ST  ST  ST  ST', 'hard 18');
    checkRow([card('10'), card('9')], 'ST  ST  ST  ST  ST  ST  ST  ST  ST  ST', 'hard 19');
    checkRow([card('10'), card('4'), card('6')], 'ST  ST  ST  ST  ST  ST  ST  ST  ST  ST', 'hard 20');
  });
});

describe('soft totals - transcribed from chart', () => {
  it('A,2 and A,3 double vs 5-6', () => {
    checkRow([card('A'), card('2')], 'H   H   H   D   D   H   H   H   H   H', 'A,2');
    checkRow([card('A'), card('3')], 'H   H   H   D   D   H   H   H   H   H', 'A,3');
  });

  it('A,4 and A,5 double vs 4-6', () => {
    checkRow([card('A'), card('4')], 'H   H   D   D   D   H   H   H   H   H', 'A,4');
    checkRow([card('A'), card('5')], 'H   H   D   D   D   H   H   H   H   H', 'A,5');
  });

  it('A,6 doubles vs 3-6', () => {
    checkRow([card('A'), card('6')], 'H   D   D   D   D   H   H   H   H   H', 'A,6');
  });

  it('A,7 stands vs 2, doubles 3-6, stands 7-8, hits 9-A', () => {
    checkRow([card('A'), card('7')], 'ST  D   D   D   D   ST  ST  H   H   H', 'A,7');
  });

  it('A,8 and A,9 always stand', () => {
    checkRow([card('A'), card('8')], 'ST  ST  ST  ST  ST  ST  ST  ST  ST  ST', 'A,8');
    checkRow([card('A'), card('9')], 'ST  ST  ST  ST  ST  ST  ST  ST  ST  ST', 'A,9');
  });
});

describe('pairs - transcribed from chart', () => {
  it('2,2 and 3,3 split vs 2-7', () => {
    checkRow([card('2'), card('2')], 'SP  SP  SP  SP  SP  SP  H   H   H   H', '2,2');
    checkRow([card('3'), card('3')], 'SP  SP  SP  SP  SP  SP  H   H   H   H', '3,3');
  });

  it('4,4 splits vs 5-6 only', () => {
    checkRow([card('4'), card('4')], 'H   H   H   SP  SP  H   H   H   H   H', '4,4');
  });

  it('5,5 plays as hard 10 - never splits', () => {
    checkRow([card('5'), card('5')], 'D   D   D   D   D   D   D   D   H   H', '5,5');
  });

  it('6,6 splits vs 2-6', () => {
    checkRow([card('6'), card('6')], 'SP  SP  SP  SP  SP  H   H   H   H   H', '6,6');
  });

  it('7,7 splits vs 2-7', () => {
    checkRow([card('7'), card('7')], 'SP  SP  SP  SP  SP  SP  H   H   H   H', '7,7');
  });

  it('8,8 always splits', () => {
    checkRow([card('8'), card('8')], 'SP  SP  SP  SP  SP  SP  SP  SP  SP  SP', '8,8');
  });

  it('9,9 splits except vs 7, 10, A', () => {
    checkRow([card('9'), card('9')], 'SP  SP  SP  SP  SP  ST  SP  SP  ST  ST', '9,9');
  });

  it('10,10 always stands', () => {
    checkRow([card('10'), card('10')], 'ST  ST  ST  ST  ST  ST  ST  ST  ST  ST', '10,10');
  });

  it('A,A always splits', () => {
    checkRow([card('A'), card('A')], 'SP  SP  SP  SP  SP  SP  SP  SP  SP  SP', 'A,A');
  });

  it('treats face cards as a 10-pair', () => {
    checkRow([card('K'), card('Q')], 'ST  ST  ST  ST  ST  ST  ST  ST  ST  ST', 'K,Q');
  });
});

describe('legality fallbacks', () => {
  it('demotes double to hit on a 3+ card hand', () => {
    // Hard 9 vs 4 says double, but after a hit doubling is illegal.
    const twoCard = [card('4'), card('5')];
    expect(getCorrectAction(twoCard, 4)).toBe('double');

    const threeCard = [card('2'), card('3'), card('4')]; // hard 9, 3 cards
    expect(getCorrectAction(threeCard, 4)).toBe('hit');
  });

  it('demotes soft 18 double to STAND, not hit', () => {
    // A,7 vs 4 doubles. A,3,4 is also soft 18 but cannot double - and the
    // right fallback is stand, because the double there is a stand variant.
    expect(getCorrectAction([card('A'), card('7')], 4)).toBe('double');
    expect(getCorrectAction([card('A'), card('3'), card('4')], 4)).toBe('stand');
  });

  it('demotes soft 17 double to HIT', () => {
    // A,6 vs 4 doubles; multi-card soft 17 should hit, not stand.
    expect(getCorrectAction([card('A'), card('6')], 4)).toBe('double');
    expect(getCorrectAction([card('A'), card('2'), card('4')], 4)).toBe('hit');
  });

  it('falls through to hard table when a pair is no longer a pair', () => {
    // 8,8 splits, but 8,8,5 (hard 21) must stand.
    expect(getCorrectAction([card('8'), card('8')], 6)).toBe('split');
    expect(getCorrectAction([card('8'), card('8'), card('5')], 6)).toBe('stand');
  });

  it('never returns split for a non-pair', () => {
    const hands: Card[][] = [
      [card('8'), card('8'), card('2')],
      [card('A'), card('A'), card('3')],
      [card('9'), card('9'), card('A')],
    ];
    for (const h of hands) {
      for (const up of UPCARDS) {
        expect(getCorrectAction(h, up)).not.toBe('split');
      }
    }
  });

  it('never returns double for a 3+ card hand', () => {
    const hands: Card[][] = [
      [card('2'), card('3'), card('4')],
      [card('A'), card('2'), card('3')],
      [card('5'), card('3'), card('2')],
    ];
    for (const h of hands) {
      for (const up of UPCARDS) {
        expect(getCorrectAction(h, up)).not.toBe('double');
      }
    }
  });
});

describe('coverage - every hand shape returns a legal action', () => {
  it('returns a valid action for all two-card hands vs all upcards', () => {
    const ranks: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const valid: Action[] = ['hit', 'stand', 'double', 'split'];
    let n = 0;
    for (const a of ranks) {
      for (const b of ranks) {
        for (const up of UPCARDS) {
          const got = getCorrectAction([card(a), card(b, 'hearts')], up);
          expect(valid, `${a},${b} vs ${up}`).toContain(got);
          n++;
        }
      }
    }
    expect(n).toBe(13 * 13 * 10);
  });
});

describe('soft-hand edge cases (regressions)', () => {
  it('hits an unsplittable soft 12 rather than standing', () => {
    // A,A with splitting unavailable is soft 12. The hard-12 row stands vs
    // 4-6, but a soft 12 cannot bust on a hit, so standing there is strictly
    // worse. Regression: this used to fall through to the hard table.
    for (const up of UPCARDS) {
      expect(chartActionIgnoringPairs([card('A'), card('A')], up), `soft 12 vs ${up}`)
        .toBe('hit');
    }
  });

  it('reads multi-card soft hands off the soft table', () => {
    // A,2,3 is soft 16 and should play as A,5 - double vs 4-6, else hit.
    checkRow([card('A'), card('2'), card('3')],
             'H   H   D   D   D   H   H   H   H   H', 'A,2,3 (soft 16)');
  });

  it('never stands on a soft total below 17', () => {
    // A soft hand under 17 can always be improved by hitting for free.
    const softHands: Card[][] = [
      [card('A'), card('A')],              // soft 12
      [card('A'), card('2')],              // soft 13
      [card('A'), card('A'), card('2')],   // soft 14
      [card('A'), card('2'), card('2')],   // soft 15
      [card('A'), card('A'), card('A')],   // soft 13
    ];
    for (const h of softHands) {
      for (const up of UPCARDS) {
        const a = chartActionIgnoringPairs(h, up);
        expect(a, `soft hand vs ${up}`).not.toBe('stand');
      }
    }
  });

  it('stands on a soft 21', () => {
    expect(chartActionIgnoringPairs([card('A'), card('A'), card('9')], 6)).toBe('stand');
  });
});
