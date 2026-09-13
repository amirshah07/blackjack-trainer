import { Suspense } from 'react';
import { LoadingScreen } from '@/components/Spinner';
import { CardCountingGame } from './CardCountingGame';

export default function CardCountingPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CardCountingGame />
    </Suspense>
  );
}
