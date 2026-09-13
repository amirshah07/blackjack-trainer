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
          className={layout === 'stack' ? 'relative w-9' : 'flex -space-x-5'}
          /*
            A stack is absolutely positioned, so it needs an explicit height.
            Kept compact - a tall stack otherwise overlaps the felt above it
            now that the page is exactly viewport height.
          */
          style={
            layout === 'stack'
              ? { height: (chips.length - 1) * 4 + 34 }
              : undefined
          }
        >
          {chips.map((c, i) =>
            layout === 'stack' ? (
              <div
                key={`${i}-${c}`}
                className="absolute left-0"
                style={{ bottom: `${i * 4}px`, zIndex: i }}
              >
                <Chip value={c} size={34} index={0} />
              </div>
            ) : (
              <Chip key={`${i}-${c}`} value={c} size={38} index={0} />
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
  const chips = toChips(amount, 999);

  return (
    <div className="flex h-28 w-32 flex-col items-center justify-center rounded-full border-2 border-dashed border-amber-200/30">
      {amount > 0 ? (
        <>
          {/*
            No disc cap: truncating the stack makes the felt show less than the
            bet beside it ($205 drawn as six discs reads $195). Larger stacks
            overlap more tightly instead, so they stay inside the circle.
          */}
          <div className={chips.length > 5 ? 'flex -space-x-4' : 'flex -space-x-3'}>
            {chips.map((c, i) => (
              // index={0} everywhere: the bet responds to a click, so no chip
              // should wait its turn to become visible. The key includes the
              // value so a chip only re-animates when it genuinely changes.
              <Chip
                key={`${i}-${c}`}
                value={c}
                size={chips.length > 5 ? 26 : 32}
                index={0}
              />
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
