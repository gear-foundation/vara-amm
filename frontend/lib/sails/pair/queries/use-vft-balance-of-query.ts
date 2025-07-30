import { HexString } from '@gear-js/api';
import { useAccount, useProgramQuery } from '@gear-js/react-hooks';

import { usePairProgram } from '@/lib/sails/sails';

export const useVftBalanceOfQuery = (pairAddress: HexString) => {
  const program = usePairProgram(pairAddress);
  const { account } = useAccount();

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'vft',
    functionName: 'balanceOf',
    args: [account?.decodedAddress || '0x'],
    query: { enabled: !!account?.decodedAddress },
  });

  return { balance: data, isFetching, refetch, error };
};
