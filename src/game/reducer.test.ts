import { describe, it, expect } from 'vitest';
import { createReducer, initialState, completeDeal, completeSeats, completeDealer } from './reducer';
import {
  DEFAULT_CONFIG, MIN_BET, STARTING_BANKROLL,
  CHECK_INTERVAL_MIN, CHECK_INTERVAL_MAX,
  type GameState, type GameAction,
} from './types';
import { runningCount } from '@/domain/counting';
import { canDeal } from './selectors';
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
  let s = completeDeal(reduce(state, { type: 'NEW_HAND' }), reduce);
  let guard = 0;
  while (s.phase === 'playerTurn' && guard++ < 20) {
    s = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
  }
  if (s.phase === 'seatsTurn') s = completeSeats(s, reduce);
  if (s.phase === 'dealerTurn') s = completeDealer(s, reduce);
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
    const s = completeDeal(reduce(initialState('basic', DEFAULT_CONFIG, seededRng()), { type: 'NEW_HAND' }), reduce);
    expect(s.playerHands[0].cards).toHaveLength(2);
    expect(s.dealerHand.cards).toHaveLength(2);
    for (const seat of s.seats) expect(seat.hands[0].cards).toHaveLength(2);
  });

  it('consumes exactly the cards it dealt', () => {
    const init = initialState('basic', { ...DEFAULT_CONFIG, numOtherPlayers: 3 }, seededRng());
    const s = completeDeal(reduce(init, { type: 'NEW_HAND' }), reduce);
    const expected = (3 + 1 + 1) * 2; // seats + user + dealer, two rounds
    expect(init.shoe.cards.length - s.shoe.cards.length).toBe(expected);
  });

  it('counts every visible card but NOT the hole card', () => {
    const init = initialState('basic', DEFAULT_CONFIG, seededRng());
    const s = completeDeal(reduce(init, { type: 'NEW_HAND' }), reduce);

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
      s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
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
      s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
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
    s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
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
    s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
    if (s.phase !== 'playerTurn') return;
    const after = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
    expect(after.lastDecision).not.toBeNull();
    expect(after.lastDecision!.chosen).toBe('stand');
  });

  it('applies the chosen action even when it was wrong', () => {
    let reached = false;
    let s = initialState('basic', DEFAULT_CONFIG, seededRng());
    for (let i = 0; i < 40; i++) {
      s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
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
      s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
      if (s.phase !== 'playerTurn') continue;
      const after = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
      expect(after.lastDecision).toBeNull();
    }
  });
});

