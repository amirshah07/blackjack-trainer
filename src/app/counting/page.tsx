import { Suspense } from 'react';
import { CardCountingGame } from './CardCountingGame';

export default function CardCountingPage() {
  return (
    <Suspense fallback={<main className="p-8 text-white/50">Loading…</main>}>
      <CardCountingGame />
    </Suspense>
  );
}
