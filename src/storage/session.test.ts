import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStats, logResult, clearStats, accuracy } from './session';

/** Minimal sessionStorage stand-in - the tests run in node, not jsdom. */
function installStorage(): Storage {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  } as Storage;
  vi.stubGlobal('window', { sessionStorage: store });
  return store;
}

describe('session storage', () => {
  beforeEach(() => { installStorage(); });

  it('starts empty', () => {
    expect(getStats('strategy')).toEqual({ correct: 0, total: 0 });
  });

  it('accumulates correct and incorrect results', () => {
    logResult('strategy', true);
    logResult('strategy', false);
    logResult('strategy', true);
    expect(getStats('strategy')).toEqual({ correct: 2, total: 3 });
  });

  it('keeps the two tallies independent', () => {
    logResult('strategy', true);
    logResult('counting', false);
    expect(getStats('strategy')).toEqual({ correct: 1, total: 1 });
    expect(getStats('counting')).toEqual({ correct: 0, total: 1 });
  });

  it('clears one key or all of them', () => {
    logResult('strategy', true);
    logResult('counting', true);
    clearStats('strategy');
    expect(getStats('strategy').total).toBe(0);
    expect(getStats('counting').total).toBe(1);
    clearStats();
    expect(getStats('counting').total).toBe(0);
  });

  it('returns the updated tally from logResult', () => {
    expect(logResult('strategy', true)).toEqual({ correct: 1, total: 1 });
  });
});

describe('resilience', () => {
  it('survives corrupted JSON', () => {
    const s = installStorage();
    s.setItem('bj:strategy', '{not json');
    expect(getStats('strategy')).toEqual({ correct: 0, total: 0 });
  });

  it('rejects nonsense values rather than trusting them', () => {
    const s = installStorage();
    s.setItem('bj:strategy', JSON.stringify({ correct: -5, total: 10 }));
    expect(getStats('strategy')).toEqual({ correct: 0, total: 0 });

    s.setItem('bj:strategy', JSON.stringify({ correct: 'x', total: 'y' }));
    expect(getStats('strategy')).toEqual({ correct: 0, total: 0 });
  });

  it('never reports more correct than total', () => {
    const s = installStorage();
    s.setItem('bj:strategy', JSON.stringify({ correct: 99, total: 10 }));
    expect(getStats('strategy')).toEqual({ correct: 10, total: 10 });
  });

  it('is safe when there is no window at all (SSR)', () => {
    vi.stubGlobal('window', undefined);
    expect(() => getStats('strategy')).not.toThrow();
    expect(getStats('strategy')).toEqual({ correct: 0, total: 0 });
    expect(() => logResult('strategy', true)).not.toThrow();
    expect(() => clearStats()).not.toThrow();
  });

  it('keeps playing when storage throws (quota or private mode)', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => { throw new Error('denied'); },
        setItem: () => { throw new Error('quota'); },
        removeItem: () => { throw new Error('denied'); },
      } as unknown as Storage,
    });
    expect(getStats('strategy')).toEqual({ correct: 0, total: 0 });
    // Still returns a usable tally for this render even though it cannot persist.
    expect(logResult('strategy', true)).toEqual({ correct: 1, total: 1 });
    expect(() => clearStats()).not.toThrow();
  });
});

describe('accuracy', () => {
  it('is null before any decisions, avoiding a 0/0 divide', () => {
    expect(accuracy({ correct: 0, total: 0 })).toBeNull();
  });

  it('is a ratio otherwise', () => {
    expect(accuracy({ correct: 3, total: 4 })).toBe(0.75);
  });
});