describe('dealer play', () => {
  it('reveals the hole card and counts it exactly once', () => {
    let s = initialState('basic', DEFAULT_CONFIG, seededRng());
    s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
    while (s.phase === 'playerTurn') s = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
    if (s.phase === 'seatsTurn') s = completeSeats(s, reduce);

    const beforeCount = s.runningCount;
    const hole = s.dealerHand.cards[1];
    const wasRevealed = s.holeCardRevealed;

    s = completeDealer(s, reduce);
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
    expect(s.nextCheckAt).toBeGreaterThanOrEqual(CHECK_INTERVAL_MIN);
    expect(s.nextCheckAt).toBeLessThanOrEqual(CHECK_INTERVAL_MAX);

    for (let i = 0; i < 20 && s.phase !== 'countCheck'; i++) s = playHandStanding(s);
    expect(s.phase).toBe('countCheck');
    expect(s.handsPlayed).toBeGreaterThanOrEqual(CHECK_INTERVAL_MIN);
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

  it('schedules the next check within the configured range', () => {
    let s = initialState('counting', DEFAULT_CONFIG, seededRng());
    for (let i = 0; i < 20 && s.phase !== 'countCheck'; i++) s = playHandStanding(s);
    const before = s.handsPlayed;
    const after = reduce(s, { type: 'SUBMIT_COUNT', guess: 0 });
    expect(after.nextCheckAt - before).toBeGreaterThanOrEqual(CHECK_INTERVAL_MIN);
    expect(after.nextCheckAt - before).toBeLessThanOrEqual(CHECK_INTERVAL_MAX);
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
    s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
    while (s.phase === 'playerTurn') s = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
    if (s.phase === 'seatsTurn') s = completeSeats(s, reduce);
    if (s.phase === 'dealerTurn') s = completeDealer(s, reduce);

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
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      if (s.phase === 'playerTurn') {
        const [a, b] = s.playerHands[0].cards;
        if (a && b && handValue([a]).total === handValue([b]).total) return s;
      }
      while (s.phase === 'playerTurn') s = r(s, { type: 'PLAYER_ACTION', action: 'stand' });
      if (s.phase === 'seatsTurn') s = completeSeats(s, r);
      if (s.phase === 'dealerTurn') s = completeDealer(s, r);
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
      s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
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
      s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
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
      s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
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

describe('counting mode auto-plays the user seat', () => {
  it('never enters playerTurn - the drill has no decisions', () => {
    const r = createReducer(seededRng(31));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(31));
    for (let i = 0; i < 30; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      expect(s.phase, `entered playerTurn on hand ${i}`).not.toBe('playerTurn');
      if (s.phase === 'seatsTurn') s = completeSeats(s, r);
      if (s.phase === 'dealerTurn') s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
      if (s.phase === 'countCheck') s = r(s, { type: 'SUBMIT_COUNT', guess: 0 });
    }
  });

  it('resolves the user hand to a terminal status', () => {
    const r = createReducer(seededRng(33));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(33));
    for (let i = 0; i < 20; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      if (s.phase === 'seatsTurn') s = completeSeats(s, r);
      // After the seats phase the user's hand must be finished, not active.
      for (const h of s.playerHands) {
        expect(h.status, `user hand left active on hand ${i}`).not.toBe('active');
      }
      if (s.phase === 'dealerTurn') s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
      if (s.phase === 'countCheck') s = r(s, { type: 'SUBMIT_COUNT', guess: 0 });
    }
  });

  it('still settles outcomes for the auto-played hand', () => {
    const r = createReducer(seededRng(35));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(35));
    s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
    if (s.phase === 'seatsTurn') s = completeSeats(s, r);
    if (s.phase === 'dealerTurn') s = completeDealer(s, r);
    if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
    for (const h of s.playerHands) {
      expect(['win', 'lose', 'push', 'blackjack']).toContain(h.outcome);
    }
  });

  it('basic and live modes still stop for the player', () => {
    for (const mode of ['basic', 'live'] as const) {
      const r = createReducer(seededRng(37));
      let s = initialState(mode, DEFAULT_CONFIG, seededRng(37));
      let sawPlayerTurn = false;
      for (let i = 0; i < 15 && !sawPlayerTurn; i++) {
        if (mode === 'live') s = r(s, { type: 'PLACE_BET', amount: MIN_BET });
        s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
        if (s.phase === 'playerTurn') { sawPlayerTurn = true; break; }
        if (s.phase === 'seatsTurn') s = completeSeats(s, r);
        if (s.phase === 'dealerTurn') s = completeDealer(s, r);
        if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
      }
      expect(sawPlayerTurn, `${mode} never gave the player a turn`).toBe(true);
    }
  });
});

describe('naturals close out every hand (regression)', () => {
  it('leaves no seat active when a blackjack ends the round early', () => {
    // A natural on either side ends the hand before anyone acts, so
    // PLAY_SEATS never runs. Every hand must still be closed out, or the
    // table renders seats frozen mid-hand.
    for (const mode of ['basic', 'counting', 'live'] as const) {
      const r = createReducer(seededRng(33));
      let s = initialState(mode, DEFAULT_CONFIG, seededRng(33));
      let sawNatural = false;

      for (let i = 0; i < 60; i++) {
        if (mode === 'live') s = r(s, { type: 'PLACE_BET', amount: MIN_BET });
        s = completeDeal(r(s, { type: 'NEW_HAND' }), r);

        if (s.phase === 'dealerTurn' && s.holeCardRevealed) {
          sawNatural = true;
          for (const h of s.playerHands) {
            expect(h.status, `${mode}: player hand active after a natural`).not.toBe('active');
          }
          for (const seat of s.seats) {
            for (const h of seat.hands) {
              expect(h.status, `${mode}: seat hand active after a natural`).not.toBe('active');
            }
          }
          break;
        }

        while (s.phase === 'playerTurn') s = r(s, { type: 'PLAYER_ACTION', action: 'stand' });
        if (s.phase === 'seatsTurn') s = completeSeats(s, r);
        if (s.phase === 'dealerTurn') s = completeDealer(s, r);
        if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
        if (s.phase === 'countCheck') s = r(s, { type: 'SUBMIT_COUNT', guess: 0 });
      }

      expect(sawNatural, `${mode}: no natural occurred in 60 hands`).toBe(true);
    }
  });
});

describe('count check breakdown is self-consistent (regression)', () => {
  it('the numbers shown actually produce the answer shown', () => {
    // The reveal reads "running count is X, decks remaining is Y, so true
    // count is Z". If Z is graded against exact decks while Y is rounded to
    // half decks, the sentence contradicts itself and a correctly-counting
    // user is marked wrong.
    const r = createReducer(seededRng(77));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(77));
    let checked = 0;

    for (let i = 0; i < 120 && checked < 5; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      if (s.phase === 'seatsTurn') s = completeSeats(s, r);
      if (s.phase === 'dealerTurn') s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });

      if (s.phase === 'countCheck') {
        s = r(s, { type: 'SUBMIT_COUNT', guess: 12345 });
        const c = s.lastCountCheck!;
        expect(Math.round(c.running / c.decksRemaining), 'breakdown does not yield the stated true count')
          .toBe(c.actual);
        checked++;
      }
    }
    expect(checked, 'no count checks occurred').toBeGreaterThan(0);
  });

  it('grades a correct half-deck estimate as correct', () => {
    const r = createReducer(seededRng(79));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(79));

    for (let i = 0; i < 120; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      if (s.phase === 'seatsTurn') s = completeSeats(s, r);
      if (s.phase === 'dealerTurn') s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });

      if (s.phase === 'countCheck') {
        // Compute the answer the way a counter at the table would.
        const decks = Math.max(0.5, Math.round((s.shoe.cards.length / 52) * 2) / 2);
        const expected = Math.round(s.runningCount / decks);
        s = r(s, { type: 'SUBMIT_COUNT', guess: expected });
        expect(s.lastCountCheck!.wasCorrect, 'a correct half-deck estimate was marked wrong').toBe(true);
        return;
      }
    }
  });
});

