'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_CONFIG, type Mode, type Speed } from '@/game/types';

/**
 * Which table options each mode actually exposes.
 *
 * Basic Strategy shows none of them: the chart depends only on your hand and
 * the dealer's upcard, so shoe size and table size change nothing you are
 * being trained on. The other two modes are about card flow, where both
 * matter - they drive the count and the pace.
 */
const MODES: {
  id: Mode;
  name: string;
  blurb: string;
  showsTableOptions: boolean;
}[] = [
  {
    id: 'basic',
    name: 'Basic Strategy',
    blurb: 'Play hands and get told instantly whether each decision matched the chart.',
    showsTableOptions: false,
  },
  {
    id: 'counting',
    name: 'Card Counting',
    blurb: 'Watch cards flow across the table and keep the true count. Periodic check-ins.',
    showsTableOptions: true,
  },
  {
    id: 'live',
    name: 'Live Play',
    blurb: 'Bet, play, and manage a bankroll. No feedback - just a table to play at.',
    showsTableOptions: true,
  },
];

const SPEEDS: Speed[] = ['slow', 'medium', 'fast'];

export default function StartScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('basic');
  const [numDecks, setNumDecks] = useState(DEFAULT_CONFIG.numDecks);
  const [numOtherPlayers, setNumOtherPlayers] = useState(DEFAULT_CONFIG.numOtherPlayers);
  const [speed, setSpeed] = useState<Speed>(DEFAULT_CONFIG.speed);

  const showTableOptions = MODES.find((m) => m.id === mode)?.showsTableOptions ?? false;

  function start() {
    // Basic Strategy does not expose the table options, so it must not
    // silently inherit whatever the hidden sliders happen to hold - send the
    // defaults explicitly and let the URL say what the table actually is.
    const params = showTableOptions
      ? new URLSearchParams({
          decks: String(numDecks),
          players: String(numOtherPlayers),
          speed,
        })
      : new URLSearchParams({
          decks: String(DEFAULT_CONFIG.numDecks),
          players: String(DEFAULT_CONFIG.numOtherPlayers),
          speed: DEFAULT_CONFIG.speed,
        });

    router.push(`/${mode}?${params}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-5 py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Blackjack Trainer</h1>
        <p className="mt-1.5 text-sm text-white/60">
          Dealer stands on soft 17 · double after split · 75% penetration · no surrender
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50">Mode</h2>
        <div className="grid gap-2.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={[
                'rounded-xl border px-4 py-3 text-left transition',
                mode === m.id
                  ? 'border-amber-300/70 bg-amber-300/10'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/25',
              ].join(' ')}
            >
              <span className="font-semibold">{m.name}</span>
              <span className="mt-0.5 block text-sm text-white/55">{m.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      {showTableOptions && (
      <section className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50">Table</h2>

        <Slider
          label="Decks in shoe"
          value={numDecks}
          min={1}
          max={8}
          onChange={setNumDecks}
        />

        <Slider
          label="Other players"
          value={numOtherPlayers}
          min={2}
          max={7}
          onChange={setNumOtherPlayers}
        />

        {(
          <div>
            <p className="mb-2 flex justify-between text-sm">
              <span className="text-white/70">Dealing speed</span>
              <span className="font-semibold capitalize tabular-nums">{speed}</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={[
                    'rounded-lg px-3 py-2 text-sm font-medium capitalize transition',
                    speed === s
                      ? 'bg-amber-300 text-slate-900'
                      : 'bg-white/[0.06] text-white/70 hover:bg-white/10',
                  ].join(' ')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      )}

      <button
        onClick={start}
        className="rounded-xl bg-emerald-500 px-6 py-3.5 text-lg font-semibold text-slate-900 shadow-lg transition hover:bg-emerald-400"
      >
        Start
      </button>
    </main>
  );
}

function Slider({
  label, value, min, max, onChange,
}: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 flex justify-between text-sm">
        <span className="text-white/70">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-300"
      />
    </div>
  );
}
