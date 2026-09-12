import { rankValue, isTenValue, type Card, type Rank } from './cards';
import { handValue, canDouble, canSplit } from './hand';

export type Action = 'hit' | 'stand' | 'double' | 'split';

/** Dealer upcard as a number, ace high at 11. Chart columns run 2..11. */
export type Upcard = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const UPCARDS: Upcard[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Shorthand so the tables below line up in the same grid shape as the chart
// image. H=hit, S=stand, D=double, P=split.
const H: Action = 'hit';
const S: Action = 'stand';
const D: Action = 'double';
const P: Action = 'split';

type Row = readonly [Action, Action, Action, Action, Action, Action, Action, Action, Action, Action];

/**
 * ---------------------------------------------------------------------------
 * HARD TOTALS - transcribed from the chart, rows 5-8 through 17+.
 * Columns:        2  3  4  5  6  7  8  9 10  A
 * ---------------------------------------------------------------------------
 */
export const HARD_TOTALS: Record<number, Row> = {
  5:  [H, H, H, H, H, H, H, H, H, H],
  6:  [H, H, H, H, H, H, H, H, H, H],
  7:  [H, H, H, H, H, H, H, H, H, H],
  8:  [H, H, H, H, H, H, H, H, H, H],
  9:  [H, D, D, D, D, H, H, H, H, H],
  10: [D, D, D, D, D, D, D, D, H, H],
  11: [D, D, D, D, D, D, D, D, D, H],
  12: [H, H, S, S, S, H, H, H, H, H],
  13: [S, S, S, S, S, H, H, H, H, H],
  14: [S, S, S, S, S, H, H, H, H, H],
  15: [S, S, S, S, S, H, H, H, H, H],
  16: [S, S, S, S, S, H, H, H, H, H],
  17: [S, S, S, S, S, S, S, S, S, S],
  18: [S, S, S, S, S, S, S, S, S, S],
  19: [S, S, S, S, S, S, S, S, S, S],
  20: [S, S, S, S, S, S, S, S, S, S],
  21: [S, S, S, S, S, S, S, S, S, S],
};

/**
 * ---------------------------------------------------------------------------
 * SOFT TOTALS - keyed by the NON-ACE rank, so 2 means A,2.
 * Columns:        2  3  4  5  6  7  8  9 10  A
 * ---------------------------------------------------------------------------
 */
export const SOFT_TOTALS: Record<number, Row> = {
  2: [H, H, H, D, D, H, H, H, H, H], // A,2
  3: [H, H, H, D, D, H, H, H, H, H], // A,3
  4: [H, H, D, D, D, H, H, H, H, H], // A,4
  5: [H, H, D, D, D, H, H, H, H, H], // A,5
  6: [H, D, D, D, D, H, H, H, H, H], // A,6
  7: [S, D, D, D, D, S, S, H, H, H], // A,7
  8: [S, S, S, S, S, S, S, S, S, S], // A,8
  9: [S, S, S, S, S, S, S, S, S, S], // A,9
};

/**
 * ---------------------------------------------------------------------------
 * PAIRS - keyed by the rank value of one card (11 = A,A).
 * Columns:        2  3  4  5  6  7  8  9 10  A
 *
 * NOTE: 5,5 is deliberately ABSENT. The chart plays it as hard 10, so it falls
 * through to HARD_TOTALS rather than duplicating that row here - one source of
 * truth means the two can never disagree.
 * ---------------------------------------------------------------------------
 */
export const PAIRS: Record<number, Row> = {
  2:  [P, P, P, P, P, P, H, H, H, H], // 2,2
  3:  [P, P, P, P, P, P, H, H, H, H], // 3,3
  4:  [H, H, H, P, P, H, H, H, H, H], // 4,4
  6:  [P, P, P, P, P, H, H, H, H, H], // 6,6
  7:  [P, P, P, P, P, P, H, H, H, H], // 7,7
  8:  [P, P, P, P, P, P, P, P, P, P], // 8,8
  9:  [P, P, P, P, P, S, P, P, S, S], // 9,9
  10: [S, S, S, S, S, S, S, S, S, S], // 10,10
  11: [P, P, P, P, P, P, P, P, P, P], // A,A
};

function columnIndex(upcard: Upcard): number {
  return upcard - 2;
}

/** Dealer upcard value from a card. Ace is 11. */
export function upcardValue(card: Card): Upcard {
  return rankValue(card.rank) as Upcard;
}

/**
 * The chart's ideal play, ignoring whether it's currently legal.
 * Exported for the chart overlay, which renders intent rather than legality.
 */
export function chartAction(cards: Card[], upcard: Upcard): Action {
  // Pairs take precedence over soft/hard - a pair of aces is A,A, not soft 12.
  if (canSplit(cards)) {
    const row = PAIRS[rankValue(cards[0].rank)];
    if (row) return row[columnIndex(upcard)]; // 5,5 has no row, falls through by design
  }
  return chartActionIgnoringPairs(cards, upcard);
}

/**
 * The chart's play, adjusted to what is actually legal for this hand.
 *
 * This is what evaluation compares against. The fallbacks matter: after a hit,
 * doubling and splitting are off the table, and the chart's intent has to
 * degrade to the next-best legal action or the player gets marked wrong for
 * doing the only thing available.
 */
export function getCorrectAction(cards: Card[], upcard: Upcard): Action {
  const ideal = chartAction(cards, upcard);

  if (ideal === 'split' && !canSplit(cards)) {
    // Not a pair any more - re-read the chart without the pair row.
    return demoteDouble(chartActionIgnoringPairs(cards, upcard), cards);
  }

  if (ideal === 'double' && !canDouble(cards)) {
    return demoteDouble(ideal, cards);
  }

  return ideal;
}

/** Chart lookup that skips the pairs table, for post-split and capped-resplit hands. */
export function chartActionIgnoringPairs(cards: Card[], upcard: Upcard): Action {
  const col = columnIndex(upcard);
  const { total, isSoft } = handValue(cards);

  if (isSoft) {
    // Key off the soft TOTAL rather than the non-ace card: A,A has no non-ace
    // card, and multi-card soft hands (A,2,3 = soft 16) need the same path.
    // total - 11 is the pip value the SOFT_TOTALS rows are keyed by.
    const row = SOFT_TOTALS[total - 11];
    if (row) return row[col];

    // Soft 12 (an unsplit A,A) has no chart row - the chart assumes aces are
    // always split. It must NOT fall through to the hard table: hard 12 stands
    // vs 4-6, but a soft 12 cannot bust on a hit, so standing is strictly
    // worse. Soft 21 likewise just stands.
    return total >= 21 ? S : H;
  }

  const hardRow = HARD_TOTALS[Math.max(5, Math.min(21, total))];
  return hardRow ? hardRow[col] : S;
}

/**
 * Degrades an illegal `double` to the right alternative.
 *
 * Doubling means "one more card, then stop", so it normally degrades to HIT.
 * The exception is soft 18 (A,7) vs 3-6: the chart doubles there as an
 * aggressive variant of standing, not of hitting - with no double available
 * the correct play is STAND. Getting this wrong only shows up on multi-card
 * hands, which is exactly the kind of bug that hides.
 */
function demoteDouble(action: Action, cards: Card[]): Action {
  if (action !== 'double') return action;
  const { total, isSoft } = handValue(cards);
  if (isSoft && total === 18) return 'stand';
  return 'hit';
}

/** Colour coding for the chart overlay, matching the source chart's key. */
export const ACTION_COLOURS: Record<Action, string> = {
  hit: '#22a44e',
  stand: '#e8112d',
  double: '#eda32c',
  split: '#1f7ae0',
};

export const ACTION_LABELS: Record<Action, string> = {
  hit: 'H',
  stand: 'ST',
  double: 'D',
  split: 'SP',
};

/** Human-readable action name, for toast copy. */
export function actionName(action: Action): string {
  return { hit: 'hit', stand: 'stand', double: 'double', split: 'split' }[action];
}

export { isTenValue, type Rank };
