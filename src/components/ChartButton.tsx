'use client';

/** Opens the strategy chart overlay. Keyboard shortcut: C. */
export function ChartButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-keyshortcuts="C"
      className="rounded-xl bg-white/[0.07] px-4 py-2.5 text-sm font-medium text-white/75 ring-1 ring-white/10 transition hover:bg-white/[0.12] hover:text-white"
    >
      Strategy chart
    </button>
  );
}