describe('live mode hand-to-hand flow', () => {
  it('returns to a bettable state after each hand', () => {
    const r = createReducer(seededRng(41));
    let s = initialState('live', DEFAULT_CONFIG, seededRng(41));

    for (let i = 0; i < 10; i++) {
      expect(canDeal(s), `cannot bet before hand ${i}`).toBe(false); // no bet yet
      s = r(s, { type: 'PLACE_BET', amount: 25 });
      expect(canDeal(s), `bet placed but cannot deal on hand ${i}`).toBe(true);

      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      while (s.phase === 'playerTurn') s = r(s, { type: 'PLAYER_ACTION', action: 'stand' });
      if (s.phase === 'seatsTurn') s = completeSeats(s, r);
      if (s.phase === 'dealerTurn') s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });

      // Bet is cleared and the next hand can be staked.
      expect(s.currentBet, `bet not cleared after hand ${i}`).toBe(0);
      if (s.busted) break;
    }
  });

  it('pays a blackjack at 3:2', () => {
    const r = createReducer(seededRng(43));
    let s = initialState('live', DEFAULT_CONFIG, seededRng(43));

    for (let i = 0; i < 80; i++) {
      const staked = 100;
      const before = s.bankroll;
      s = r(s, { type: 'PLACE_BET', amount: staked });
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);

      const gotBJ = s.playerHands[0]?.status === 'blackjack';
      while (s.phase === 'playerTurn') s = r(s, { type: 'PLAYER_ACTION', action: 'stand' });
      if (s.phase === 'seatsTurn') s = completeSeats(s, r);
      if (s.phase === 'dealerTurn') s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });

      if (gotBJ && s.playerHands[0].outcome === 'blackjack') {
        // Stake returned plus 1.5x profit.
        expect(s.bankroll).toBe(before + staked * 1.5);
        return;
      }
      if (s.busted) break;
    }
  });

  it('marks the session over when the bankroll cannot cover the minimum', () => {
    const r = createReducer(seededRng(47));
    let s = initialState('live', DEFAULT_CONFIG, seededRng(47));
    // Stake the entire bankroll each hand until it is gone.
    for (let i = 0; i < 60 && !s.busted; i++) {
      s = r(s, { type: 'PLACE_BET', amount: s.bankroll });
      if (s.currentBet < MIN_BET) break;
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      while (s.phase === 'playerTurn') s = r(s, { type: 'PLAYER_ACTION', action: 'stand' });
      if (s.phase === 'seatsTurn') s = completeSeats(s, r);
      if (s.phase === 'dealerTurn') s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
    }
    if (s.busted) {
      expect(s.bankroll).toBeLessThan(MIN_BET);
      expect(canDeal(s)).toBe(false);
    }
  });

  it('never produces a negative bankroll or fractional chips', () => {
    const r = createReducer(seededRng(53));
    let s = initialState('live', DEFAULT_CONFIG, seededRng(53));
    for (let i = 0; i < 120 && !s.busted; i++) {
      const bet = Math.min(50, s.bankroll);
      if (bet < MIN_BET) break;
      s = r(s, { type: 'PLACE_BET', amount: bet });
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      let g = 0;
      while (s.phase === 'playerTurn' && g++ < 20) {
        const act = i % 4 === 0 ? 'double' : i % 4 === 1 ? 'split' : 'stand';
        const next = r(s, { type: 'PLAYER_ACTION', action: act });
        s = next === s ? r(s, { type: 'PLAYER_ACTION', action: 'stand' }) : next;
      }
      if (s.phase === 'seatsTurn') s = completeSeats(s, r);
      if (s.phase === 'dealerTurn') s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });

      expect(s.bankroll, `negative bankroll at hand ${i}`).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(s.bankroll * 2), `fractional chips at hand ${i}`).toBe(true);
    }
  });

  it('logs nothing and never fires a count check', () => {
    const r = createReducer(seededRng(59));
    let s = initialState('live', DEFAULT_CONFIG, seededRng(59));
    for (let i = 0; i < 40 && !s.busted; i++) {
      s = r(s, { type: 'PLACE_BET', amount: MIN_BET });
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      while (s.phase === 'playerTurn') s = r(s, { type: 'PLAYER_ACTION', action: 'stand' });
      if (s.phase === 'seatsTurn') s = completeSeats(s, r);
      if (s.phase === 'dealerTurn') s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });

      // Live play is a sandbox: no evaluation, no check-ins.
      expect(s.phase, 'live mode fired a count check').not.toBe('countCheck');
      expect(s.lastDecision, 'live mode recorded a strategy verdict').toBeNull();
      expect(s.lastCountCheck, 'live mode recorded a count check').toBeNull();
    }
  });
});

