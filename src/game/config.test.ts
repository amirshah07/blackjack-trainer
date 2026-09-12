import { describe, it, expect } from 'vitest';
import { parseConfig } from './config';
import { DEFAULT_CONFIG } from './types';

describe('parseConfig', () => {
  it('reads valid values', () => {
    expect(parseConfig({ decks: '4', players: '6', speed: 'fast' })).toEqual({
      numDecks: 4, numOtherPlayers: 6, speed: 'fast',
    });
  });

  it('falls back to defaults when values are missing', () => {
    expect(parseConfig({})).toEqual(DEFAULT_CONFIG);
    expect(parseConfig({ decks: null, players: null, speed: null })).toEqual(DEFAULT_CONFIG);
  });

  it('clamps out-of-range values rather than trusting the URL', () => {
    expect(parseConfig({ decks: '99' }).numDecks).toBe(8);
    expect(parseConfig({ decks: '0' }).numDecks).toBe(1);
    expect(parseConfig({ decks: '-5' }).numDecks).toBe(1);
    expect(parseConfig({ players: '100' }).numOtherPlayers).toBe(7);
    expect(parseConfig({ players: '1' }).numOtherPlayers).toBe(2);
  });

  it('rounds fractional values', () => {
    expect(parseConfig({ decks: '3.7' }).numDecks).toBe(4);
  });

  it('ignores non-numeric junk', () => {
    expect(parseConfig({ decks: 'abc' }).numDecks).toBe(DEFAULT_CONFIG.numDecks);
    expect(parseConfig({ players: '' }).numOtherPlayers).toBe(DEFAULT_CONFIG.numOtherPlayers);
  });

  it('rejects an unknown speed', () => {
    expect(parseConfig({ speed: 'instant' }).speed).toBe(DEFAULT_CONFIG.speed);
    expect(parseConfig({ speed: 'slow' }).speed).toBe('slow');
  });

  it('always produces a playable table', () => {
    const junk = ['', 'x', '-1', '0', '999', '1e9', 'NaN', 'Infinity', '3.5'];
    for (const d of junk) {
      for (const p of junk) {
        const c = parseConfig({ decks: d, players: p });
        expect(c.numDecks).toBeGreaterThanOrEqual(1);
        expect(c.numDecks).toBeLessThanOrEqual(8);
        expect(c.numOtherPlayers).toBeGreaterThanOrEqual(2);
        expect(c.numOtherPlayers).toBeLessThanOrEqual(7);
        expect(Number.isInteger(c.numDecks)).toBe(true);
        expect(Number.isInteger(c.numOtherPlayers)).toBe(true);
      }
    }
  });
});
