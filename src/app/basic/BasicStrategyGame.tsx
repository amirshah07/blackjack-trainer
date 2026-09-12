'use client';

import { useEffect, useState, useCallback } from 'react';
import { useGame } from '@/game/useGame';
import { useConfig } from '@/game/useConfig';
import { legalActions, canDeal } from '@/game/selectors';
import { getStats, logResult, clearStats, type Tally } from '@/storage/session';
import { Table } from '@/components/Table';
import { ActionBar } from '@/components/ActionBar';
import { Toast } from '@/components/Toast';
import { StatsPanel } from '@/components/StatsPanel';
import { TableFrame } from '@/components/TableFrame';
import type { Action } from '@/game/types';

const ACTION_NAME: Record<Action, string> = {
  hit: 'hit',
  stand: 'stand',
  double: 'double',
  split: 'split',
};

export function BasicStrategyGame() {
  const config = useConfig();
  const game = useGame('basic', config);
  const { state } = game;

  const [tally, setTally] = useState<Tally>({ correct: 0, total: 0 });
  // sessionStorage is unavailable during SSR, so the first read happens here.
  useEffect(() => setTally(getStats('strategy')), []);

  const decision = state.lastDecision;

  // Log each decision exactly once, keyed on the decision object identity.
  useEffect(() => {
    if (!decision) return;
    setTally(logResult('strategy', decision.wasCorrect));
  }, [decision]);

  const legal = legalActions(state);
  const dealable = canDeal(state);


  const act = useCallback(
    (action: Action) => {
      if (legal[action]) game.act(action);
    },
    [legal, game],
  );

  // Keyboard shortcuts: H/S/D/P to act, Space/Enter to deal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'h') act('hit');
      else if (k === 's') act('stand');
      else if (k === 'd') act('double');
      else if (k === 'p') act('split');
      else if ((k === ' ' || k === 'enter') && dealable) {
        e.preventDefault();
        game.newHand();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, dealable, game]);

  const handleReset = useCallback(() => {
    clearStats('strategy');
    setTally({ correct: 0, total: 0 });
  }, []);

  return (
    <TableFrame
      title="Basic Strategy"
      aside={
        <StatsPanel tally={tally} label="Correct decisions" onReset={handleReset} />
      }
    >
      <Table state={state} />

      <div className="flex min-h-[4.5rem] flex-col items-center justify-center gap-3">
        {state.phase === 'playerTurn' ? (
          <ActionBar legal={legal} onAction={act} />
        ) : dealable ? (
          <button
            onClick={game.newHand}
            className="rounded-xl bg-emerald-500 px-8 py-3 text-lg font-semibold text-slate-900 shadow-lg transition hover:bg-emerald-400"
          >
            Deal
          </button>
        ) : (
          <p className="text-sm text-white/40">
            {state.phase === 'dealerTurn' ? 'Dealer playing…' : 'Dealing…'}
          </p>
        )}

        <p className="text-xs text-white/30">
          H hit · S stand · D double · P split · Space deal
        </p>
      </div>

      {decision && (
        <Toast
          kind={decision.wasCorrect ? 'correct' : 'wrong'}
          title={
            decision.wasCorrect
              ? 'Correct'
              : `Wrong — correct play was ${ACTION_NAME[decision.correct]}`
          }
          onDismiss={game.dismissDecision}
        />
      )}
    </TableFrame>
  );
}
