import type { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';
import { useMemo } from 'react';

import { usePairProgram } from '@/lib/sails/sails';

export const useGetReservesQuery = (pairAddress?: HexString) => {
  const program = usePairProgram(pairAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'pair',
    functionName: 'getReserves',
    args: [],
  });

  const reserves = useMemo(() => {
    return data ? [BigInt(data[0]), BigInt(data[1])] : undefined;
  }, [data]);

  return { reserves, isFetching, refetch, error };
};
