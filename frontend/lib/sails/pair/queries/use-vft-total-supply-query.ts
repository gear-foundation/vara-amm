import { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';

import { usePairProgram } from '@/lib/sails/sails';

export const useVftTotalSupplyQuery = (pairAddress?: HexString) => {
  const program = usePairProgram(pairAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'vft',
    functionName: 'totalSupply',
    args: [],
  });

  return { totalSupply: data, isFetching, refetch, error };
};
