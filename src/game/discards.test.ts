import { describe, it, expect } from 'vitest';
import { createReducer, initialState, completeDeal, completeSeats, completeDealer } from './reducer';
import { DEFAULT_CONFIG, type GameState } from './types';

function seededRng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const r = createReducer(seededRng(11));

/** Plays one hand from NEW_HAND to a terminal phase. */
function playHand(s: GameState): GameState {
  let next = completeDeal(r(s, { type: 'NEW_HAND' }), r);
  next = completeSeats(next, r);
  next = completeDealer(next, r);
  if (next.phase === 'settlement') next = r(next, { type: 'SETTLE' });
  if (next.phase === 'countCheck') next = r(next, { type: 'SUBMIT_COUNT', guess: 0 });
  return next;
}

describe('discard tray accounting', () => {
  it('does not move while a hand is in progress', () => {
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(11));
    s = playHand(s); // settle one hand so the tray is non-zero
    const settled = s.discardCount;

    // Deal the next hand card by card; the tray must not budge.
    s = r(s, { type: 'NEW_HAND' });
    while (s.phase === 'dealing') {
      s = r(s, { type: 'DEAL_CARD' });
      expect(s.discardCount, 'tray moved mid-deal').toBe(settled);
    }
    while (s.phase === 'seatsTurn') {
      s = r(s, { type: 'PLAY_SEATS' });
      expect(s.discardCount, 'tray moved during play').toBe(settled);
    }
    while (s.phase === 'dealerTurn') {
      s = r(s, { type: 'DEALER_PLAY' });
      expect(s.discardCount, 'tray moved during dealer play').toBe(settled);
    }

    // Only settlement adds to it.
    s = r(s, { type: 'SETTLE' });
    expect(s.discardCount).toBeGreaterThan(settled);
  });

  it('counts every card that was on the table', () => {
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(13));
    s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
    s = completeSeats(s, r);
    s = completeDealer(s, r);

    const onTable =
      s.seats.reduce((n, seat) => n + seat.hands.reduce((m, h) => m + h.cards.length, 0), 0) +
      s.playerHands.reduce((n, h) => n + h.cards.length, 0) +
      s.dealerHand.cards.length;

    const before = s.discardCount;
    s = r(s, { type: 'SETTLE' });
    expect(s.discardCount - before).toBe(onTable);
  });

  it('never exceeds the shoe, and tracks cards actually consumed', () => {
    let s = initialState('counting', { ...DEFAULT_CONFIG, numDecks: 6 }, seededRng(17));
    const total = 6 * 52;

    for (let i = 0; i < 80; i++) {
      const beforeShoe = s.shoe.cards.length;
      s = playHand(s);

      expect(s.discardCount).toBeGreaterThanOrEqual(0);
      expect(s.discardCount, `tray overflowed at hand ${i}`).toBeLessThanOrEqual(total);

      // Between reshuffles, discards + cards left in the shoe must never
      // exceed the shoe size (the difference is the hand just settled).
      if (s.shoe.cards.length <= beforeShoe) {
        expect(s.discardCount + s.shoe.cards.length).toBeLessThanOrEqual(total);
      }
    }
  });

  it('resets when the shoe is reshuffled', () => {
    let s = initialState('counting', { ...DEFAULT_CONFIG, numDecks: 1 }, seededRng(19));
    let sawReshuffle = false;

    for (let i = 0; i < 40; i++) {
      const before = s.shoe.cards.length;
      const beforeDiscards = s.discardCount;
      s = playHand(s);

      if (s.shoe.cards.length > before) {
        sawReshuffle = true;
        // The fresh shoe starts with an empty tray plus the hand just played.
        expect(s.discardCount).toBeLessThan(beforeDiscards);
        break;
      }
    }
    expect(sawReshuffle, 'no reshuffle occurred in 40 hands').toBe(true);
  });
});
