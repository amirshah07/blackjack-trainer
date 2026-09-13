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
import { DiscardTray } from '@/components/DiscardTray';
import { BETWEEN_HANDS_MS } from '@/game/types';

export function CardCountingGame() {
  const config = useConfig();
  const game = useGame('counting', config);
  const { state } = game;

  const [tally, setTally] = useState<Tally>({ correct: 0, total: 0 });
  const [running, setRunning] = useState(false);
  useEffect(() => setTally(getStats('counting')), []);

  const check = state.lastCountCheck;

  /**
   * The tray shows SETTLED cards only, never the hand in progress.
   *
   * A dealer sweeps the round into the tray after the hand is paid, so cards
   * still on the felt are not in it yet. Using live shoe depth instead would
   * also leak the hand in progress: the bar would creep up as each card came
   * out, and a check-in landing mid-hand would reflect a half-played round
   * rather than a clean shoe position.
   */
  const totalCards = state.config.numDecks * 52;
  const cardsDiscarded = state.discardCount;

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

    /**
     * Hold the table while a WRONG reveal is on screen.
     *
     * The breakdown is there to be studied, and cards flowing behind it both
     * distract from the reading and push the count on before the user has
     * finished with the last one. Dealing resumes the moment it is dismissed.
     *
     * A correct answer is a glance and clears itself, so it does not stall
     * the drill.
     */
    if (check && !check.wasCorrect) return;

    // Only start the next hand from a terminal phase; useGame drives the
    // dealing/seats/dealer/settlement steps on its own timer.
    const terminal = state.phase === 'idle' || state.phase === 'resolved';
    if (!terminal) return;

    const t = setTimeout(() => newHandRef.current(), BETWEEN_HANDS_MS);
    return () => clearTimeout(t);
  }, [running, state.phase, state.handsPlayed, check]);

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
      <div className="flex min-h-0 flex-1 items-stretch justify-center gap-4">
        <div className="flex min-h-0 min-w-0 flex-1">
          <Table state={state} />
        </div>
        {/*
          Shoe depth has to be visible somewhere, or "running count / decks
          remaining" asks the user to divide by a number they cannot know.
          The tray shows it the way a table does - by eye, no figures.
        */}
        <div className="shrink-0 pt-6">
          <DiscardTray dealt={cardsDiscarded} total={totalCards} />
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center justify-center gap-2 pb-1">
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
              ? check.guess === check.actual
                ? `Correct — true count is ${check.actual}`
                : `Close enough — true count is ${check.actual}, you said ${check.guess}`
              : `Wrong — true count is ${check.actual}, you said ${check.guess}`
          }
          detail={
            check.wasCorrect
              ? undefined
              : `Running count is ${check.running}, decks remaining is ${check.decksRemaining}, so true count is ${check.actual}.`
          }
          /*
           * A wrong count stays up until dismissed. The breakdown is three
           * numbers and a conclusion to work through, and the drill keeps
           * dealing behind it - any fixed timeout either cuts off a careful
           * reader or outstays a quick one. Correct answers are a glance, so
           * they still clear themselves.
           */
          duration={check.wasCorrect ? 3500 : null}
          onDismiss={game.dismissCountCheck}
        />
      )}
    </TableFrame>
  );
}
