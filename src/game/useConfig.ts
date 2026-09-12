'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { parseConfig } from './config';
import type { Config } from './types';

/** Reads table config from the query string. See parseConfig for the rules. */
export function useConfig(): Config {
  const params = useSearchParams();

  return useMemo(
    () =>
      parseConfig({
        decks: params.get('decks'),
        players: params.get('players'),
        speed: params.get('speed'),
      }),
    [params],
  );
}
