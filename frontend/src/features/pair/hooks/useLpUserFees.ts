import { useAccount } from '@gear-js/react-hooks';
import { useQuery } from '@tanstack/react-query';

import { Program as PairProgram } from '@/lib/sails/pair';

type UseLpUserFeesProps = {
  pairPrograms?: PairProgram[];
};

const useLpUserFees = ({ pairPrograms }: UseLpUserFeesProps) => {
  const { account } = useAccount();

  const {
    data: lpUserFees,
    isLoading: isLpUserFeesLoading,
    refetch: refetchLpUserFees,
  } = useQuery({
    queryKey: ['lp-user-fees', !!pairPrograms],
    queryFn: () => {
      if (!pairPrograms || !account?.decodedAddress) return [];

      return Promise.all(pairPrograms.map((pair) => pair.pair.calculateLpUserFee(account.decodedAddress)));
    },
    enabled: !!account?.decodedAddress && !!pairPrograms,
  });

  return {
    lpUserFees,
    isLpUserFeesLoading,
    refetchLpUserFees,
  };
};

export { useLpUserFees };
