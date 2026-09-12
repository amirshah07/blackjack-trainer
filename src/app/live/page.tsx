import { Suspense } from 'react';
import { LivePlayGame } from './LivePlayGame';

export default function LivePlayPage() {
  return (
    <Suspense fallback={<main className="p-8 text-white/50">Loading…</main>}>
      <LivePlayGame />
    </Suspense>
  );
}
