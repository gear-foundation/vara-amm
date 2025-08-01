'use client';

import { Navigation } from '@/components/navigation';
import { PoolPage } from '@/components/pool-page';
import { Loader } from '@/components/ui/loader';
import { usePairsTokens } from '@/features/pair';

import { withProviders } from '../hocs';

function Pool() {
  const { pairsTokens, refetchBalances } = usePairsTokens();
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        {pairsTokens ? (
          <PoolPage pairsTokens={pairsTokens} refetchBalances={refetchBalances} />
        ) : (
          <Loader size="lg" text="Loading..." className="py-20" />
        )}
      </main>
    </div>
  );
}

export default withProviders(Pool);
