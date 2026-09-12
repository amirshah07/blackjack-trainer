import { describe, it, expect } from 'vitest';
import { createReducer, initialState, completeDeal, completeSeats, completeDealer } from './reducer';
import { DEFAULT_CONFIG, MIN_BET, type GameState, type Mode } from './types';
import { CARDS_PER_DECK } from '@/domain/deck';

function seededRng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Drives a full session the way the UI will: deal, act, advance phases.
 * Asserts the machine never wedges, never deals a duplicate, and never
 * leaks chips.
 */
function soak(mode: Mode, numDecks: number, numOtherPlayers: number, seed: number, hands: number) {
  const reduce = createReducer(seededRng(seed));
  let s: GameState = initialState(mode, { numDecks, numOtherPlayers, speed: 'fast' }, seededRng(seed));
  let played = 0;

  for (let i = 0; i < hands; i++) {
    if (mode === 'live') {
      if (s.busted) break;
      s = reduce(s, { type: 'PLACE_BET', amount: MIN_BET });
    }

    s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);

    let guard = 0;
    while (s.phase === 'playerTurn' && guard++ < 30) {
      // Mix of actions to exercise splits, doubles and hits.
      const h = s.playerHands[s.activeHandIndex];
      const pick = h.cards.length === 2 && i % 3 === 0 ? 'split'
                 : h.cards.length === 2 && i % 3 === 1 ? 'double'
                 : i % 5 === 0 ? 'hit' : 'stand';
      const next = reduce(s, { type: 'PLAYER_ACTION', action: pick });
      // An illegal action returns the same state; fall back to standing.
      s = next === s ? reduce(s, { type: 'PLAYER_ACTION', action: 'stand' }) : next;
    }
    expect(s.phase, `wedged in playerTurn at hand ${i}`).not.toBe('playerTurn');

    if (s.phase === 'seatsTurn') s = completeSeats(s, reduce);
    if (s.phase === 'dealerTurn') s = completeDealer(s, reduce);
    if (s.phase === 'settlement') s = reduce(s, { type: 'SETTLE' });
    if (s.phase === 'countCheck') s = reduce(s, { type: 'SUBMIT_COUNT', guess: 0 });

    expect(['resolved', 'betting', 'idle'], `bad terminal phase at hand ${i}`).toContain(s.phase);

    // No duplicate cards on the table.
    const all = [
      ...s.seats.flatMap((x) => x.hands.flatMap((h) => h.cards)),
      ...s.playerHands.flatMap((h) => h.cards),
      ...s.dealerHand.cards,
    ].map((c) => c.id);
    expect(new Set(all).size, `duplicate card at hand ${i}`).toBe(all.length);

    // Shoe never goes negative or exceeds its size.
    expect(s.shoe.cards.length).toBeGreaterThanOrEqual(0);
    expect(s.shoe.cards.length).toBeLessThanOrEqual(numDecks * CARDS_PER_DECK);

    if (mode === 'live') {
      expect(s.bankroll, `negative bankroll at hand ${i}`).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(s.bankroll * 2), 'fractional chips').toBe(true);
    }
    played++;
  }
  return { state: s, played };
}

describe('soak - state machine stability', () => {
  const modes: Mode[] = ['basic', 'counting', 'live'];

  for (const mode of modes) {
    it(`${mode}: 200 hands at a 6-deck, 3-player table`, () => {
      const { played } = soak(mode, 6, 3, 42, 200);
      expect(played).toBeGreaterThan(0);
    });
  }

  it('survives the worst case: 1 deck, 7 other players', () => {
    const { played } = soak('basic', 1, 7, 3, 200);
    expect(played).toBe(200);
  });

  it('survives every deck count', () => {
    for (let decks = 1; decks <= 8; decks++) {
      const { played } = soak('basic', decks, 3, decks * 7, 60);
      expect(played, `failed at ${decks} decks`).toBe(60);
    }
  });

  it('survives every table size', () => {
    for (let players = 2; players <= 7; players++) {
      const { played } = soak('basic', 6, players, players * 11, 60);
      expect(played, `failed at ${players} players`).toBe(60);
    }
  });

  it('counting mode fires check-ins across a long session', () => {
    const reduce = createReducer(seededRng(99));
    let s = initialState('counting', { ...DEFAULT_CONFIG, numDecks: 6 }, seededRng(99));
    let checks = 0;

    for (let i = 0; i < 100; i++) {
      s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
      let g = 0;
      while (s.phase === 'playerTurn' && g++ < 30) s = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
      if (s.phase === 'seatsTurn') s = completeSeats(s, reduce);
      if (s.phase === 'dealerTurn') s = completeDealer(s, reduce);
      if (s.phase === 'settlement') s = reduce(s, { type: 'SETTLE' });
      if (s.phase === 'countCheck') { checks++; s = reduce(s, { type: 'SUBMIT_COUNT', guess: 0 }); }
    }
    // ~100 hands at one check every 8-15 hands.
    expect(checks).toBeGreaterThanOrEqual(6);
    expect(checks).toBeLessThanOrEqual(13);
  });
});
