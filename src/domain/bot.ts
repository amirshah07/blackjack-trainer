import { type Card } from './cards';
import { canDouble, canSplit } from './hand';
import { getCorrectAction, chartActionIgnoringPairs, type Action, type Upcard } from './strategy';

/**
 * Auto-plays a non-interactive seat. These players exist to consume cards and
 * move the count realistically, so they just follow the chart.
 */
export function botAction(
  cards: Card[],
  upcard: Upcard,
  opts: { handCount?: number; maxHands?: number } = {},
): Action {
  const { handCount = 1, maxHands = 4 } = opts;
  const action = getCorrectAction(cards, upcard);

  // Re-split cap reached: play the hand as a non-pair instead of splitting.
  if (action === 'split' && (handCount >= maxHands || !canSplit(cards))) {
    const fallback = chartActionIgnoringPairs(cards, upcard);
    return fallback === 'double' && !canDouble(cards) ? 'hit' : fallback;
  }

  if (action === 'double' && !canDouble(cards)) return 'hit';

  return action;
}