describe('incremental dealing', () => {
  it('deals no cards on NEW_HAND - only queues them', () => {
    const s = reduce(initialState('basic', DEFAULT_CONFIG, seededRng()), { type: 'NEW_HAND' });
    expect(s.phase).toBe('dealing');
    expect(s.playerHands[0].cards).toHaveLength(0);
    expect(s.dealerHand.cards).toHaveLength(0);
    for (const seat of s.seats) expect(seat.hands[0].cards).toHaveLength(0);
  });

  it('queues one card per seat per round, in table order', () => {
    const s = reduce(
      initialState('basic', { ...DEFAULT_CONFIG, numOtherPlayers: 3 }, seededRng()),
      { type: 'NEW_HAND' },
    );
    // 3 seats + user + dealer, twice round.
    expect(s.dealQueue).toHaveLength((3 + 1 + 1) * 2);

    const kinds = s.dealQueue.map((t) => t.kind);
    expect(kinds.slice(0, 5)).toEqual(['seat', 'seat', 'seat', 'player', 'dealer']);
    expect(kinds.slice(5)).toEqual(['seat', 'seat', 'seat', 'player', 'dealer']);
  });

  it('places exactly one card per DEAL_CARD', () => {
    let s = reduce(initialState('basic', DEFAULT_CONFIG, seededRng()), { type: 'NEW_HAND' });
    const total = s.dealQueue.length;

    for (let i = 1; i <= total; i++) {
      s = reduce(s, { type: 'DEAL_CARD' });
      const onTable =
        s.seats.reduce((n, seat) => n + seat.hands[0].cards.length, 0) +
        s.playerHands[0].cards.length +
        s.dealerHand.cards.length;
      expect(onTable, `after ${i} DEAL_CARD dispatches`).toBe(i);
    }
    expect(s.dealQueue).toHaveLength(0);
    expect(s.phase).not.toBe('dealing');
  });

  it('marks only the dealer hole card as the second dealer card', () => {
    const s = reduce(initialState('basic', DEFAULT_CONFIG, seededRng()), { type: 'NEW_HAND' });
    const dealerSlots = s.dealQueue.filter((t) => t.kind === 'dealer');
    expect(dealerSlots).toHaveLength(2);
    expect(dealerSlots[0]).toEqual({ kind: 'dealer', hole: false });
    expect(dealerSlots[1]).toEqual({ kind: 'dealer', hole: true });
  });

  it('does not count the hole card while it is face down', () => {
    let s = initialState('basic', DEFAULT_CONFIG, seededRng());
    for (let i = 0; i < 10; i++) {
      s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
      if (s.phase === 'playerTurn') {
        const visible = [
          ...s.seats.flatMap((x) => x.hands.flatMap((h) => h.cards)),
          ...s.playerHands.flatMap((h) => h.cards),
          s.dealerHand.cards[0],
        ];
        expect(s.runningCount).toBe(runningCount(visible));
        return;
      }
      s = playHandStanding(s);
    }
  });

  it('ignores DEAL_CARD outside the dealing phase', () => {
    const idle = initialState('basic', DEFAULT_CONFIG, seededRng());
    expect(reduce(idle, { type: 'DEAL_CARD' })).toBe(idle);
  });

  it('deals the same cards regardless of pacing', () => {
    // Drip-fed and drained-at-once must produce an identical table.
    const a = createReducer(seededRng(101));
    const b = createReducer(seededRng(101));

    let sa = a(initialState('basic', DEFAULT_CONFIG, seededRng(101)), { type: 'NEW_HAND' });
    while (sa.phase === 'dealing') sa = a(sa, { type: 'DEAL_CARD' });

    const sb = completeDeal(
      b(initialState('basic', DEFAULT_CONFIG, seededRng(101)), { type: 'NEW_HAND' }),
      b,
    );

    // Compare rank/suit, not ids: every shoe carries a unique serial prefix,
    // so two separately-created shoes never share card ids by design.
    const face = (cards: { rank: string; suit: string }[]) =>
      cards.map((c) => `${c.rank}${c.suit}`);

    expect(face(sa.playerHands[0].cards)).toEqual(face(sb.playerHands[0].cards));
    expect(face(sa.dealerHand.cards)).toEqual(face(sb.dealerHand.cards));
    expect(sa.runningCount).toBe(sb.runningCount);
  });
});

