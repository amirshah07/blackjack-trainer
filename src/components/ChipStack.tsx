'use client';

import { Chip } from './Chip';
import { toChips } from '@/game/chips';

export type ChipStackProps = {
  amount: number;
  label: string;
  /** Stacks vertically (bankroll) or fans horizontally (bet circle). */
  layout?: 'stack' | 'fan';
};

export function ChipStack({ amount, label, layout = 'stack' }: ChipStackProps) {
  const chips = toChips(amount);

  return (
    <div className="flex flex-col items-center gap-1.5">
      {chips.length > 0 && (
        <div
          className={layout === 'stack' ? 'relative w-11' : 'flex -space-x-5'}
          // A stack is absolutely positioned, so it needs an explicit height:
          // the top chip's offset plus one chip.
          style={layout === 'stack' ? { height: (chips.length - 1) * 7 + 44 } : undefined}
        >
          {chips.map((c, i) =>
            layout === 'stack' ? (
              <div
                key={i}
                className="absolute left-0"
                style={{ bottom: `${i * 7}px`, zIndex: i }}
              >
                <Chip value={c} size={44} index={i} />
              </div>
            ) : (
              <Chip key={i} value={c} size={38} index={i} />
            ),
          )}
        </div>
      )}
      <p className="text-[0.65rem] uppercase tracking-widest text-white/50">{label}</p>
      <p className="font-semibold tabular-nums text-white">${amount.toLocaleString()}</p>
    </div>
  );
}

/** The felt circle a bet is placed into. */
export function BetCircle({ amount }: { amount: number }) {
  return (
    <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-dashed border-amber-200/30">
      {amount > 0 ? (
        <>
          <div className="flex -space-x-5">
            {toChips(amount, 6).map((c, i) => (
              <Chip key={i} value={c} size={34} index={i} />
            ))}
          </div>
          <p className="mt-1 text-xs font-semibold tabular-nums text-amber-100">
            ${amount}
          </p>
        </>
      ) : (
        <p className="text-[0.6rem] uppercase tracking-widest text-white/25">Bet</p>
      )}
    </div>
  );
}
