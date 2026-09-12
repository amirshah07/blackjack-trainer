import { describe, it, expect } from 'vitest';
import { handLabel, legalActions, canDeal, dealerVisibleLabel } from './selectors';
import { initialState, createReducer, completeDeal } from './reducer';
import { DEFAULT_CONFIG, emptyHand, MIN_BET, type GameState, type Hand } from './types';
import type { Card, Rank } from '@/domain/cards';

let uid = 0;
const c = (rank: Rank): Card => ({ rank, suit: 'spades', id: `sel${uid++}` });
const hand = (ranks: Rank[], over: Partial<Hand> = {}): Hand => ({
  ...emptyHand(), cards: ranks.map(c), ...over,
});
const rng = (seed = 5) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

describe('handLabel', () => {
  it('shows a plain total for a hard hand', () => {
    expect(handLabel(hand(['10', '7']))).toBe('17');
  });

  it('shows both totals for a soft hand', () => {
    expect(handLabel(hand(['A', '6']))).toBe('7/17');
  });

  it('marks bust and blackjack', () => {
    expect(handLabel(hand(['10', '9', '5'], { status: 'bust' }))).toBe('24 BUST');
    expect(handLabel(hand(['A', 'K'], { status: 'blackjack' }))).toBe('BLACKJACK');
  });

  it('is empty for an empty hand', () => {
    expect(handLabel(hand([]))).toBe('');
  });
});

describe('dealerVisibleLabel', () => {
  it('shows only the upcard while the hole card is down', () => {
    const s: GameState = {
      ...initialState('basic', DEFAULT_CONFIG, rng()),
      dealerHand: hand(['10', '7']),
      holeCardRevealed: false,
    };
    // 10 showing, 7 hidden - must read 10, never 17.
    expect(dealerVisibleLabel(s)).toBe('10');
  });

  it('shows the full total once revealed', () => {
    const s: GameState = {
      ...initialState('basic', DEFAULT_CONFIG, rng()),
      dealerHand: hand(['10', '7']),
      holeCardRevealed: true,
    };
    expect(dealerVisibleLabel(s)).toBe('17');
  });
});

describe('legalActions', () => {
  function playing(cards: Rank[], over: Partial<GameState> = {}): GameState {
    return {
      ...initialState('basic', DEFAULT_CONFIG, rng()),
      phase: 'playerTurn',
      playerHands: [hand(cards)],
      activeHandIndex: 0,
      dealerHand: hand(['10', '5']),
      ...over,
    };
  }

  it('allows hit and stand on any live hand', () => {
    const l = legalActions(playing(['10', '6']));
    expect(l.hit).toBe(true);
    expect(l.stand).toBe(true);
  });

  it('allows double only on two cards', () => {
    expect(legalActions(playing(['5', '6'])).double).toBe(true);
    expect(legalActions(playing(['5', '6', '2'])).double).toBe(false);
  });

  it('allows split only on a pair', () => {
    expect(legalActions(playing(['8', '8'])).split).toBe(true);
    expect(legalActions(playing(['8', '9'])).split).toBe(false);
  });

  it('treats mixed ten-value cards as a splittable pair', () => {
    expect(legalActions(playing(['K', 'Q'])).split).toBe(true);
  });

  it('allows nothing outside the player turn', () => {
    const l = legalActions(playing(['10', '6'], { phase: 'dealerTurn' }));
    expect(Object.values(l).every((v) => v === false)).toBe(true);
  });

  it('blocks double and split when the bankroll cannot cover them', () => {
    const s = playing(['8', '8'], { mode: 'live', bankroll: 0 });
    s.playerHands = [hand(['8', '8'], { bet: 100 })];
    const l = legalActions(s);
    expect(l.double).toBe(false);
    expect(l.split).toBe(false);
    expect(l.hit).toBe(true); // hitting is always free
  });

  it('caps splits at four hands', () => {
    const s = playing(['8', '8']);
    s.playerHands = [hand(['8', '8']), hand(['8', '8']), hand(['8', '8']), hand(['8', '8'])];
    expect(legalActions(s).split).toBe(false);
  });
});

describe('canDeal', () => {
  it('is true at rest in basic mode', () => {
    expect(canDeal(initialState('basic', DEFAULT_CONFIG, rng()))).toBe(true);
  });

  it('is false mid-hand', () => {
    const s = { ...initialState('basic', DEFAULT_CONFIG, rng()), phase: 'playerTurn' as const };
    expect(canDeal(s)).toBe(false);
  });

  it('requires a bet in live mode', () => {
    const s = initialState('live', DEFAULT_CONFIG, rng());
    expect(canDeal(s)).toBe(false);
    expect(canDeal({ ...s, currentBet: MIN_BET })).toBe(true);
  });

  it('is false once the bankroll is gone', () => {
    const s = { ...initialState('live', DEFAULT_CONFIG, rng()), currentBet: MIN_BET, busted: true };
    expect(canDeal(s)).toBe(false);
  });
});

describe('dealer label never leaks the hole card', () => {
  it('keeps the hidden total out of the label across a real hand', () => {
    const reduce = createReducer(rng(21));
    let s = initialState('basic', DEFAULT_CONFIG, rng(21));
    for (let i = 0; i < 20; i++) {
      s = completeDeal(reduce(s, { type: 'NEW_HAND' }), reduce);
      if (s.phase === 'playerTurn' && !s.holeCardRevealed) {
        const shown = dealerVisibleLabel(s);
        const upcardOnly = handLabel({ ...s.dealerHand, cards: [s.dealerHand.cards[0]] });
        expect(shown).toBe(upcardOnly);
        return;
      }
      while (s.phase === 'playerTurn') s = reduce(s, { type: 'PLAYER_ACTION', action: 'stand' });
      if (s.phase === 'seatsTurn') s = reduce(s, { type: 'PLAY_SEATS' });
      if (s.phase === 'dealerTurn') s = reduce(s, { type: 'DEALER_PLAY' });
      if (s.phase === 'settlement') s = reduce(s, { type: 'SETTLE' });
    }
  });
});
