import { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';

import { usePairProgram } from '@/lib/sails/sails';

export const useVftAllowanceQuery = (pairAddress: HexString, owner: HexString, spender: HexString) => {
  const program = usePairProgram(pairAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'vft',
    functionName: 'allowance',
    args: [owner, spender],
  });

  return { allowance: data, isFetching, refetch, error };
};
