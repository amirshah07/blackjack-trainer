import { Suspense } from 'react';
import { BasicStrategyGame } from './BasicStrategyGame';

export default function BasicStrategyPage() {
  return (
    <Suspense fallback={<main className="p-8 text-white/50">Loading…</main>}>
      <BasicStrategyGame />
    </Suspense>
  );
}
