import type { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';

import { usePairProgram } from '@/lib/sails/sails';

export const useGetAmountInQuery = (pairAddress: HexString, amountOut: string, isToken0ToToken1: boolean) => {
  const program = usePairProgram(pairAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'pair',
    functionName: 'getAmountIn',
    args: [amountOut, isToken0ToToken1],
  });

  return { amountIn: data, isFetching, refetch, error };
};
