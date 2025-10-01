import { useProgramQuery } from '@gear-js/react-hooks';

import { useFactoryProgram } from '@/lib/sails/sails';

export const usePairsQuery = () => {
  const program = useFactoryProgram();

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'factory',
    functionName: 'pairs',
    args: [],
    query: { placeholderData: (prev) => prev },
  });

  return { pairs: data, isFetching, refetch, error };
};
