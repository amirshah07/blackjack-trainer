import { describe, it, expect } from 'vitest';
import { dealerShouldHit, settle, PAYOUT } from './rules';
import type { Card, Rank } from './cards';

let uid = 0;
const c = (rank: Rank): Card => ({ rank, suit: 'spades', id: `r${uid++}` });
const hand = (...ranks: Rank[]) => ranks.map(c);

describe('dealerShouldHit - stands on soft 17', () => {
  it('hits below 17', () => {
    expect(dealerShouldHit(hand('10', '6'))).toBe(true);
    expect(dealerShouldHit(hand('2', '3'))).toBe(true);
  });

  it('STANDS on soft 17 (the fixed house rule)', () => {
    expect(dealerShouldHit(hand('A', '6'))).toBe(false);
    expect(dealerShouldHit(hand('A', '3', '3'))).toBe(false);
  });

  it('stands on hard 17 and above', () => {
    expect(dealerShouldHit(hand('10', '7'))).toBe(false);
    expect(dealerShouldHit(hand('10', '8'))).toBe(false);
  });

  it('stands on soft 18+', () => {
    expect(dealerShouldHit(hand('A', '7'))).toBe(false);
  });
});

describe('settle', () => {
  it('pays blackjack 3:2', () => {
    expect(settle(hand('A', 'K'), hand('10', '8'))).toBe('blackjack');
    expect(PAYOUT.blackjack).toBe(1.5);
  });

  it('pushes blackjack against blackjack', () => {
    expect(settle(hand('A', 'K'), hand('A', 'Q'))).toBe('push');
  });

  it('loses to a dealer blackjack', () => {
    expect(settle(hand('10', '9'), hand('A', 'K'))).toBe('lose');
  });

  it('loses on a player bust even if the dealer also busts', () => {
    expect(settle(hand('10', '9', '5'), hand('10', '9', '5'))).toBe('lose');
  });

  it('wins when the dealer busts', () => {
    expect(settle(hand('10', '8'), hand('10', '6', '9'))).toBe('win');
  });

  it('compares totals otherwise', () => {
    expect(settle(hand('10', '9'), hand('10', '8'))).toBe('win');
    expect(settle(hand('10', '7'), hand('10', '8'))).toBe('lose');
    expect(settle(hand('10', '8'), hand('10', '8'))).toBe('push');
  });

  it('pays a split 21 as a normal win, not a blackjack', () => {
    expect(settle(hand('A', 'K'), hand('10', '8'), true)).toBe('win');
  });
});
