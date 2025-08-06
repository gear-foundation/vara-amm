import type { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';

import { useVftProgram } from '@/lib/sails/sails';

export const useDecimalsQuery = (vftAddress?: HexString) => {
  const program = useVftProgram(vftAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'vft',
    functionName: 'decimals',
    args: [],
  });

  return { decimals: data, isFetching, refetch, error };
};
