'use client';

import { useReducer, useCallback, useEffect, useRef } from 'react';
import { reducer, initialState } from './reducer';
import { SPEED_MS, type Config, type Mode, type GameState, type Action } from './types';

/**
 * Wraps the reducer with the things a reducer must not do: timers and
 * storage. The reducer stays a pure function of (state, action).
 *
 * Phase advance is driven here - after the player finishes, the seats, dealer
 * and settlement steps fire on a delay so the table animates rather than
 * resolving instantly.
 */
export function useGame(mode: Mode, config: Config) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => initialState(mode, config),
  );

  const delay = SPEED_MS[state.config.speed];
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  // Drive the non-interactive phases forward on a timer.
  useEffect(() => {
    if (state.phase === 'seatsTurn') {
      schedule(() => dispatch({ type: 'PLAY_SEATS' }), delay);
    } else if (state.phase === 'dealerTurn') {
      schedule(() => dispatch({ type: 'DEALER_PLAY' }), delay);
    } else if (state.phase === 'settlement') {
      schedule(() => dispatch({ type: 'SETTLE' }), delay);
    }
  }, [state.phase, delay, schedule]);

  // Drop pending timers on unmount so a stale dispatch can't fire.
  useEffect(() => clearTimers, [clearTimers]);

  const api = {
    newHand: useCallback(() => dispatch({ type: 'NEW_HAND' }), []),
    act: useCallback((action: Action) => dispatch({ type: 'PLAYER_ACTION', action }), []),
    placeBet: useCallback((amount: number) => dispatch({ type: 'PLACE_BET', amount }), []),
    clearBet: useCallback(() => dispatch({ type: 'CLEAR_BET' }), []),
    submitCount: useCallback((guess: number) => dispatch({ type: 'SUBMIT_COUNT', guess }), []),
    dismissDecision: useCallback(() => dispatch({ type: 'DISMISS_DECISION' }), []),
    dismissCountCheck: useCallback(() => dispatch({ type: 'DISMISS_COUNT_CHECK' }), []),
    reset: useCallback(() => dispatch({ type: 'RESET_SESSION' }), []),
  };

  return { state, ...api };
}

export type { GameState };
