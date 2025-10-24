import type { HexString } from '@gear-js/api';
import { useAccount, useApi } from '@gear-js/react-hooks';
import { useQuery } from '@tanstack/react-query';

import { usePairsQuery } from '@/lib/sails';
import { SailsProgram as PairProgram } from '@/lib/sails/pair';

const usePairsBalances = () => {
  const { pairs } = usePairsQuery();
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
    queryFn: async () => {
      if (!pairPrograms || !account?.decodedAddress) return null;

      const balances = await Promise.all(pairPrograms.map((pair) => pair.vft.balanceOf(account.decodedAddress)));

      const balancesMap = pairs?.reduce(
        (acc, pair, index) => {
          const pairAddress = pair[1];
          acc[pairAddress] = balances[index];
          return acc;
        },
        {} as Record<HexString, bigint>,
      );
      return balancesMap;
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
