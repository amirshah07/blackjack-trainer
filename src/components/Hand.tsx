'use client';

import { Card } from './Card';
import type { Hand as HandType } from '@/game/types';

export type HandProps = {
  hand: HandType;
  /** Hides the second card (the dealer's hole card) until reveal. */
  hideSecond?: boolean;
  /** Total to display. Computed by the caller so this stays domain-free. */
  label?: string;
  active?: boolean;
  size?: 'sm' | 'md';
  outcomeLabel?: string;
};

const OUTCOME_STYLE: Record<string, string> = {
  win: 'bg-emerald-500/90 text-white',
  blackjack: 'bg-amber-400/95 text-slate-900',
  lose: 'bg-rose-600/90 text-white',
  push: 'bg-slate-400/90 text-slate-900',
};

export function Hand({
  hand, hideSecond = false, label, active = false, size = 'md', outcomeLabel,
}: HandProps) {
  return (
    <div
      className={[
        'flex flex-col items-center gap-1.5 rounded-xl px-2 py-1.5 transition-all',
        active ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-felt-dark' : '',
      ].join(' ')}
    >
      <div className="flex -space-x-2.5">
        {hand.cards.map((card, i) => (
          <Card
            key={card.id}
            card={card}
            index={i}
            size={size}
            faceDown={hideSecond && i === 1}
          />
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {label && (
          <span className="rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
            {label}
          </span>
        )}
        {hand.outcome && outcomeLabel && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${OUTCOME_STYLE[hand.outcome] ?? ''}`}>
            {outcomeLabel}
          </span>
        )}
      </div>
    </div>
  );
}
