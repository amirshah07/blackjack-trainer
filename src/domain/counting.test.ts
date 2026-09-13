import { describe, it, expect } from 'vitest';
import { countValue, runningCount, trueCount, estimatedDecksRemaining, updateRunningCount, isCountAcceptable, COUNT_TOLERANCE } from './counting';
import { createShoe, deal } from './deck';
import type { Card, Rank } from './cards';

let uid = 0;
const c = (rank: Rank): Card => ({ rank, suit: 'spades', id: `k${uid++}` });

describe('countValue - Hi-Lo', () => {
  it('counts 2-6 as +1', () => {
    for (const r of ['2', '3', '4', '5', '6'] as Rank[]) expect(countValue(c(r))).toBe(1);
  });

  it('counts 7-9 as 0', () => {
    for (const r of ['7', '8', '9'] as Rank[]) expect(countValue(c(r))).toBe(0);
  });

  it('counts 10-A as -1', () => {
    for (const r of ['10', 'J', 'Q', 'K', 'A'] as Rank[]) expect(countValue(c(r))).toBe(-1);
  });
});

describe('runningCount', () => {
  it('sums a sequence', () => {
    expect(runningCount([c('2'), c('3'), c('K')])).toBe(1);
    expect(runningCount([c('A'), c('K'), c('Q')])).toBe(-3);
  });

  it('is zero over a full deck', () => {
    // Hi-Lo is a balanced system: a complete deck nets to zero.
    expect(runningCount(createShoe(1).cards)).toBe(0);
    expect(runningCount(createShoe(6).cards)).toBe(0);
  });

  it('accumulates onto an existing count', () => {
    expect(updateRunningCount(3, [c('5'), c('K')])).toBe(3);
    expect(updateRunningCount(-2, [c('4'), c('4')])).toBe(0);
  });
});

describe('trueCount', () => {
  it('divides running count by decks remaining', () => {
    expect(trueCount(6, 3)).toBe(2);
    expect(trueCount(10, 5)).toBe(2);
    expect(trueCount(-6, 2)).toBe(-3);
  });

  it('rounds to the nearest integer', () => {
    expect(trueCount(5, 2)).toBe(3);   // 2.5 -> 3
    expect(trueCount(4, 3)).toBe(1);   // 1.33 -> 1
    expect(trueCount(7, 3)).toBe(2);   // 2.33 -> 2
  });

  it('clamps the divisor so a near-empty shoe does not explode', () => {
    expect(Number.isFinite(trueCount(10, 0))).toBe(true);
    expect(trueCount(10, 0)).toBe(40);   // divisor clamped to 0.25
    expect(trueCount(10, 0.1)).toBe(40);
  });

  it('is zero when the running count is zero', () => {
    expect(trueCount(0, 4)).toBe(0);
  });
});

describe('estimatedDecksRemaining', () => {
  it('rounds to the nearest half deck', () => {
    let shoe = createShoe(6);
    expect(estimatedDecksRemaining(shoe)).toBe(6);
    for (let i = 0; i < 13; i++) shoe = deal(shoe).shoe; // 5.75 decks
    expect(estimatedDecksRemaining(shoe)).toBe(6);
    for (let i = 0; i < 13; i++) shoe = deal(shoe).shoe; // 5.5 decks
    expect(estimatedDecksRemaining(shoe)).toBe(5.5);
  });

  it('never returns zero', () => {
    const shoe = { ...createShoe(1), cards: [] };
    expect(estimatedDecksRemaining(shoe)).toBe(0.5);
  });
});

describe('isCountAcceptable', () => {
  it('accepts an exact answer', () => {
    expect(isCountAcceptable(4, 4)).toBe(true);
    expect(isCountAcceptable(-3, -3)).toBe(true);
    expect(isCountAcceptable(0, 0)).toBe(true);
  });

  it('accepts being off by one either way', () => {
    // Decks remaining is estimated by eye, so the quotient often sits near a
    // rounding boundary and two answers are both defensible.
    expect(isCountAcceptable(3, 4)).toBe(true);
    expect(isCountAcceptable(5, 4)).toBe(true);
    expect(isCountAcceptable(-2, -3)).toBe(true);
  });

  it('rejects being off by two or more', () => {
    expect(isCountAcceptable(2, 4)).toBe(false);
    expect(isCountAcceptable(6, 4)).toBe(false);
    expect(isCountAcceptable(0, 5)).toBe(false);
  });

  it('rejects a sign error, which changes the play', () => {
    // +3 and -3 are opposite betting decisions; that is never "close enough".
    expect(isCountAcceptable(3, -3)).toBe(false);
    expect(isCountAcceptable(-4, 4)).toBe(false);
  });

  it('is symmetric', () => {
    for (let a = -8; a <= 8; a++) {
      for (let b = -8; b <= 8; b++) {
        expect(isCountAcceptable(a, b)).toBe(isCountAcceptable(b, a));
      }
    }
  });

  it('matches the documented tolerance', () => {
    expect(COUNT_TOLERANCE).toBe(1);
    expect(isCountAcceptable(0, COUNT_TOLERANCE)).toBe(true);
    expect(isCountAcceptable(0, COUNT_TOLERANCE + 1)).toBe(false);
  });
});
