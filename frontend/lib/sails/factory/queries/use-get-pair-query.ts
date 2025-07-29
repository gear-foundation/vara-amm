import { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';

import { useFactoryProgram } from '@/lib/sails/sails';

export const useGetPairQuery = (token0: HexString, token1: HexString) => {
  const program = useFactoryProgram();

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'factory',
    functionName: 'getPair',
    args: [token0, token1],
  });

  return { pair: data, isFetching, refetch, error };
};
