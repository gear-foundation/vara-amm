import { useProgramQuery } from '@gear-js/react-hooks';

import { useFactoryProgram } from '@/lib/sails/sails';

export const useFeeToQuery = () => {
  const program = useFactoryProgram();

  const { data, refetch, isFetching, error } = useProgramQuery({
    program,
    serviceName: 'factory',
    functionName: 'feeTo',
    args: [],
  });

  return { feeTo: data, isFetching, refetch, error };
};
