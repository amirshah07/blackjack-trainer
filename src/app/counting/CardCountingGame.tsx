'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useGame } from '@/game/useGame';
import { useConfig } from '@/game/useConfig';
import { getStats, logResult, clearStats, type Tally } from '@/storage/session';
import { Table } from '@/components/Table';
import { Toast } from '@/components/Toast';
import { StatsPanel } from '@/components/StatsPanel';
import { TableFrame } from '@/components/TableFrame';
import { CountCheckModal } from '@/components/CountCheckModal';
import { BETWEEN_HANDS_MS } from '@/game/types';

export function CardCountingGame() {
  const config = useConfig();
  const game = useGame('counting', config);
  const { state } = game;

  const [tally, setTally] = useState<Tally>({ correct: 0, total: 0 });
  const [running, setRunning] = useState(false);
  useEffect(() => setTally(getStats('counting')), []);

  const check = state.lastCountCheck;

  // Log each check exactly once, keyed on the check object identity.
  useEffect(() => {
    if (!check) return;
    setTally(logResult('counting', check.wasCorrect));
  }, [check]);

  /**
   * Auto-deal loop. The drill runs continuously: each hand's cards go out one
   * at a time (paced by useGame), and this just starts the next hand after a
   * short breather.
   */
  /**
   * `game` is a fresh object every render, so it must not be an effect
   * dependency - the timer would be cleared and re-armed on every render and
   * never fire cleanly. Hold the current newHand in a ref instead.
   */
  const newHand = game.newHand;
  const newHandRef = useRef(newHand);
  useEffect(() => { newHandRef.current = newHand; }, [newHand]);

  useEffect(() => {
    if (!running) return;
    // Only start the next hand from a terminal phase; useGame drives the
    // dealing/seats/dealer/settlement steps on its own timer.
    const terminal = state.phase === 'idle' || state.phase === 'resolved';
    if (!terminal) return;

    const t = setTimeout(() => newHandRef.current(), BETWEEN_HANDS_MS);
    return () => clearTimeout(t);
  }, [running, state.phase, state.handsPlayed]);

  // A check-in interrupts the loop until it is answered.
  const paused = state.phase === 'countCheck';

  const handleSubmit = useCallback(
    (guess: number) => game.submitCount(guess),
    [game],
  );

  const handleReset = useCallback(() => {
    clearStats('counting');
    setTally({ correct: 0, total: 0 });
  }, []);

  return (
    <TableFrame
      title="Card Counting"
      aside={<StatsPanel tally={tally} label="Correct counts" onReset={handleReset} />}
    >
      <Table state={state} />

      <div className="flex min-h-[4.5rem] flex-col items-center justify-center gap-3">
        <button
          onClick={() => setRunning((r) => !r)}
          className={[
            'rounded-xl px-8 py-3 text-lg font-semibold shadow-lg transition',
            running
              ? 'bg-rose-600 text-white hover:bg-rose-500'
              : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400',
          ].join(' ')}
        >
          {running ? 'Pause' : state.handsPlayed > 0 ? 'Resume' : 'Start drill'}
        </button>

        <p className="text-xs text-white/30">
          Hands dealt: <span className="tabular-nums">{state.handsPlayed}</span>
          {' · '}
          Keep the running count yourself — it is never shown.
        </p>
      </div>

      {paused && <CountCheckModal onSubmit={handleSubmit} />}

      {check && (
        <Toast
          kind={check.wasCorrect ? 'correct' : 'wrong'}
          title={
            check.wasCorrect
              ? `Correct — true count is ${check.actual}`
              : `Wrong — true count is ${check.actual}, you said ${check.guess}`
          }
          detail={
            check.wasCorrect
              ? undefined
              : `Running count is ${check.running}, decks remaining is ${check.decksRemaining}, so true count is ${check.actual}.`
          }
          onDismiss={game.dismissCountCheck}
        />
      )}
    </TableFrame>
  );
}
