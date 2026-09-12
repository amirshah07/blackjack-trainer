'use client';

import type { Action } from '@/game/types';

export type ActionBarProps = {
  legal: Record<Action, boolean>;
  onAction: (action: Action) => void;
  disabled?: boolean;
};

/** Hit, stand, double, split. No surrender - it is not a legal action here. */
const BUTTONS: { action: Action; label: string; key: string; tone: string }[] = [
  { action: 'hit',    label: 'Hit',    key: 'H', tone: 'bg-emerald-600 hover:bg-emerald-500' },
  { action: 'stand',  label: 'Stand',  key: 'S', tone: 'bg-rose-600 hover:bg-rose-500' },
  { action: 'double', label: 'Double', key: 'D', tone: 'bg-amber-500 hover:bg-amber-400 text-slate-900' },
  { action: 'split',  label: 'Split',  key: 'P', tone: 'bg-blue-600 hover:bg-blue-500' },
];

export function ActionBar({ legal, onAction, disabled = false }: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {BUTTONS.map(({ action, label, key, tone }) => {
        const enabled = legal[action] && !disabled;
        return (
          <button
            key={action}
            onClick={() => enabled && onAction(action)}
            disabled={!enabled}
            aria-keyshortcuts={key}
            className={[
              'min-w-[5.5rem] rounded-lg px-4 py-2.5 font-semibold text-white shadow-lg transition',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              enabled ? tone : 'cursor-not-allowed bg-slate-700/60 text-white/35',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
