'use client';

import type { Tally } from '@/storage/session';

export type StatsPanelProps = {
  tally: Tally;
  label: string;
  onReset?: () => void;
};

/** A single running figure: correct out of total. No breakdown, by design. */
export function StatsPanel({ tally, label, onReset }: StatsPanelProps) {
  const pct = tally.total === 0 ? null : Math.round((tally.correct / tally.total) * 100);

  return (
    <div className="flex items-center gap-3 rounded-xl bg-black/30 px-4 py-2.5 ring-1 ring-white/10">
      <div>
        <p className="text-[0.65rem] uppercase tracking-widest text-white/50">{label}</p>
        <p className="font-semibold tabular-nums text-white">
          {tally.correct} <span className="text-white/40">/</span> {tally.total}
          {pct !== null && (
            <span className="ml-2 text-sm font-normal text-white/60">{pct}%</span>
          )}
        </p>
      </div>
      {onReset && tally.total > 0 && (
        <button
          onClick={onReset}
          className="ml-auto rounded-md px-2 py-1 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          Reset
        </button>
      )}
    </div>
  );
}
