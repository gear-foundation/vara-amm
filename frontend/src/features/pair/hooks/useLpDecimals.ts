import { useQuery } from '@tanstack/react-query';

import { Program as PairProgram } from '@/lib/sails/pair';

type UseLpDecimalsProps = {
  pairPrograms?: PairProgram[];
};

const useLpDecimals = ({ pairPrograms }: UseLpDecimalsProps) => {
  const {
    data: lpDecimals,
    isLoading: isLpDecimalsLoading,
    refetch: refetchLpDecimals,
  } = useQuery({
    queryKey: ['lp-decimals', !!pairPrograms],
    queryFn: () => {
      if (!pairPrograms) return [];

      return Promise.all(pairPrograms.map((pair) => pair.vft.decimals()));
    },
    enabled: !!pairPrograms,
  });

  return {
    lpDecimals,
    isLpDecimalsLoading,
    refetchLpDecimals,
  };
};

export { useLpDecimals };
