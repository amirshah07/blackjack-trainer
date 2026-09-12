/**
 * The only module that touches sessionStorage.
 *
 * sessionStorage (not localStorage) is deliberate: progress lasts for the tab
 * session and clears on close, so there is nothing to clean up and no stale
 * history to explain away.
 */

export type StatKey = 'strategy' | 'counting';

export type Tally = { correct: number; total: number };

const KEYS: Record<StatKey, string> = {
  strategy: 'bj:strategy',
  counting: 'bj:counting',
};

const EMPTY: Tally = { correct: 0, total: 0 };

/** SSR-safe: Next renders these pages on the server, where there is no window. */
function available(): boolean {
  return typeof window !== 'undefined' && !!window.sessionStorage;
}

export function getStats(key: StatKey): Tally {
  if (!available()) return { ...EMPTY };
  try {
    const raw = window.sessionStorage.getItem(KEYS[key]);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<Tally>;
    // Guard against hand-edited or corrupted values.
    const correct = Number(parsed.correct);
    const total = Number(parsed.total);
    if (!Number.isFinite(correct) || !Number.isFinite(total) || total < 0 || correct < 0) {
      return { ...EMPTY };
    }
    return { correct: Math.min(correct, total), total };
  } catch {
    return { ...EMPTY };
  }
}

export function logResult(key: StatKey, wasCorrect: boolean): Tally {
  const current = getStats(key);
  const next: Tally = {
    correct: current.correct + (wasCorrect ? 1 : 0),
    total: current.total + 1,
  };
  if (available()) {
    try {
      window.sessionStorage.setItem(KEYS[key], JSON.stringify(next));
    } catch {
      // Quota or private-mode failure: the tally is still returned for this
      // render, it just will not survive a reload. Not worth interrupting play.
    }
  }
  return next;
}

export function clearStats(key?: StatKey): void {
  if (!available()) return;
  try {
    if (key) window.sessionStorage.removeItem(KEYS[key]);
    else Object.values(KEYS).forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function accuracy(tally: Tally): number | null {
  return tally.total === 0 ? null : tally.correct / tally.total;
}
