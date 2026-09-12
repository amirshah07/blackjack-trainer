import { describe, it, expect } from 'vitest';
import { handValue, isBlackjack, isBust, canSplit, canDouble } from './hand';
import type { Card, Rank, Suit } from './cards';

let uid = 0;
const c = (rank: Rank, suit: Suit = 'spades'): Card => ({ rank, suit, id: `h${uid++}` });
const hand = (...ranks: Rank[]) => ranks.map((r) => c(r));

describe('handValue', () => {
  it('sums number cards', () => {
    expect(handValue(hand('2', '3'))).toEqual({ total: 5, isSoft: false });
    expect(handValue(hand('9', '7'))).toEqual({ total: 16, isSoft: false });
  });

  it('counts face cards as 10', () => {
    expect(handValue(hand('K', 'Q')).total).toBe(20);
    expect(handValue(hand('J', '5')).total).toBe(15);
  });

  it('counts a lone ace as 11 when it fits', () => {
    expect(handValue(hand('A', '6'))).toEqual({ total: 17, isSoft: true });
  });

  it('demotes the ace to 1 when 11 would bust', () => {
    expect(handValue(hand('A', '6', '10'))).toEqual({ total: 17, isSoft: false });
  });

  it('demotes only as many aces as needed', () => {
    // A,A = 12 (one ace stays soft)
    expect(handValue(hand('A', 'A'))).toEqual({ total: 12, isSoft: true });
    // A,A,9 = 21 (one soft)
    expect(handValue(hand('A', 'A', '9'))).toEqual({ total: 21, isSoft: true });
    // A,A,9,5 = 16 (all hard)
    expect(handValue(hand('A', 'A', '9', '5'))).toEqual({ total: 16, isSoft: false });
  });

  it('handles four aces', () => {
    expect(handValue(hand('A', 'A', 'A', 'A'))).toEqual({ total: 14, isSoft: true });
  });

  it('reports the bust total, not a clamped one', () => {
    expect(handValue(hand('10', '9', '5')).total).toBe(24);
  });
});

describe('isBlackjack', () => {
  it('is true for a two-card 21', () => {
    expect(isBlackjack(hand('A', 'K'))).toBe(true);
    expect(isBlackjack(hand('10', 'A'))).toBe(true);
  });

  it('is false for a three-card 21', () => {
    expect(isBlackjack(hand('7', '7', '7'))).toBe(false);
    expect(isBlackjack(hand('A', '5', '5'))).toBe(false);
  });
});

describe('isBust', () => {
  it('detects busts and non-busts', () => {
    expect(isBust(hand('10', '10', '5'))).toBe(true);
    expect(isBust(hand('10', '10'))).toBe(false);
    expect(isBust(hand('A', '10', '10'))).toBe(false); // ace demotes to 21
  });
});

describe('canSplit', () => {
  it('is true for matching ranks', () => {
    expect(canSplit(hand('8', '8'))).toBe(true);
    expect(canSplit(hand('A', 'A'))).toBe(true);
  });

  it('is true for mixed ten-value cards', () => {
    expect(canSplit(hand('K', 'Q'))).toBe(true);
    expect(canSplit(hand('10', 'J'))).toBe(true);
  });

  it('is false for unequal values or 3+ cards', () => {
    expect(canSplit(hand('8', '9'))).toBe(false);
    expect(canSplit(hand('8', '8', '8'))).toBe(false);
  });
});

describe('canDouble', () => {
  it('is true only on the first two cards', () => {
    expect(canDouble(hand('5', '6'))).toBe(true);
    expect(canDouble(hand('5', '6', '2'))).toBe(false);
  });
});
