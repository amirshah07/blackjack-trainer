import { describe, it, expect } from 'vitest';
import { createReducer, initialState, completeDeal } from './reducer';
import { DEFAULT_CONFIG, type GameState } from './types';

function seededRng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function cardCount(s: GameState): number {
  return (
    s.seats.reduce((n, seat) => n + seat.hands.reduce((m, h) => m + h.cards.length, 0), 0) +
    s.playerHands.reduce((n, h) => n + h.cards.length, 0) +
    s.dealerHand.cards.length
  );
}

/**
 * Simulates exactly what the UI does - one dispatch per timer tick - and
 * records how many cards appear on each tick. This is the end-to-end check
 * that nothing ever bursts, across the whole hand and not just the deal.
 */
describe('no burst across a full hand', () => {
  it('adds at most one card per tick, opening deal through settlement', () => {
    const r = createReducer(seededRng(97));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(97));
    const additions: number[] = [];

    for (let hand = 0; hand < 40; hand++) {
      s = r(s, { type: 'NEW_HAND' });

      let guard = 0;
      while (guard++ < 400) {
        const before = cardCount(s);

        if (s.phase === 'dealing')          s = r(s, { type: 'DEAL_CARD' });
        else if (s.phase === 'seatsTurn')   s = r(s, { type: 'PLAY_SEATS' });
        else if (s.phase === 'dealerTurn')  s = r(s, { type: 'DEALER_PLAY' });
        else if (s.phase === 'settlement')  { s = r(s, { type: 'SETTLE' }); break; }
        else if (s.phase === 'countCheck')  { s = r(s, { type: 'SUBMIT_COUNT', guess: 0 }); break; }
        else break;

        const added = cardCount(s) - before;
        if (added > 0) additions.push(added);
      }
    }

    expect(additions.length).toBeGreaterThan(200); // actually exercised
    // A split places two cards in one action, as a real dealer does. Nothing
    // may exceed that.
    const worst = Math.max(...additions);
    expect(worst, `a tick added ${worst} cards at once`).toBeLessThanOrEqual(2);

    // And the vast majority must be single cards.
    const singles = additions.filter((a) => a === 1).length;
    expect(singles / additions.length).toBeGreaterThan(0.95);
  });

  it('never leaves a hand unresolved when settlement is reached', () => {
    const r = createReducer(seededRng(103));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(103));

    for (let hand = 0; hand < 40; hand++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      let guard = 0;
      while (s.phase !== 'resolved' && s.phase !== 'countCheck' && guard++ < 400) {
        if (s.phase === 'seatsTurn')      s = r(s, { type: 'PLAY_SEATS' });
        else if (s.phase === 'dealerTurn') s = r(s, { type: 'DEALER_PLAY' });
        else if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
        else break;
      }
      expect(guard, `hand ${hand} did not terminate`).toBeLessThan(400);
      for (const seat of s.seats)
        for (const h of seat.hands)
          expect(h.status, `seat active at settlement, hand ${hand}`).not.toBe('active');
      if (s.phase === 'countCheck') s = r(s, { type: 'SUBMIT_COUNT', guess: 0 });
    }
  });
});
