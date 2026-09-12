import { rankValue, type Card } from './cards';
import { decksRemaining, type Shoe } from './deck';

/**
 * Hi-Lo count value for a single card.
 *   2-6  -> +1   (low cards gone: good for the player)
 *   7-9  ->  0
 *   10-A -> -1
 */
export function countValue(card: Card): number {
  const v = rankValue(card.rank);
  if (v >= 2 && v <= 6) return 1;
  if (v >= 7 && v <= 9) return 0;
  return -1; // 10, J, Q, K, A
}

/** Running count for a set of cards. */
export function runningCount(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + countValue(card), 0);
}

/** Adds newly-seen cards to an existing running count. */
export function updateRunningCount(current: number, newCards: Card[]): number {
  return current + runningCount(newCards);
}

/**
 * True count = running count / decks remaining.
 *
 * Guards the divide when the shoe is nearly exhausted: below a quarter deck
 * the quotient explodes, so we clamp the divisor. Rounds to the nearest
 * integer, the usual convention for bet-sizing decisions.
 */
export function trueCount(running: number, decksLeft: number): number {
  const divisor = Math.max(decksLeft, 0.25);
  return Math.round(running / divisor);
}

/** Convenience: true count straight from a shoe. */
export function trueCountFromShoe(running: number, shoe: Shoe): number {
  return trueCount(running, decksRemaining(shoe));
}

/**
 * Decks remaining rounded to the nearest half deck - what a counter actually
 * estimates at the table, and what the reveal toast should quote.
 */
export function estimatedDecksRemaining(shoe: Shoe): number {
  return Math.max(0.5, Math.round(decksRemaining(shoe) * 2) / 2);
}
