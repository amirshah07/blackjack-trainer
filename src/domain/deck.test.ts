import { describe, it, expect } from 'vitest';
import {
  createShoe, createShuffledShoe, shuffle, deal, cutCardPosition,
  needsReshuffle, decksRemaining, CARDS_PER_DECK, PENETRATION,
} from './deck';

describe('createShoe', () => {
  it('builds 52 cards per deck', () => {
    for (const n of [1, 2, 6, 8]) {
      expect(createShoe(n).cards).toHaveLength(n * CARDS_PER_DECK);
    }
  });

  it('gives every card a unique id', () => {
    const shoe = createShoe(6);
    const ids = new Set(shoe.cards.map((c) => c.id));
    expect(ids.size).toBe(shoe.cards.length);
  });

  it('contains exactly 4 of each rank per deck', () => {
    const shoe = createShoe(2);
    const aces = shoe.cards.filter((c) => c.rank === 'A');
    expect(aces).toHaveLength(8);
  });
});

describe('shuffle', () => {
  it('preserves the multiset of cards', () => {
    const shoe = createShoe(2);
    const shuffled = shuffle(shoe);
    expect(shuffled.cards).toHaveLength(shoe.cards.length);
    expect([...shuffled.cards].map((c) => c.id).sort())
      .toEqual([...shoe.cards].map((c) => c.id).sort());
  });

  it('does not mutate the input', () => {
    const shoe = createShoe(1);
    const before = shoe.cards.map((c) => c.id);
    shuffle(shoe);
    expect(shoe.cards.map((c) => c.id)).toEqual(before);
  });

  it('is deterministic with a seeded rng', () => {
    const seeded = () => { let s = 42; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
    const a = createShuffledShoe(2, seeded());
    const b = createShuffledShoe(2, seeded());
    // Compare rank/suit ORDER, not ids: each shoe carries a unique serial
    // prefix so that a reshuffle cannot collide with cards still on the table.
    const shape = (s: typeof a) => s.cards.map((c) => `${c.rank}${c.suit}`);
    expect(shape(a)).toEqual(shape(b));
  });

  it('gives each shoe generation unique ids', () => {
    // A reshuffle can happen while old cards are still face up; ids are React
    // keys, so a collision would break the very animation they exist for.
    const a = createShoe(1);
    const b = createShoe(1);
    const overlap = new Set(a.cards.map((c) => c.id));
    for (const card of b.cards) expect(overlap.has(card.id)).toBe(false);
  });

  it('actually reorders', () => {
    const shoe = createShoe(2);
    const shuffled = shuffle(shoe);
    expect(shuffled.cards.map((c) => c.id)).not.toEqual(shoe.cards.map((c) => c.id));
  });
});

describe('deal', () => {
  it('takes from the top and is immutable', () => {
    const shoe = createShoe(1);
    const first = shoe.cards[0];
    const { card, shoe: after } = deal(shoe);

    expect(card).toEqual(first);
    expect(after.cards).toHaveLength(51);
    expect(shoe.cards).toHaveLength(52); // original untouched
    expect(after.dealtCount).toBe(1);
  });

  it('throws on an empty shoe', () => {
    const empty = { ...createShoe(1), cards: [] };
    expect(() => deal(empty)).toThrow(/empty shoe/i);
  });
});

describe('penetration and reshuffle', () => {
  it('puts the cut card at 75%', () => {
    expect(cutCardPosition(6)).toBe(Math.floor(6 * 52 * 0.75));
    expect(cutCardPosition(1)).toBe(39);
    expect(PENETRATION).toBe(0.75);
  });

  it('triggers reshuffle exactly at the cut card, not before', () => {
    let shoe = createShoe(1);
    const cut = cutCardPosition(1); // 39

    for (let i = 0; i < cut - 1; i++) shoe = deal(shoe).shoe;
    expect(shoe.dealtCount).toBe(cut - 1);
    expect(needsReshuffle(shoe)).toBe(false);

    shoe = deal(shoe).shoe;
    expect(shoe.dealtCount).toBe(cut);
    expect(needsReshuffle(shoe)).toBe(true);
  });
});

describe('decksRemaining', () => {
  it('reports fractional decks left', () => {
    let shoe = createShoe(6);
    expect(decksRemaining(shoe)).toBe(6);
    for (let i = 0; i < 26; i++) shoe = deal(shoe).shoe;
    expect(decksRemaining(shoe)).toBe(5.5);
  });
});
