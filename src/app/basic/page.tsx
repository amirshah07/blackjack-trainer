import { Suspense } from 'react';
import { LoadingScreen } from '@/components/Spinner';
import { BasicStrategyGame } from './BasicStrategyGame';

export default function BasicStrategyPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BasicStrategyGame />
    </Suspense>
  );
}
