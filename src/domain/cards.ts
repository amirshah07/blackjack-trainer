/**
 * Card primitives. Pure data - no game logic lives here.
 */

export const RANKS = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
] as const;

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

/**
 * `id` is a stable, unique identifier assigned at shoe creation. React keys off
 * it so a card keeps its DOM node (and mid-flight animation) across re-renders.
 */
export type Card = {
  rank: Rank;
  suit: Suit;
  id: string;
};

/** Blackjack value of a rank. Aces return 11; demotion to 1 is handled in hand.ts. */
export function rankValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

/** True for 10/J/Q/K - the ranks that share a value but not an identity. */
export function isTenValue(rank: Rank): boolean {
  return rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K';
}

export function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}
