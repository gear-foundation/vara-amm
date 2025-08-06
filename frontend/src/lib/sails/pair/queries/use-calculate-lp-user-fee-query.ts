import type { HexString } from '@gear-js/api';
import { useAccount, useProgramQuery } from '@gear-js/react-hooks';

import { usePairProgram } from '@/lib/sails/sails';

export const useCalculateLpUserFeeQuery = (pairAddress: HexString) => {
  const { account } = useAccount();
  const program = usePairProgram(pairAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'pair',
    functionName: 'calculateLpUserFee',
    args: [account?.decodedAddress || '0x'],
    query: { enabled: !!account?.decodedAddress },
  });

  return { lpUserFee: data, isFetching, refetch, error };
};
