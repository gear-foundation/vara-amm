import { HexString } from '@gear-js/api';
import { useMemo } from 'react';

import { GetPairsReservesQuery, PairReserveData } from '@/features/pair/queries';
import { useGraphQLQuery } from '@/hooks/useGraphQLQuery';

export type PairsReservesMap = Map<HexString, [bigint, bigint]>;

const usePairsReserves = () => {
  const {
    data: reservesResult,
    isFetching: isReservesFetching,
    error: reservesError,
    refetch: refetchReserves,
  } = useGraphQLQuery<{
    allPairs: {
      nodes: PairReserveData[];
    };
  }>(['pairs-reserves'], GetPairsReservesQuery);

  const pairReserves = useMemo(() => {
    const pairs = reservesResult?.allPairs?.nodes || [];

    const reservesMap = new Map() as PairsReservesMap;

    pairs.forEach((pair) => {
      const reserve0 = BigInt(pair.reserve0);
      const reserve1 = BigInt(pair.reserve1);

      reservesMap.set(pair.id, [reserve0, reserve1]);
    });

    return reservesMap;
  }, [reservesResult?.allPairs?.nodes]);

  return { pairReserves, isFetching: isReservesFetching, error: reservesError, refetchReserves };
};

export { usePairsReserves };
