'use client';

import Link from 'next/link';

/** Shared chrome around every mode: title, back link, and a slot for stats. */
export function TableFrame({
  title, aside, children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    /*
      h-screen rather than min-h-screen: the page is exactly the viewport, so
      a growing table shrinks its own area instead of pushing the controls
      below the fold. overflow-hidden stops any residual rounding from
      scrolling the whole document.
    */
    <main className="mx-auto flex h-screen max-w-5xl flex-col gap-3 overflow-hidden px-4 py-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg px-2.5 py-1.5 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        {aside}
      </header>
      {children}
    </main>
  );
}
