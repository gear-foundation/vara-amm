import { TradePage } from '@/components/trade-page';
import { Loader } from '@/components/ui/loader';
import { usePairsTokens } from '@/features/pair';

function Home() {
  const { pairsTokens, refetchBalances } = usePairsTokens();

  return pairsTokens ? (
    <TradePage pairsTokens={pairsTokens} refetchBalances={refetchBalances} />
  ) : (
    <Loader size="lg" text="Loading..." className="py-20" />
  );
}

export default Home;
