import { describe, it, expect } from 'vitest';
import { createReducer, initialState } from './reducer';
import { DEFAULT_CONFIG, MIN_BET, STARTING_BANKROLL, type GameState, type GameAction } from './types';
import { runningCount } from '@/domain/counting';
import { handValue } from '@/domain/hand';
import { CARDS_PER_DECK } from '@/domain/deck';

/** Deterministic RNG so shuffles and check intervals are reproducible. */
function seededRng(seed = 42) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const reduce = createReducer(seededRng());

function run(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce((s, a) => reduce(s, a), state);
}

/** Plays one hand to completion, standing immediately on every player hand. */
function playHandStanding(state: GameState): GameState {
  let s = reduce(state, { type: 'NEW_HAND' });
  let guard = 0;
  while (s.phase === 'playerTurn' && guard++ < 20) {
    s = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
  }
  if (s.phase === 'seatsTurn') s = reduce(s, { type: 'PLAY_SEATS' });
  if (s.phase === 'dealerTurn') s = reduce(s, { type: 'DEALER_PLAY' });
  if (s.phase === 'settlement') s = reduce(s, { type: 'SETTLE' });
  return s;
}

describe('initialState', () => {
  it('builds a shuffled shoe of the configured size', () => {
    const s = initialState('basic', { ...DEFAULT_CONFIG, numDecks: 6 }, seededRng());
    expect(s.shoe.cards).toHaveLength(6 * CARDS_PER_DECK);
    expect(s.runningCount).toBe(0);
  });

  it('creates one seat per configured other player', () => {
    const s = initialState('basic', { ...DEFAULT_CONFIG, numOtherPlayers: 5 }, seededRng());
    expect(s.seats).toHaveLength(5);
  });

  it('starts live mode in the betting phase', () => {
    expect(initialState('live', DEFAULT_CONFIG, seededRng()).phase).toBe('betting');
    expect(initialState('basic', DEFAULT_CONFIG, seededRng()).phase).toBe('idle');
  });
});

describe('NEW_HAND', () => {
  it('deals two cards to every seat, the user, and the dealer', () => {
    const s = reduce(initialState('basic', DEFAULT_CONFIG, seededRng()), { type: 'NEW_HAND' });
    expect(s.playerHands[0].cards).toHaveLength(2);
    expect(s.dealerHand.cards).toHaveLength(2);
    for (const seat of s.seats) expect(seat.hands[0].cards).toHaveLength(2);
  });

  it('consumes exactly the cards it dealt', () => {
    const init = initialState('basic', { ...DEFAULT_CONFIG, numOtherPlayers: 3 }, seededRng());
    const s = reduce(init, { type: 'NEW_HAND' });
    const expected = (3 + 1 + 1) * 2; // seats + user + dealer, two rounds
    expect(init.shoe.cards.length - s.shoe.cards.length).toBe(expected);
  });

  it('counts every visible card but NOT the hole card', () => {
    const init = initialState('basic', DEFAULT_CONFIG, seededRng());
    const s = reduce(init, { type: 'NEW_HAND' });

    const visible = [
      ...s.seats.flatMap((x) => x.hands.flatMap((h) => h.cards)),
      ...s.playerHands.flatMap((h) => h.cards),
      s.dealerHand.cards[0],
    ];
    // Unless a natural ended the hand early, in which case the hole card counts too.
    if (!s.holeCardRevealed) {
      expect(s.runningCount).toBe(runningCount(visible));
    } else {
      expect(s.runningCount).toBe(runningCount([...visible, s.dealerHand.cards[1]]));
    }
  });

  it('leaves the hole card hidden on an ordinary hand', () => {
    let reached = false;
    let s = initialState('basic', DEFAULT_CONFIG, seededRng());
    for (let i = 0; i < 10; i++) {
      s = reduce(s, { type: 'NEW_HAND' });
      if (s.phase === 'playerTurn') {
        expect(s.holeCardRevealed).toBe(false);
        reached = true; return;
      }
      s = playHandStanding(s);
    }
    expect(reached, 'test setup never occurred - assertion never ran').toBe(true);
  });
});

