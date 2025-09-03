import { useQuery } from '@tanstack/react-query';

import { SailsProgram as PairProgram } from '@/lib/sails/pair';

type UsePairsTotalSupplyProps = {
  pairPrograms?: PairProgram[];
};

const usePairsTotalSupply = ({ pairPrograms }: UsePairsTotalSupplyProps) => {
  const {
    data: pairTotalSupplies,
    isLoading: isPairTotalSuppliesLoading,
    refetch: refetchPairTotalSupplies,
  } = useQuery({
    queryKey: ['pair-total-supplies', !!pairPrograms],
    queryFn: () => {
      if (!pairPrograms) return [];

      return Promise.all(pairPrograms.map((pair) => pair.vft.totalSupply()));
    },
    enabled: !!pairPrograms,
  });

  return {
    pairPrograms,
    pairTotalSupplies,
    isLoading: isPairTotalSuppliesLoading,
    refetchPairTotalSupplies,
  };
};

export { usePairsTotalSupply };
