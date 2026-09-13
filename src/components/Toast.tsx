'use client';

import { useEffect } from 'react';

export type ToastProps = {
  kind: 'correct' | 'wrong';
  title: string;
  /** Optional breakdown lines - used for the count reveal. */
  detail?: string;
  onDismiss: () => void;
  /**
   * Auto-dismiss delay in ms. Wrong answers linger so they can be read.
   * Pass `null` to keep the toast up until it is dismissed explicitly - use
   * that for anything the user needs to study rather than glance at.
   */
  duration?: number | null;
};

/**
 * Non-blocking feedback. Never gates interaction - the user can keep playing
 * while it is on screen.
 *
 * Auto-dismisses by default; with `duration={null}` it stays until dismissed.
 */
export function Toast({ kind, title, detail, onDismiss, duration }: ToastProps) {
  const ms = duration === undefined ? (kind === 'wrong' ? 4200 : 1600) : duration;

  useEffect(() => {
    if (ms === null) return; // sticky: dismissed by the user, not a timer
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [onDismiss, ms, title, detail]);

  // Escape dismisses a sticky toast without reaching for the mouse.
  useEffect(() => {
    if (ms !== null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ms, onDismiss]);

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
            className="ml-auto shrink-0 self-start rounded p-0.5 text-white/70 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        {ms === null && (
          <button
            onClick={onDismiss}
            className="mt-3 w-full rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
          >
            Got it
            <span className="ml-1.5 font-normal text-white/60">(Esc)</span>
          </button>
        )}
      </div>
    </div>
  );
}