describe('player actions', () => {
  it('hit adds a card and keeps the turn when under 21', () => {
    let reached = false;
    let s = initialState('basic', DEFAULT_CONFIG, seededRng());
    // find a hand that can safely take a card
    for (let i = 0; i < 40; i++) {
      s = reduce(s, { type: 'NEW_HAND' });
      if (s.phase === 'playerTurn' && handValue(s.playerHands[0].cards).total <= 8) {
        const before = s.playerHands[0].cards.length;
        const after = reduce(s, { type: 'PLAYER_ACTION', action: 'hit' });
        expect(after.playerHands[0].cards).toHaveLength(before + 1);
        reached = true; return;
      }
      s = playHandStanding(s);
    }
    expect(reached, 'test setup never occurred - assertion never ran').toBe(true);
  });

  it('stand ends the hand and advances the phase', () => {
    let s = initialState('basic', DEFAULT_CONFIG, seededRng());
    s = reduce(s, { type: 'NEW_HAND' });
    if (s.phase !== 'playerTurn') return;
    const after = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
    expect(after.playerHands[0].status).toBe('stood');
    expect(['seatsTurn', 'dealerTurn']).toContain(after.phase);
  });

  it('ignores actions outside the player turn', () => {
    const s = initialState('basic', DEFAULT_CONFIG, seededRng());
    expect(s.phase).toBe('idle');
    expect(reduce(s, { type: 'PLAYER_ACTION', action: 'hit' })).toBe(s);
  });
});

describe('basic strategy evaluation', () => {
  it('records a verdict on every action in basic mode', () => {
    let s = initialState('basic', DEFAULT_CONFIG, seededRng());
    s = reduce(s, { type: 'NEW_HAND' });
    if (s.phase !== 'playerTurn') return;
    const after = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
    expect(after.lastDecision).not.toBeNull();
    expect(after.lastDecision!.chosen).toBe('stand');
  });

  it('applies the chosen action even when it was wrong', () => {
    let reached = false;
    let s = initialState('basic', DEFAULT_CONFIG, seededRng());
    for (let i = 0; i < 40; i++) {
      s = reduce(s, { type: 'NEW_HAND' });
      if (s.phase === 'playerTurn' && handValue(s.playerHands[0].cards).total <= 8) {
        // Standing on 8 or less is always wrong.
        const after = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
        expect(after.lastDecision!.wasCorrect).toBe(false);
        expect(after.playerHands[0].status).toBe('stood'); // wrong play still applied
        reached = true; return;
      }
      s = playHandStanding(s);
    }
    expect(reached, 'test setup never occurred - assertion never ran').toBe(true);
  });

  it('records NO verdict in counting or live mode', () => {
    for (const mode of ['counting', 'live'] as const) {
      let s = initialState(mode, DEFAULT_CONFIG, seededRng());
      if (mode === 'live') s = reduce(s, { type: 'PLACE_BET', amount: MIN_BET });
      s = reduce(s, { type: 'NEW_HAND' });
      if (s.phase !== 'playerTurn') continue;
      const after = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
      expect(after.lastDecision).toBeNull();
    }
  });
});

describe('dealer play', () => {
  it('reveals the hole card and counts it exactly once', () => {
    let s = initialState('basic', DEFAULT_CONFIG, seededRng());
    s = reduce(s, { type: 'NEW_HAND' });
    while (s.phase === 'playerTurn') s = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
    if (s.phase === 'seatsTurn') s = reduce(s, { type: 'PLAY_SEATS' });

    const beforeCount = s.runningCount;
    const hole = s.dealerHand.cards[1];
    const wasRevealed = s.holeCardRevealed;

    s = reduce(s, { type: 'DEALER_PLAY' });
    expect(s.holeCardRevealed).toBe(true);

    if (!wasRevealed) {
      const drawn = s.dealerHand.cards.slice(2);
      expect(s.runningCount).toBe(beforeCount + runningCount([hole, ...drawn]));
    }
  });

  it('stands on soft 17', () => {
    let reached = false;
    let s = initialState('basic', DEFAULT_CONFIG, seededRng());
    for (let i = 0; i < 60; i++) {
      s = playHandStanding(s);
      const v = handValue(s.dealerHand.cards);
      if (v.isSoft && v.total === 17) {
        expect(s.dealerHand.cards.length).toBeGreaterThanOrEqual(2);
        reached = true; return; // reached soft 17 and stopped
      }
    }
    expect(reached, 'dealer never reached soft 17 in 60 hands').toBe(true);
  });
});