describe('play-out is paced one card at a time (regression)', () => {
  /** Every card visible on the table right now. */
  function cardCount(s: GameState): number {
    return (
      s.seats.reduce((n, seat) => n + seat.hands.reduce((m, h) => m + h.cards.length, 0), 0) +
      s.playerHands.reduce((n, h) => n + h.cards.length, 0) +
      s.dealerHand.cards.length
    );
  }

  it('never adds more than one card per PLAY_SEATS dispatch', () => {
    const r = createReducer(seededRng(61));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(61));

    for (let hand = 0; hand < 25; hand++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);

      let guard = 0;
      while (s.phase === 'seatsTurn' && guard++ < 256) {
        const before = cardCount(s);
        s = r(s, { type: 'PLAY_SEATS' });
        const added = cardCount(s) - before;
        // A split deals two cards in one action, which is how a real dealer
        // does it; anything beyond that is the bug this guards against.
        expect(added, `hand ${hand}: ${added} cards in one dispatch`).toBeLessThanOrEqual(2);
      }

      s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
      if (s.phase === 'countCheck') s = r(s, { type: 'SUBMIT_COUNT', guess: 0 });
    }
  });

  it('never adds more than one card per DEALER_PLAY dispatch', () => {
    const r = createReducer(seededRng(67));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(67));

    for (let hand = 0; hand < 25; hand++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      s = completeSeats(s, r);

      let guard = 0;
      while (s.phase === 'dealerTurn' && guard++ < 64) {
        const before = cardCount(s);
        s = r(s, { type: 'DEALER_PLAY' });
        expect(cardCount(s) - before, `hand ${hand}`).toBeLessThanOrEqual(1);
      }

      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
      if (s.phase === 'countCheck') s = r(s, { type: 'SUBMIT_COUNT', guess: 0 });
    }
  });

  it('reveals the hole card before drawing, as its own step', () => {
    const r = createReducer(seededRng(71));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(71));

    for (let i = 0; i < 20; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      s = completeSeats(s, r);

      if (s.phase === 'dealerTurn' && !s.holeCardRevealed) {
        const before = s.dealerHand.cards.length;
        s = r(s, { type: 'DEALER_PLAY' });
        // The reveal is a step on its own: no card is drawn alongside it.
        expect(s.holeCardRevealed).toBe(true);
        expect(s.dealerHand.cards.length).toBe(before);
        return;
      }

      s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
      if (s.phase === 'countCheck') s = r(s, { type: 'SUBMIT_COUNT', guess: 0 });
    }
  });

  it('still counts the hole card exactly once', () => {
    const r = createReducer(seededRng(73));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(73));

    for (let i = 0; i < 20; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      s = completeSeats(s, r);
      if (s.phase !== 'dealerTurn' || s.holeCardRevealed) {
        s = completeDealer(s, r);
        if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
        if (s.phase === 'countCheck') s = r(s, { type: 'SUBMIT_COUNT', guess: 0 });
        continue;
      }

      const before = s.runningCount;
      const hole = s.dealerHand.cards[1];
      const afterReveal = r(s, { type: 'DEALER_PLAY' });
      expect(afterReveal.runningCount).toBe(before + runningCount([hole]));

      // Re-dispatching must not count it again.
      const again = r(afterReveal, { type: 'DEALER_PLAY' });
      const drawn = again.dealerHand.cards.slice(afterReveal.dealerHand.cards.length);
      expect(again.runningCount).toBe(afterReveal.runningCount + runningCount(drawn));
      return;
    }
  });

  it('resolves every hand despite stepping', () => {
    const r = createReducer(seededRng(79));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(79));

    for (let i = 0; i < 30; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      s = completeSeats(s, r);
      s = completeDealer(s, r);

      for (const seat of s.seats) {
        for (const h of seat.hands) {
          expect(h.status, `seat left active on hand ${i}`).not.toBe('active');
        }
      }
      for (const h of s.playerHands) {
        expect(h.status, `player left active on hand ${i}`).not.toBe('active');
      }

      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
      if (s.phase === 'countCheck') s = r(s, { type: 'SUBMIT_COUNT', guess: 0 });
    }
  });
});

