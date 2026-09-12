'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { DEFAULT_CONFIG, type Config, type Speed } from './types';

const SPEEDS: Speed[] = ['slow', 'medium', 'fast'];

function clamp(n: number, lo: number, hi: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
}

/**
 * Reads table config from the query string, clamping everything to its legal
 * range - the URL is user-editable, so values cannot be trusted.
 */
export function useConfig(): Config {
  const params = useSearchParams();

  return useMemo(() => {
    const speed = params.get('speed') as Speed | null;
    return {
      numDecks: clamp(Number(params.get('decks')), 1, 8, DEFAULT_CONFIG.numDecks),
      numOtherPlayers: clamp(Number(params.get('players')), 2, 7, DEFAULT_CONFIG.numOtherPlayers),
      speed: speed && SPEEDS.includes(speed) ? speed : DEFAULT_CONFIG.speed,
    };
  }, [params]);
}
