'use client';

import { useState, useRef, useEffect } from 'react';

export type CountCheckModalProps = {
  onSubmit: (guess: number) => void;
};

/**
 * Pauses the drill for a true-count estimate.
 *
 * Deliberately shows nothing but the prompt: no running count, no decks
 * remaining, no card history. The whole point is that the user has been
 * tracking it themselves.
 */
export function CountCheckModal({ onSubmit }: CountCheckModalProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(value);
    if (!Number.isFinite(n) || value.trim() === '') return;
    onSubmit(Math.round(n));
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-[min(90vw,22rem)] rounded-2xl bg-slate-900 p-6 shadow-2xl ring-1 ring-white/15"
      >
        <h2 className="text-lg font-semibold">What&rsquo;s the true count?</h2>
        <p className="mt-1 text-sm text-white/55">
          Running count ÷ decks remaining, rounded to the nearest whole number.
        </p>

        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
          aria-label="True count estimate"
          className="no-spinner mt-4 w-full rounded-lg bg-black/40 px-4 py-3 text-center text-2xl font-semibold tabular-nums text-white outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-amber-300"
        />

        <button
          type="submit"
          disabled={value.trim() === ''}
          className="mt-4 w-full rounded-lg bg-amber-300 px-4 py-3 font-semibold text-slate-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/40"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
