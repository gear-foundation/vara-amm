import { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';

import { usePairProgram } from '@/lib/sails/sails';

export const useCalculateLpUserFeeQuery = (pairAddress: HexString, account: HexString) => {
  const program = usePairProgram(pairAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'pair',
    functionName: 'calculateLpUserFee',
    args: [account],
  });

  return { lpUserFee: data, isFetching, refetch, error };
};