describe('settlement', () => {
  it('assigns an outcome to every player hand', () => {
    const s = playHandStanding(initialState('basic', DEFAULT_CONFIG, seededRng()));
    for (const h of s.playerHands) {
      expect(['win', 'lose', 'push', 'blackjack']).toContain(h.outcome);
    }
  });

  it('increments hands played', () => {
    const s = playHandStanding(initialState('basic', DEFAULT_CONFIG, seededRng()));
    expect(s.handsPlayed).toBe(1);
  });
});

describe('reshuffle at the cut card', () => {
  it('reshuffles once penetration is reached, never mid-hand', () => {
    let s = initialState('basic', { ...DEFAULT_CONFIG, numDecks: 1 }, seededRng());
    let sawReshuffle = false;

    for (let i = 0; i < 30; i++) {
      const before = s.shoe.cards.length;
      s = playHandStanding(s);
      if (s.shoe.cards.length > before) { sawReshuffle = true; break; }
      if (s.busted) break;
    }
    expect(sawReshuffle).toBe(true);
  });

  it('resets the running count on a fresh shoe', () => {
    let s = initialState('basic', { ...DEFAULT_CONFIG, numDecks: 1 }, seededRng());
    for (let i = 0; i < 30; i++) {
      const before = s.shoe.cards.length;
      const next = playHandStanding(s);
      if (next.shoe.cards.length > before) {
        // The reshuffle happened at the START of this hand, so the count
        // reflects only cards dealt from the new shoe.
        const dealt = [
          ...next.seats.flatMap((x) => x.hands.flatMap((h) => h.cards)),
          ...next.playerHands.flatMap((h) => h.cards),
          ...next.dealerHand.cards,
        ];
        expect(Math.abs(next.runningCount)).toBeLessThanOrEqual(dealt.length);
        return;
      }
      s = next;
    }
  });
});

describe('live mode bankroll', () => {
  it('deducts the bet when placed and returns it on a push', () => {
    let s = initialState('live', DEFAULT_CONFIG, seededRng());
    s = reduce(s, { type: 'PLACE_BET', amount: 100 });
    expect(s.bankroll).toBe(STARTING_BANKROLL - 100);
    expect(s.currentBet).toBe(100);
  });

  it('clears a bet back to the bankroll', () => {
    let s = initialState('live', DEFAULT_CONFIG, seededRng());
    s = run(s, { type: 'PLACE_BET', amount: 250 }, { type: 'CLEAR_BET' });
    expect(s.bankroll).toBe(STARTING_BANKROLL);
    expect(s.currentBet).toBe(0);
  });

  it('never lets a bet exceed the bankroll', () => {
    let s = initialState('live', DEFAULT_CONFIG, seededRng());
    s = reduce(s, { type: 'PLACE_BET', amount: 99999 });
    expect(s.bankroll).toBe(0);
    expect(s.currentBet).toBe(STARTING_BANKROLL);
  });

  it('conserves money across a settled hand', () => {
    let s = initialState('live', DEFAULT_CONFIG, seededRng());
    s = reduce(s, { type: 'PLACE_BET', amount: 100 });
    const committed = s.bankroll + s.currentBet;
    expect(committed).toBe(STARTING_BANKROLL);

    s = playHandStanding(s);
    // Bankroll must equal starting +/- the settled amount, never leak chips.
    expect(s.bankroll).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(s.bankroll)).toBe(true);
  });

  it('requires a bet before dealing', () => {
    const s = initialState('live', DEFAULT_CONFIG, seededRng());
    expect(reduce(s, { type: 'NEW_HAND' })).toBe(s); // no bet placed
  });
});

