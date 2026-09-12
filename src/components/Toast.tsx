'use client';

import { useEffect } from 'react';

export type ToastProps = {
  kind: 'correct' | 'wrong';
  title: string;
  /** Optional breakdown lines - used for the count reveal. */
  detail?: string;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. Wrong answers linger so they can be read. */
  duration?: number;
};

/**
 * Non-blocking, auto-dismissing feedback. Never gates interaction - the user
 * can keep playing while it is on screen.
 */
export function Toast({ kind, title, detail, onDismiss, duration }: ToastProps) {
  const ms = duration ?? (kind === 'wrong' ? 4200 : 1600);

  useEffect(() => {
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [onDismiss, ms, title, detail]);

  const correct = kind === 'correct';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-6 z-50 w-[min(92vw,26rem)] -translate-x-1/2"
    >
      <div
        className={[
          'toast-in pointer-events-auto rounded-xl px-4 py-3 shadow-2xl ring-1 backdrop-blur',
          correct
            ? 'bg-emerald-600/95 text-white ring-emerald-300/40'
            : 'bg-rose-700/95 text-white ring-rose-300/40',
        ].join(' ')}
      >
        <div className="flex items-start gap-2.5">
          <span aria-hidden className="mt-0.5 text-lg leading-none">
            {correct ? '✓' : '✕'}
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{title}</p>
            {detail && (
              <p className="mt-1 text-sm leading-snug text-white/90">{detail}</p>
            )}
          </div>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="ml-auto rounded p-0.5 text-white/70 transition hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
