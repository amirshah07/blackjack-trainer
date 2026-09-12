import { describe, it, expect } from 'vitest';
import { botAction } from './bot';
import { UPCARDS } from './strategy';
import type { Card, Rank } from './cards';

let uid = 0;
const c = (rank: Rank): Card => ({ rank, suit: 'spades', id: `b${uid++}` });
const hand = (...ranks: Rank[]) => ranks.map(c);

describe('botAction', () => {
  it('follows the chart on ordinary hands', () => {
    expect(botAction(hand('10', '6'), 10)).toBe('hit');
    expect(botAction(hand('10', '6'), 5)).toBe('stand');
    expect(botAction(hand('8', '8'), 6)).toBe('split');
  });

  it('stops splitting at the 4-hand cap', () => {
    expect(botAction(hand('8', '8'), 6, { handCount: 4 })).not.toBe('split');
    expect(botAction(hand('8', '8'), 6, { handCount: 3 })).toBe('split');
  });

  it('plays a capped pair by its non-pair value', () => {
    // 9,9 vs 7 stands per the chart's pair row; capped, hard 18 also stands.
    expect(botAction(hand('9', '9'), 7, { handCount: 4 })).toBe('stand');
    // 8,8 capped = hard 16 vs 6 -> stand; vs 10 -> hit.
    expect(botAction(hand('8', '8'), 6, { handCount: 4 })).toBe('stand');
    expect(botAction(hand('8', '8'), 10, { handCount: 4 })).toBe('hit');
    // A,A capped = soft 12 -> hit.
    expect(botAction(hand('A', 'A'), 6, { handCount: 4 })).toBe('hit');
  });

  it('never doubles on a 3+ card hand', () => {
    for (const up of UPCARDS) {
      expect(botAction(hand('2', '3', '4'), up)).not.toBe('double');
    }
  });

  it('always returns a playable action', () => {
    const ranks: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    for (const a of ranks) {
      for (const b of ranks) {
        for (const up of UPCARDS) {
          const got = botAction([c(a), c(b)], up);
          expect(['hit','stand','double','split']).toContain(got);
        }
      }
    }
  });
});
