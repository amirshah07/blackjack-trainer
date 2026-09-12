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
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
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
