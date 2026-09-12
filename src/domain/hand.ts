import { rankValue, type Card } from './cards';

export type HandValue = {
  /** Best total <= 21, or the minimum total if bust. */
  total: number;
  /** True when an ace is still counted as 11 (so the hand can't bust on a hit). */
  isSoft: boolean;
};

/**
 * Counts every ace as 11, then demotes them to 1 one at a time while bust.
 * The hand is soft if any ace survived as 11.
 */
export function handValue(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += rankValue(card.rank);
    if (card.rank === 'A') aces++;
  }

  let softAces = aces;
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces--;
  }

  return { total, isSoft: softAces > 0 };
}

/** A natural: exactly two cards totalling 21. A 21 after a hit is not a blackjack. */
export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21;
}

/**
 * Splittable on two cards of equal *rank value* - so K,Q counts as a 10-pair,
 * matching the chart's "10,10" row and standard casino rules.
 */
export function canSplit(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return rankValue(cards[0].rank) === rankValue(cards[1].rank);
}

/** Doubling is allowed on the first two cards only. */
export function canDouble(cards: Card[]): boolean {
  return cards.length === 2;
}
