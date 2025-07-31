'use client';

import { Navigation } from '@/components/navigation';
import { TradePage } from '@/components/trade-page';
import { Loader } from '@/components/ui/loader';
import { usePairsTokens } from '@/features/pair';

import { withProviders } from '../hocs';

function Trade() {
  const pairsTokens = usePairsTokens();

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        {pairsTokens ? (
          <TradePage pairsTokens={pairsTokens} />
        ) : (
          <Loader size="lg" text="Loading..." className="py-20" />
        )}
      </main>
    </div>
  );
}

export default withProviders(Trade);
