import { RANKS, SUITS, type Card } from './cards';

/** Fraction of the shoe dealt before the cut card triggers a reshuffle. Fixed rule. */
export const PENETRATION = 0.75;

export const CARDS_PER_DECK = 52;

/**
 * A shoe is dealt from the front. `dealtCount` tracks consumption for
 * penetration and decks-remaining maths, since the array itself shrinks.
 */
export type Shoe = {
  cards: Card[];
  numDecks: number;
  dealtCount: number;
};

/**
 * Monotonic shoe counter. Card ids must be unique across the whole session,
 * not just within one shoe: a reshuffle can happen while cards from the old
 * shoe are still face up on the table, and React keys off the id. Without a
 * per-shoe prefix the new shoe regenerates identical ids and two cards on
 * screen collide.
 */
let shoeSerial = 0;

export function createShoe(numDecks: number): Shoe {
  const serial = shoeSerial++;
  const cards: Card[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit, id: `s${serial}-${d}-${suit}-${rank}` });
      }
    }
  }
  return { cards, numDecks, dealtCount: 0 };
}

/** Test hook: resets the shoe serial so ids are reproducible run to run. */
export function __resetShoeSerial(): void {
  shoeSerial = 0;
}

/** Fisher-Yates. `rng` is injectable so tests can be deterministic. */
export function shuffle(shoe: Shoe, rng: () => number = Math.random): Shoe {
  const cards = [...shoe.cards];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { ...shoe, cards };
}

export function createShuffledShoe(
  numDecks: number,
  rng: () => number = Math.random,
): Shoe {
  return shuffle(createShoe(numDecks), rng);
}

/**
 * Deals one card off the top. Immutable: returns a new shoe rather than
 * mutating, so the reducer can treat state as a value.
 */
export function deal(shoe: Shoe): { card: Card; shoe: Shoe } {
  if (shoe.cards.length === 0) {
    throw new Error('Cannot deal from an empty shoe');
  }
  const [card, ...rest] = shoe.cards;
  return {
    card,
    shoe: { ...shoe, cards: rest, dealtCount: shoe.dealtCount + 1 },
  };
}

/** Card index at which the cut card sits (75% of the way through the shoe). */
export function cutCardPosition(numDecks: number): number {
  return Math.floor(numDecks * CARDS_PER_DECK * PENETRATION);
}

/** True once the cut card has been reached - reshuffle before the next hand. */
export function needsReshuffle(shoe: Shoe): boolean {
  return shoe.dealtCount >= cutCardPosition(shoe.numDecks);
}

/**
 * Decks left in the shoe, for true-count conversion. Not rounded - the
 * caller decides, since Hi-Lo convention varies on quarter/half-deck estimates.
 */
export function decksRemaining(shoe: Shoe): number {
  return shoe.cards.length / CARDS_PER_DECK;
}
