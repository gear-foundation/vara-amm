import { HexString } from '@gear-js/api';
import { useProgramQuery } from '@gear-js/react-hooks';

import { useVftProgram } from '@/lib/sails/sails';

export const useSymbolQuery = (vftAddress?: HexString) => {
  const program = useVftProgram(vftAddress);

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'vft',
    functionName: 'symbol',
    args: [],
  });

  return { symbol: data, isFetching, refetch, error };
};
