import { Navigation } from '@/components/navigation';
import { TradePage } from '@/components/trade-page';
import { Loader } from '@/components/ui/loader';
import { usePairsTokens } from '@/features/pair';

function Trade() {
  const { pairsTokens, refetchBalances } = usePairsTokens();

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        {pairsTokens ? (
          <TradePage pairsTokens={pairsTokens} refetchBalances={refetchBalances} />
        ) : (
          <Loader size="lg" text="Loading..." className="py-20" />
        )}
      </main>
    </div>
  );
}

export default Trade;