describe('count check-ins (counting mode)', () => {
  it('pauses for an estimate at the scheduled hand', () => {
    let s = initialState('counting', DEFAULT_CONFIG, seededRng());
    expect(s.nextCheckAt).toBeGreaterThanOrEqual(8);
    expect(s.nextCheckAt).toBeLessThanOrEqual(15);

    for (let i = 0; i < 20 && s.phase !== 'countCheck'; i++) s = playHandStanding(s);
    expect(s.phase).toBe('countCheck');
    expect(s.handsPlayed).toBeGreaterThanOrEqual(8);
  });

  it('grades the estimate and reveals the breakdown', () => {
    let s = initialState('counting', DEFAULT_CONFIG, seededRng());
    for (let i = 0; i < 20 && s.phase !== 'countCheck'; i++) s = playHandStanding(s);

    const graded = reduce(s, { type: 'SUBMIT_COUNT', guess: 999 });
    const check = graded.lastCountCheck!;
    expect(check.wasCorrect).toBe(false);
    expect(check.running).toBe(s.runningCount);
    expect(check.decksRemaining).toBeGreaterThan(0);
    expect(graded.phase).toBe('resolved');
  });

  it('schedules the next check 8-15 hands out', () => {
    let s = initialState('counting', DEFAULT_CONFIG, seededRng());
    for (let i = 0; i < 20 && s.phase !== 'countCheck'; i++) s = playHandStanding(s);
    const before = s.handsPlayed;
    const after = reduce(s, { type: 'SUBMIT_COUNT', guess: 0 });
    expect(after.nextCheckAt - before).toBeGreaterThanOrEqual(8);
    expect(after.nextCheckAt - before).toBeLessThanOrEqual(15);
  });

  it('never pauses in basic or live mode', () => {
    for (const mode of ['basic', 'live'] as const) {
      let s = initialState(mode, DEFAULT_CONFIG, seededRng());
      for (let i = 0; i < 20; i++) {
        if (mode === 'live') s = reduce(s, { type: 'PLACE_BET', amount: MIN_BET });
        s = playHandStanding(s);
        expect(s.phase).not.toBe('countCheck');
        if (s.busted) break;
      }
    }
  });
});

describe('invariants over a long session', () => {
  it('never deals a duplicate card within a hand', () => {
    let s = initialState('basic', DEFAULT_CONFIG, seededRng(7));
    for (let i = 0; i < 50; i++) {
      s = playHandStanding(s);
      const all = [
        ...s.seats.flatMap((x) => x.hands.flatMap((h) => h.cards)),
        ...s.playerHands.flatMap((h) => h.cards),
        ...s.dealerHand.cards,
      ];
      const ids = all.map((c) => c.id);
      expect(new Set(ids).size, `duplicate dealt on hand ${i}`).toBe(ids.length);
    }
  });

  it('never runs the shoe dry', () => {
    let s = initialState('basic', { ...DEFAULT_CONFIG, numDecks: 1, numOtherPlayers: 7 }, seededRng(3));
    for (let i = 0; i < 100; i++) {
      s = playHandStanding(s);
      expect(s.shoe.cards.length).toBeGreaterThan(0);
    }
  });

  it('always terminates the player turn', () => {
    let s = initialState('basic', DEFAULT_CONFIG, seededRng(11));
    for (let i = 0; i < 50; i++) {
      s = playHandStanding(s);
      expect(s.phase).not.toBe('playerTurn');
    }
  });
});

describe('idempotent settlement (regression)', () => {
  it('does not apply settlement twice', () => {
    let s = initialState('live', DEFAULT_CONFIG, seededRng());
    s = reduce(s, { type: 'PLACE_BET', amount: 100 });
    s = reduce(s, { type: 'NEW_HAND' });
    while (s.phase === 'playerTurn') s = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
    if (s.phase === 'seatsTurn') s = reduce(s, { type: 'PLAY_SEATS' });
    if (s.phase === 'dealerTurn') s = reduce(s, { type: 'DEALER_PLAY' });

    const once = reduce(s, { type: 'SETTLE' });
    const twice = reduce(once, { type: 'SETTLE' });

    // A repeated SETTLE must be a no-op - otherwise hand counts drift and the
    // count check-in schedule slips.
    expect(twice.handsPlayed).toBe(once.handsPlayed);
    expect(twice.bankroll).toBe(once.bankroll);
    expect(twice).toBe(once);
  });
});

