import { HexString } from '@gear-js/api';
import { useAccount, useApi } from '@gear-js/react-hooks';
import { useQuery } from '@tanstack/react-query';

import { Program as PairProgram } from '@/lib/sails/pair';

type UsePairsBalancesProps = {
  pairs?: [[HexString, HexString], HexString][];
};

const usePairsBalances = ({ pairs }: UsePairsBalancesProps) => {
  const { api } = useApi();
  const { account } = useAccount();

  const { data: pairPrograms, isLoading: isPairProgramsLoading } = useQuery({
    queryKey: ['pair-programs', pairs],
    queryFn: () => {
      if (!api || !pairs) return [];

      return pairs.map((pair) => new PairProgram(api, pair[1]));
    },
    enabled: !!api && !!pairs,
  });

  const {
    data: pairBalances,
    isLoading: isPairBalancesLoading,
    refetch: refetchPairBalances,
  } = useQuery({
    queryKey: ['pair-balances', !!pairPrograms],
    queryFn: () => {
      if (!pairPrograms || !account?.decodedAddress) return [];

      return Promise.all(pairPrograms.map((pair) => pair.vft.balanceOf(account.decodedAddress)));
    },
    enabled: !!account?.decodedAddress && !!pairPrograms,
  });

  return {
    pairPrograms,
    pairBalances,
    isLoading: isPairProgramsLoading || isPairBalancesLoading,
    refetchPairBalances,
  };
};

export { usePairsBalances };
