'use client';

/**
 * The discard tray, as a proportional stack of spent cards.
 *
 * This is how decks remaining is judged at a real table - by eye, off the
 * physical depth of the tray. Deliberately shows NO numbers: the estimate is
 * the skill being drilled, and printing "3.5 decks left" would hand over
 * exactly the half of the true-count calculation the user is meant to supply.
 */
export function DiscardTray({
  dealt,
  total,
}: {
  dealt: number;
  total: number;
}) {
  const fraction = total > 0 ? Math.min(1, dealt / total) : 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative h-40 w-14 overflow-hidden rounded-md border-2 border-white/25 bg-black/35 shadow-inner"
        role="img"
        aria-label="Discard tray"
      >
        {/* Spent cards stack up from the bottom. */}
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-200 to-slate-400 transition-[height] duration-500 ease-out"
          style={{ height: `${fraction * 100}%` }}
        />
        {/* Faint striations so the depth reads as a stack of cards. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out"
          style={{
            height: `${fraction * 100}%`,
            backgroundImage:
              'repeating-linear-gradient(to top, rgba(15,23,42,0.35) 0 1px, transparent 1px 4px)',
          }}
        />
      </div>
      <p className="text-[0.6rem] uppercase tracking-widest text-white/50">Discards</p>
    </div>
  );
}
