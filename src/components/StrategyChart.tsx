'use client';

/**
 * The basic strategy chart overlay.
 *
 * This is the ONE component allowed to import from domain/ (see the ESLint
 * allowlist). It renders the very lookup tables the evaluator consults, so a
 * change to the strategy can never leave the on-screen chart out of date -
 * there is no second copy to forget.
 */
import {
  UPCARDS, ACTION_COLOURS, ACTION_LABELS,
  type Action, type Upcard,
} from '@/domain/strategy';
import { hardRows, softRows, pairRows, type ChartRow } from '@/domain/chart-rows';

function upcardLabel(u: Upcard): string {
  return u === 11 ? 'A' : String(u);
}

export function StrategyChart({ onClose }: { onClose: () => void }) {
  const sections: { title: string; rows: ChartRow[] }[] = [
    { title: 'Hard totals', rows: hardRows() },
    { title: 'Soft totals', rows: softRows() },
    { title: 'Pairs', rows: pairRows() },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Basic strategy chart"
    >
      <div
        className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-slate-900 p-5 shadow-2xl ring-1 ring-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex shrink-0 items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Basic strategy</h2>
            <p className="text-xs text-white/50">
              Dealer stands on soft 17 · double after split · no surrender
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chart"
            className="rounded-lg px-3 py-1.5 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-auto">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-widest text-white/45">
                {section.title}
              </h3>
              <table className="w-full border-separate border-spacing-0.5 text-center text-xs">
                <thead>
                  <tr>
                    <th className="w-16 text-[0.65rem] font-medium text-white/40">
                      Hand
                    </th>
                    {UPCARDS.map((u) => (
                      <th key={u} className="font-semibold text-white/70">
                        {upcardLabel(u)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.label}>
                      <td className="whitespace-nowrap pr-1.5 text-right text-[0.7rem] font-medium text-white/60">
                        {row.label}
                      </td>
                      {row.actions.map((a, i) => (
                        <td
                          key={i}
                          className="rounded px-1 py-1 font-bold text-white"
                          style={{ backgroundColor: ACTION_COLOURS[a] }}
                        >
                          {ACTION_LABELS[a]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>

        <footer className="mt-4 flex shrink-0 flex-wrap items-center gap-3 border-t border-white/10 pt-3">
          {(Object.keys(ACTION_COLOURS) as Action[]).map((a) => (
            <span key={a} className="flex items-center gap-1.5 text-xs text-white/60">
              <span
                className="inline-block h-3.5 w-5 rounded"
                style={{ backgroundColor: ACTION_COLOURS[a] }}
              />
              {a === 'hit' ? 'Hit' : a === 'stand' ? 'Stand' : a === 'double' ? 'Double' : 'Split'}
            </span>
          ))}
        </footer>
      </div>
    </div>
  );
}