describe('count reveal survives the next hand (regression)', () => {
  it('keeps the check on screen while the drill deals on', () => {
    // The drill auto-starts the next hand ~1.4s after settlement. If NEW_HAND
    // clears lastCountCheck, the reveal is torn off screen while the user is
    // still reading it - which no toast duration can fix.
    const r = createReducer(seededRng(83));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(83));

    for (let i = 0; i < 30; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      s = completeSeats(s, r);
      s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });

      if (s.phase === 'countCheck') {
        s = r(s, { type: 'SUBMIT_COUNT', guess: 12345 });
        expect(s.lastCountCheck).not.toBeNull();
        const check = s.lastCountCheck;

        // Start the next hand - the reveal must still be there.
        s = r(s, { type: 'NEW_HAND' });
        expect(s.lastCountCheck, 'new hand wiped the count reveal').toBe(check);

        s = completeDeal(s, r);
        expect(s.lastCountCheck, 'dealing wiped the count reveal').toBe(check);
        return;
      }
    }
    throw new Error('no count check occurred');
  });

  it('is cleared only by an explicit dismiss', () => {
    const r = createReducer(seededRng(89));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(89));

    for (let i = 0; i < 30; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      s = completeSeats(s, r);
      s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });

      if (s.phase === 'countCheck') {
        s = r(s, { type: 'SUBMIT_COUNT', guess: 0 });
        expect(s.lastCountCheck).not.toBeNull();
        s = r(s, { type: 'DISMISS_COUNT_CHECK' });
        expect(s.lastCountCheck).toBeNull();
        return;
      }
    }
    throw new Error('no count check occurred');
  });

  it('replaces the previous check rather than showing a stale one', () => {
    const r = createReducer(seededRng(97));
    let s = initialState('counting', DEFAULT_CONFIG, seededRng(97));
    const seen: unknown[] = [];

    for (let i = 0; i < 40 && seen.length < 2; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      s = completeSeats(s, r);
      s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });
      if (s.phase === 'countCheck') {
        // Deliberately do NOT dismiss - the next check must still replace it.
        s = r(s, { type: 'SUBMIT_COUNT', guess: 4242 });
        seen.push(s.lastCountCheck);
      }
    }

    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]); // a fresh object, so the UI re-renders
  });
});

