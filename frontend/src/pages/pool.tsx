import { PoolPage } from '@/components/pool-page';
import { Loader } from '@/components/ui/loader';
import { usePairsTokens } from '@/features/pair';

function Pool() {
  const { pairsTokens, refetchBalances } = usePairsTokens();

  return pairsTokens ? (
    <PoolPage pairsTokens={pairsTokens} refetchBalances={refetchBalances} />
  ) : (
    <Loader size="lg" text="Loading..." className="py-20" />
  );
}

export default Pool;
