'use client';

import { useReducer, useCallback, useEffect } from 'react';
import { reducer, initialState } from './reducer';
import { SPEED_MS, type Config, type Mode, type GameState, type GameAction, type Action } from './types';

/**
 * Wraps the reducer with the things a reducer must not do: timers and config
 * plumbing. The reducer stays a pure function of (state, action).
 */
export function useGame(mode: Mode, config: Config) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => initialState(mode, config),
  );

  /**
   * useReducer's initializer runs once, on mount. useSearchParams IS populated
   * by then for a client component inside Suspense, so the config is correct
   * from the start and needs no re-application.
   *
   * Re-configuring from an effect is deliberately avoided: CONFIGURE rebuilds
   * the whole state (resetting the bankroll and the shoe), so any instability
   * in the config's identity turns into an endless reset loop that prevents
   * the page from ever settling.
   */

  const delay = SPEED_MS[state.config.speed];

  /**
   * Drives the non-interactive phases forward on a timer.
   *
   * The dealing phase ticks once per card: the reducer holds a queue and
   * places exactly one card per DEAL_CARD, so the table fills at a watchable
   * pace rather than all at once.
   *
   * `step` increments on every state change the timer cares about, giving the
   * effect a dependency that is stable when nothing happened but changes for
   * each dealt card. Depending on `state` itself re-arms on unrelated updates;
   * depending on phase alone stalls when a phase repeats.
   */
  // A plain value, derived from state - no ref mutation during render, which
  // is an anti-pattern and misbehaves under StrictMode's double-invoke.
  /**
   * Changes whenever there is more work to animate.
   *
   * The card count matters: during seatsTurn and dealerTurn the phase, queue
   * and hand number all stay put between steps, so without it the effect would
   * not re-fire and the play-out would stall after a single card.
   */
  const cardsOnTable =
    state.seats.reduce((n, s) => n + s.hands.reduce((m, h) => m + h.cards.length, 0), 0) +
    state.playerHands.reduce((n, h) => n + h.cards.length, 0) +
    state.dealerHand.cards.length;

  const tick = [
    state.phase,
    state.dealQueue.length,
    state.handsPlayed,
    cardsOnTable,
    // Stands and the hole-card reveal advance play without dealing a card.
    state.holeCardRevealed,
    state.seats.reduce((n, s) => n + s.hands.filter((h) => h.status === 'active').length, 0),
    state.playerHands.filter((h) => h.status === 'active').length,
  ].join(':');

  useEffect(() => {
    const next: GameAction | null =
      state.phase === 'dealing'    ? { type: 'DEAL_CARD' }   :
      state.phase === 'seatsTurn'  ? { type: 'PLAY_SEATS' }  :
      state.phase === 'dealerTurn' ? { type: 'DEALER_PLAY' } :
      state.phase === 'settlement' ? { type: 'SETTLE' }      :
      null;

    if (!next) return;

    // Exactly one timer outstanding; the cleanup cancels it so StrictMode's
    // double-invoke cannot leave two chains running at different rates.
    const t = setTimeout(() => dispatch(next), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, delay]);

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
