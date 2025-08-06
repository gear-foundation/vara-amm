import type { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';

import { usePairProgram } from '@/lib/sails/sails';

export const useCalculateRemoveLiquidityQuery = (pairAddress: HexString, liquidity: string) => {
  const program = usePairProgram(pairAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'pair',
    functionName: 'calculateRemoveLiquidity',
    args: [liquidity],
  });

  return { removeLiquidityAmounts: data, isFetching, refetch, error };
};