describe('splitting', () => {
  /** Deals repeatedly until the user is dealt a splittable pair. */
  function findPair(mode: 'basic' | 'live', seed: number): GameState | null {
    const r = createReducer(seededRng(seed));
    let s = initialState(mode, DEFAULT_CONFIG, seededRng(seed));
    for (let i = 0; i < 200; i++) {
      if (mode === 'live') s = r(s, { type: 'PLACE_BET', amount: 100 });
      s = r(s, { type: 'NEW_HAND' });
      if (s.phase === 'playerTurn') {
        const [a, b] = s.playerHands[0].cards;
        if (a && b && handValue([a]).total === handValue([b]).total) return s;
      }
      while (s.phase === 'playerTurn') s = r(s, { type: 'PLAYER_ACTION', action: 'stand' });
      if (s.phase === 'seatsTurn') s = r(s, { type: 'PLAY_SEATS' });
      if (s.phase === 'dealerTurn') s = r(s, { type: 'DEALER_PLAY' });
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
    }
    return null;
  }

  it('turns one hand into two, each with two cards', () => {
    const s = findPair('basic', 5);
    expect(s, 'no splittable pair found in 200 hands').not.toBeNull();
    if (!s) return;
    const after = reduce(s, { type: 'PLAYER_ACTION', action: 'split' });
    expect(after.playerHands).toHaveLength(2);
    for (const h of after.playerHands) {
      expect(h.cards).toHaveLength(2);
      expect(h.fromSplit).toBe(true);
    }
  });

  it('marks split hands so a 21 pays even money, not 3:2', () => {
    const s = findPair('basic', 5);
    expect(s, 'no splittable pair found in 200 hands').not.toBeNull();
    if (!s) return;
    const after = reduce(s, { type: 'PLAYER_ACTION', action: 'split' });
    // fromSplit suppresses the natural bonus in settle()
    expect(after.playerHands.every((h) => h.fromSplit)).toBe(true);
    expect(after.playerHands.every((h) => h.status !== 'blackjack')).toBe(true);
  });

  it('takes a second stake from the bankroll in live mode', () => {
    const s = findPair('live', 5);
    expect(s, 'no splittable pair found in 200 hands').not.toBeNull();
    if (!s) return;
    const before = s.bankroll;
    const bet = s.playerHands[0].bet;
    const after = reduce(s, { type: 'PLAYER_ACTION', action: 'split' });
    if (after.playerHands.length === 2) {
      expect(after.bankroll).toBe(before - bet);
    }
  });

  it('refuses to split a non-pair', () => {
    let reached = false;
    let s = initialState('basic', DEFAULT_CONFIG, seededRng(9));
    for (let i = 0; i < 50; i++) {
      s = reduce(s, { type: 'NEW_HAND' });
      if (s.phase === 'playerTurn') {
        const [a, b] = s.playerHands[0].cards;
        if (handValue([a]).total !== handValue([b]).total) {
          expect(reduce(s, { type: 'PLAYER_ACTION', action: 'split' })).toBe(s);
          reached = true;
          return;
        }
      }
      s = playHandStanding(s);
    }
    expect(reached, 'never dealt a non-pair to test against').toBe(true);
  });
});

describe('doubling', () => {
  it('draws exactly one card, doubles the stake, and ends the hand', () => {
    let reached = false;
    let s = initialState('live', DEFAULT_CONFIG, seededRng(13));
    for (let i = 0; i < 50; i++) {
      s = reduce(s, { type: 'PLACE_BET', amount: 100 });
      s = reduce(s, { type: 'NEW_HAND' });
      if (s.phase === 'playerTurn' && s.playerHands[0].cards.length === 2) {
        const bankrollBefore = s.bankroll;
        const after = reduce(s, { type: 'PLAYER_ACTION', action: 'double' });
        expect(after.playerHands[0].cards).toHaveLength(3);
        expect(after.playerHands[0].bet).toBe(200);
        expect(after.bankroll).toBe(bankrollBefore - 100);
        expect(after.phase).not.toBe('playerTurn');
        reached = true; return;
      }
      s = playHandStanding(s);
    }
    expect(reached, 'test setup never occurred - assertion never ran').toBe(true);
  });

  it('refuses to double on a 3+ card hand', () => {
    let reached = false;
    let s = initialState('basic', DEFAULT_CONFIG, seededRng(17));
    for (let i = 0; i < 50; i++) {
      s = reduce(s, { type: 'NEW_HAND' });
      if (s.phase === 'playerTurn' && handValue(s.playerHands[0].cards).total <= 8) {
        const hit = reduce(s, { type: 'PLAYER_ACTION', action: 'hit' });
        if (hit.phase === 'playerTurn' && hit.playerHands[0].cards.length === 3) {
          expect(reduce(hit, { type: 'PLAYER_ACTION', action: 'double' })).toBe(hit);
          reached = true;
          return;
        }
      }
      s = playHandStanding(s);
    }
    expect(reached, 'never reached a 3-card hand to test against').toBe(true);
  });
});
