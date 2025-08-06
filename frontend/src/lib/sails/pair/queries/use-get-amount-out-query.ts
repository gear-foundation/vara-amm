import type { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';

import { usePairProgram } from '@/lib/sails/sails';

export const useGetAmountOutQuery = (pairAddress: HexString, amountIn: string, isToken0ToToken1: boolean) => {
  const program = usePairProgram(pairAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'pair',
    functionName: 'getAmountOut',
    args: [amountIn, isToken0ToToken1],
  });

  return { amountOut: data, isFetching, refetch, error };
};
