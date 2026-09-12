import { type Card } from './cards';
import { handValue, isBlackjack, isBust } from './hand';

/**
 * Fixed house rule: dealer STANDS on soft 17. Baked in rather than configurable
 * so it can never drift out of sync with the strategy chart, which assumes it.
 */
export function dealerShouldHit(cards: Card[]): boolean {
  const { total, isSoft } = handValue(cards);
  if (total < 17) return true;
  if (total === 17 && isSoft) return false; // stands on soft 17
  return false;
}

export type Outcome = 'win' | 'lose' | 'push' | 'blackjack';

/** Payout multiplier applied to the bet. Blackjack pays 3:2. */
export const PAYOUT: Record<Outcome, number> = {
  blackjack: 1.5,
  win: 1,
  push: 0,
  lose: -1,
};

/**
 * Settles a finished player hand against the dealer. No surrender case.
 * `playerHadSplit` suppresses the 3:2 natural bonus - 21 on a split hand
 * pays even money, per standard rules.
 */
export function settle(
  playerCards: Card[],
  dealerCards: Card[],
  playerHadSplit = false,
): Outcome {
  const playerBJ = isBlackjack(playerCards) && !playerHadSplit;
  const dealerBJ = isBlackjack(dealerCards);

  if (playerBJ && dealerBJ) return 'push';
  if (playerBJ) return 'blackjack';
  if (dealerBJ) return 'lose';

  if (isBust(playerCards)) return 'lose';
  if (isBust(dealerCards)) return 'win';

  const player = handValue(playerCards).total;
  const dealer = handValue(dealerCards).total;

  if (player > dealer) return 'win';
  if (player < dealer) return 'lose';
  return 'push';
}
