import { DEFAULT_CONFIG, type Config, type Speed } from './types';

const SPEEDS: Speed[] = ['slow', 'medium', 'fast'];

/**
 * Parses one numeric param.
 *
 * Note the empty/null check: Number(null) and Number('') are both 0, which is
 * finite, so without it a missing param would silently clamp to the range
 * minimum (1 deck, 2 players) instead of falling back to the default.
 */
function num(raw: string | null | undefined, lo: number, hi: number, fallback: number): number {
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/**
 * Builds a table config from raw query-string values.
 *
 * The URL is user-editable, so nothing here is trusted: out-of-range,
 * fractional, missing and nonsense values all resolve to something legal
 * rather than producing a broken table.
 */
export function parseConfig(raw: {
  decks?: string | null;
  players?: string | null;
  speed?: string | null;
}): Config {
  const speed = raw.speed as Speed | null | undefined;
  return {
    numDecks: num(raw.decks, 1, 8, DEFAULT_CONFIG.numDecks),
    numOtherPlayers: num(raw.players, 2, 7, DEFAULT_CONFIG.numOtherPlayers),
    speed: speed && SPEEDS.includes(speed) ? speed : DEFAULT_CONFIG.speed,
  };
}
