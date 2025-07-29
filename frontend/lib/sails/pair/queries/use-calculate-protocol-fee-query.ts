import { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';

import { usePairProgram } from '@/lib/sails/sails';

export const useCalculateProtocolFeeQuery = (pairAddress: HexString) => {
  const program = usePairProgram(pairAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'pair',
    functionName: 'calculateProtocolFee',
    args: [],
  });

  return { protocolFee: data, isFetching, refetch, error };
};