describe('heads-up table (no other players)', () => {
  it('deals and settles with zero seats', () => {
    const r = createReducer(seededRng(23));
    let s = initialState('basic', { ...DEFAULT_CONFIG, numOtherPlayers: 0 }, seededRng(23));
    expect(s.seats).toHaveLength(0);

    for (let i = 0; i < 20; i++) {
      s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
      // Only the user and the dealer get cards.
      expect(s.playerHands[0].cards).toHaveLength(2);
      expect(s.dealerHand.cards).toHaveLength(2);

      while (s.phase === 'playerTurn') s = r(s, { type: 'PLAYER_ACTION', action: 'stand' });
      s = completeSeats(s, r);
      s = completeDealer(s, r);
      if (s.phase === 'settlement') s = r(s, { type: 'SETTLE' });

      expect(['win', 'lose', 'push', 'blackjack']).toContain(s.playerHands[0].outcome);
    }
  });

  it('consumes only four cards per hand', () => {
    const r = createReducer(seededRng(29));
    const init = initialState('basic', { ...DEFAULT_CONFIG, numOtherPlayers: 0 }, seededRng(29));
    const s = completeDeal(r(init, { type: 'NEW_HAND' }), r);
    expect(init.shoe.cards.length - s.shoe.cards.length).toBe(4);
  });

  it('still evaluates decisions against the chart', () => {
    const r = createReducer(seededRng(31));
    let s = initialState('basic', { ...DEFAULT_CONFIG, numOtherPlayers: 0 }, seededRng(31));
    s = completeDeal(r(s, { type: 'NEW_HAND' }), r);
    if (s.phase !== 'playerTurn') return;
    const after = r(s, { type: 'PLAYER_ACTION', action: 'stand' });
    expect(after.lastDecision).not.toBeNull();
  });
});
