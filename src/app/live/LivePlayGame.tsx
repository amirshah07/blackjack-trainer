'use client';

import { useEffect, useCallback, useState } from 'react';
import { useGame } from '@/game/useGame';
import { useConfig } from '@/game/useConfig';
import { legalActions, canDeal } from '@/game/selectors';
import { DENOMINATIONS } from '@/game/chips';
import { MIN_BET, STARTING_BANKROLL, type Action } from '@/game/types';
import { Table } from '@/components/Table';
import { ActionBar } from '@/components/ActionBar';
import { TableFrame } from '@/components/TableFrame';
import { StrategyChart } from '@/components/StrategyChart';
import { ChartButton } from '@/components/ChartButton';
import { Chip } from '@/components/Chip';
import { ChipStack, BetCircle } from '@/components/ChipStack';

/**
 * Live Play is a sandbox, by design: free betting with no evaluation, no
 * strategy feedback, no count check-ins, and nothing written to storage.
 * Deliberately imports neither Toast nor StatsPanel.
 */
export function LivePlayGame() {
  const config = useConfig();
  const game = useGame('live', config);
  const { state } = game;

  const [chartOpen, setChartOpen] = useState(false);

  const legal = legalActions(state);
  const dealable = canDeal(state);
  const betting = state.phase === 'betting' || state.phase === 'resolved';

  const act = useCallback(
    (action: Action) => {
      if (legal[action]) game.act(action);
    },
    [legal, game],
  );

  // Keyboard shortcuts, matching Basic Strategy.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'h') act('hit');
      else if (k === 's') act('stand');
      else if (k === 'd') act('double');
      else if (k === 'p') act('split');
      else if (k === 'c') setChartOpen((v) => !v);
      else if (k === 'escape') setChartOpen(false);
      else if ((k === ' ' || k === 'enter') && dealable) {
        e.preventDefault();
        game.newHand();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, dealable, game]);

  if (state.busted) {
    return (
      <TableFrame title="Live Play">
        <div className="mx-auto mt-16 max-w-sm rounded-2xl bg-black/30 p-8 text-center ring-1 ring-white/10">
          <h2 className="text-xl font-semibold">Out of chips</h2>
          <p className="mt-2 text-sm text-white/60">
            Your bankroll dropped below the ${MIN_BET} minimum bet.
          </p>
          <button
            onClick={game.reset}
            className="mt-6 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-slate-900 transition hover:bg-emerald-400"
          >
            Start a new session
          </button>
        </div>
      </TableFrame>
    );
  }

  return (
    <TableFrame
      title="Live Play"
      aside={<ChartButton onClick={() => setChartOpen(true)} />}
    >
      <Table state={state} betSlot={<BetCircle amount={state.currentBet} />} />

      <div className="flex min-h-[7rem] flex-col items-center justify-center gap-3">
        {state.phase === 'playerTurn' ? (
          <ActionBar legal={legal} onAction={act} />
        ) : betting ? (
          <>
            <div className="flex items-end gap-8">
              <ChipStack amount={state.bankroll} label="Bankroll" />

              <div className="flex items-center gap-3 pb-6">
                {DENOMINATIONS.map((d) => (
                  <Chip
                    key={d}
                    value={d}
                    onClick={() => game.placeBet(d)}
                    disabled={state.bankroll < d}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={game.clearBet}
                disabled={state.currentBet === 0}
                className="rounded-lg px-3 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                Clear
              </button>
              <button
                onClick={game.newHand}
                disabled={!dealable}
                className="rounded-xl bg-emerald-500 px-8 py-3 text-lg font-semibold text-slate-900 shadow-lg transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/40"
              >
                Deal
              </button>
            </div>

            {state.currentBet < MIN_BET && (
              <p className="text-xs text-white/35">
                Minimum bet ${MIN_BET}. Bankroll started at ${STARTING_BANKROLL.toLocaleString()}.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-white/40">
            {state.phase === 'dealerTurn' ? 'Dealer playing…' : 'Dealing…'}
          </p>
        )}

        <p className="text-xs text-white/30">
          H hit · S stand · D double · P split · Space deal · C chart
        </p>
      </div>
      {chartOpen && <StrategyChart onClose={() => setChartOpen(false)} />}
    </TableFrame>
  );
}
