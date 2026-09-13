'use client';

import { Hand } from './Hand';
import { handLabel, dealerVisibleLabel, OUTCOME_LABEL } from '@/game/selectors';
import type { GameState } from '@/game/types';

export type TableProps = {
  state: GameState;
  /** Live mode renders chips into the bet circle; other modes pass nothing. */
  betSlot?: React.ReactNode;
};

/**
 * The felt. Dealer at the top, auto-played seats arcing along the sides, the
 * user at the bottom centre.
 */
export function Table({ state, betSlot }: TableProps) {
  const { seats, dealerHand, playerHands, activeHandIndex, phase } = state;

  // Split the other seats either side of the user for a table-like arc.
  const mid = Math.ceil(seats.length / 2);
  const left = seats.slice(0, mid);
  const right = seats.slice(mid);

  /**
   * Cards shrink as the table fills up.
   *
   * The page is exactly viewport height, so a crowded table has to fit by
   * scaling rather than by pushing the controls off screen. Seven seats plus
   * splits is the worst case.
   */
  const crowded = seats.length >= 5;
  const seatSize = crowded ? 'xs' : 'sm';
  const heroSize = crowded ? 'sm' : 'md';

  const showDealerLabel = dealerHand.cards.length > 0;

  return (
    /*
      The felt scrolls internally as a last resort: the page itself never
      scrolls, so an unusually tall hand (many splits at a full table) stays
      reachable without pushing the controls off screen.
    */
    <div className="relative mx-auto flex h-full max-h-full w-full max-w-5xl flex-col overflow-y-auto rounded-[2rem] bg-felt px-4 py-4 shadow-2xl ring-1 ring-emerald-900/40 sm:px-8">
      {/* felt texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 0%, #fff 0%, transparent 60%)',
        }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
        {/* Dealer */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-emerald-100/70">
            Dealer
          </span>
          {dealerHand.cards.length > 0 ? (
            <Hand
              hand={dealerHand}
              hideSecond={!state.holeCardRevealed}
              label={showDealerLabel ? dealerVisibleLabel(state) : ''}
              size={heroSize}
              outcomeLabel=""
            />
          ) : (
            <EmptySeat />
          )}
        </div>

        {/* Other seats */}
        {seats.length > 0 && (
          <div className="flex w-full flex-wrap items-start justify-center gap-x-8 gap-y-4">
            {[...left, ...right].map((seat) => (
              <div key={seat.id} className="flex flex-col items-center gap-1 opacity-80">
                <span className="text-[0.65rem] uppercase tracking-wider text-emerald-100/50">
                  Seat {seat.id + 1}
                </span>
                {seat.hands.length > 0 ? (
                  <div className="flex gap-2">
                    {seat.hands.map((h, i) => (
                      <Hand key={i} hand={h} label={handLabel(h)} size={seatSize} />
                    ))}
                  </div>
                ) : (
                  <EmptySeat small />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bet circle */}
        {betSlot && <div className="flex min-h-[3.5rem] items-center">{betSlot}</div>}

        {/* User */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-amber-200/80">
            You
          </span>
          {playerHands.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-3">
              {playerHands.map((h, i) => (
                <Hand
                  key={i}
                  hand={h}
                  label={handLabel(h)}
                  size={heroSize}
                  active={phase === 'playerTurn' && i === activeHandIndex && playerHands.length > 1}
                  outcomeLabel={h.outcome ? OUTCOME_LABEL[h.outcome] : undefined}
                />
              ))}
            </div>
          ) : (
            <EmptySeat />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptySeat({ small = false }: { small?: boolean }) {
  return (
    <div
      className={[
        'rounded-xl border-2 border-dashed border-emerald-200/15',
        small ? 'h-[68px] w-12' : 'h-[90px] w-16',
      ].join(' ')}
    />
  );
}
