import { Suspense } from 'react';
import { LoadingScreen } from '@/components/Spinner';
import { LivePlayGame } from './LivePlayGame';

export default function LivePlayPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LivePlayGame />
    </Suspense>
  );
}
